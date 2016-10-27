import flask
import json
import pickle
import uuid
import re
import time
import os
import rrdtool
import datetime
import requests
from functools import wraps

from settings.production import *

from odl.instance import ODLInstance
from odl.altospce import ALTOSpce
from odl.exceptions import NodeNotFound, TableNotFound, FlowNotFound, ODLErrorOnPOST

from networkx import nx

app = flask.Flask(__name__)
app.debug = True

session_l2paths = {}
session_l3paths = {}

def check_auth(username, password):
    return username == ui_user and password == ui_pass

def authenticate():
    return flask.Response(
        'Could not verify your access level for that URL.\n'
        'You have to login with proper credentials', 401)

def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = flask.request.authorization
        if not auth or not check_auth(auth.username, auth.password):
            return authenticate()
        return f(*args, **kwargs)
    return decorated

def get_ports_on_path(path):
    regex = r'^openflow:[0-9a-z-]+:[0-9]+$'
    ports = filter(lambda x: re.match(regex, x), path)
    return zip(ports[::2], ports[1::2])

def get_rrd_stats(node_id, table_id, clean_flow_id, diff=60 * 15):
    filename = str("%s/%s/%s/%s.rrd" % (rrd_dir,
                                        node_id,
                                        table_id,
                                        clean_flow_id))

    end = int(time.time())
    begin = end - diff

    data = []
    if os.path.isfile(filename):
        result = rrdtool.fetch(filename, 'AVERAGE', '--start', str(begin), '--end', str(end), '-r', str(10))
        keys = result[1]
        values = result[2]
        begin = result[0][0]
        end = result[0][1]
        step = result[0][2]
        ts = begin
        duration = end - begin
        for value in values:
            date = datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S')
            data.append({'date': date,
                         'bytes': 0 if value[0] is None else value[0],
                         'packets': 0 if value[1] is None else value[1]})
            ts += step
    return data

def check_match_flow(flow, eth_type, eth_src, eth_dest, ipv4_src, ipv4_dest):
    return (flow.get_ethernet_type() == eth_type and
            flow.get_ethernet_source() == eth_src and
            flow.get_ethernet_destination() == eth_dest and
            flow.get_ipv4_source() == ipv4_src and
            flow.get_ipv4_destination() == ipv4_dest)

def check_reverse_match_flow(flow, eth_type, eth_src, eth_dest, ipv4_src, ipv4_dest):
    return (flow.get_ethernet_type() == eth_type and
            flow.get_ethernet_source() == eth_dest and
            flow.get_ethernet_destination() == eth_src and
            flow.get_ipv4_source() == ipv4_dest and
            flow.get_ipv4_destination() == ipv4_src)

def explore_path(nodes, main_flow, eth_type, eth_src, eth_dest, ipv4_src, ipv4_dest):
    path = []
    main_table = main_flow.table
    main_node = main_table.node
    main_data = {
        'id': main_node.id,
        'main': {
            'table_id': main_table.id,
            'clean_flow_id': main_flow.clean_id
        }
    }
    oposite_flow = {}
    for t in main_node.get_tables().values():
        for f in t.get_all_flows().values():
            if (check_reverse_match_flow(f, eth_type, eth_src, eth_dest,
                                         ipv4_src, ipv4_dest) and
                ((not oposite_flow) or f.priority > oposite_flow.priority)):
                oposite_flow = f
    if oposite_flow:
        main_data['oposite'] = {
            'table_id': oposite_flow.table.id,
            'clean_flow_id': oposite_flow.clean_id
        }
    path.append(main_data)

    for n in nodes.values():
        ndata = {}
        if n.id == main_node.id:
            continue
        main_flow = {}
        oposite_flow = {}
        for t in n.get_tables().values():
            for f in t.get_all_flows().values():
                if (check_match_flow(f, eth_type, eth_src, eth_dest,
                                             ipv4_src, ipv4_dest) and
                    ((not main_flow) or f.priority > main_flow.priority)):
                    main_flow = f
                if (check_reverse_match_flow(f, eth_type, eth_src, eth_dest,
                                             ipv4_src, ipv4_dest) and
                    ((not oposite_flow) or f.priority > oposite_flow.priority)):
                    oposite_flow = f
        if main_flow:
            ndata = {
                'id': n.id,
                'main': {
                    'table_id': main_flow.table.id,
                    'clean_flow_id': main_flow.clean_id
                }
            }
            if oposite_flow:
                ndata['oposite'] = {
                    'table_id': oposite_flow.table.id,
                    'clean_flow_id': oposite_flow.clean_id
                }
            path.append(ndata)

    return path

@app.route('/verify', methods=['GET'])
@requires_auth
def verify():
    return flask.jsonify({"success": True})

@app.route('/layout', methods=['POST', 'GET'])
@requires_auth
def layout():
    client_ip = "%s" % flask.request.environ['REMOTE_ADDR']
    filename = "%s/%s-layout.p" % (layouts_dir, client_ip)

    if flask.request.method == 'POST':
        data = json.loads(flask.request.get_data().decode('utf-8'))
        pickle.dump(data, open(filename, "wb"))
    elif flask.request.method == 'GET':
        try:
            data = pickle.load(open(filename, "rb"))
        except IOError:
            data = pickle.load(open("%s/layout.p" % layouts_dir, "rb"))
        return flask.jsonify(data)

    return flask.redirect("/")

@app.route('/topology', methods=['GET'])
@requires_auth
def get_topology():
    """
    This endpoint returns a big topology with nodes and links.
    """
    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)
    data = odl.to_dict()
    return flask.jsonify(data)

@app.route('/flow/<node_id>/<table_id>', methods=['POST'])
@requires_auth
def install_flow(node_id, table_id):
    """
    This will install a flow.

    You should pass via POST few args.

    TODO: Better documentation.
    """
    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)
    try:
        node = odl.get_node_by_id(node_id)
        table = node.get_table_by_id(table_id)
    except (NodeNotFound, TableNotFound) as e:
        flask.abort(404)

    form = flask.request.form
    table.install_flow(priority = form.get('priority'),
                       name = form.get('name'),
                       eth_type = form.get('eth_type'),
                       eth_source = form.get('eth_source'),
                       eth_destination = form.get('eth_destination'),
                       ipv4_source = form.get('ipv4_source'),
                       ipv4_destination = form.get('ipv4_destination'),
                       connector_id = form.get('output'),
                       template_dir = template_dir)
    return flask.redirect("/")

@app.route('/stats/flow/<node_id>/<table_id>/<clean_flow_id>', defaults={'diff': 60*15}, methods=['GET'])
@app.route('/stats/flow/<node_id>/<table_id>/<clean_flow_id>/<int:diff>', methods=['GET'])
@requires_auth
def flow_stats(node_id, table_id, clean_flow_id, diff):
    """
    This endpoint returns statistics to plot.
    You should pass a node id, table id and a clean flow id. (removing #, $, -
    and * symbols from id).
    """
    # Main flow
    main = get_rrd_stats(node_id, table_id, clean_flow_id, diff)

    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)
    try:
        node = odl.get_node_by_id(node_id)
        table = node.get_table_by_id(table_id)
        flow = table.get_flow_by_clean_id(clean_flow_id)
    except (NodeNotFound, TableNotFound, FlowNotFound) as e:
        return flask.abort(404)

    # Try to get the oposite flow (just in case of where booth are added with
    # same name.
    flows = table.get_config_flows_by_name(flow.name)
    for oposite in flows:
        if oposite.clean_id != clean_flow_id:
            break
    if flows:
        oposite = get_rrd_stats(node_id, table_id, oposite.clean_id, diff)
    else:
        oposite = []

    return flask.jsonify({'main': main,
                          'oposite': oposite})

@app.route('/stats/path/<node_id>/<table_id>/<clean_flow_id>', defaults={'diff': 60*15}, methods=['GET'])
@app.route('/stats/path/<node_id>/<table_id>/<clean_flow_id>/<int:diff>', methods=['GET'])
@requires_auth
def path_stats(node_id, table_id, clean_flow_id, diff):
    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)
    try:
        node = odl.get_node_by_id(node_id)
        table = node.get_table_by_id(table_id)
        flow = table.get_flow_by_clean_id(clean_flow_id)
    except (NodeNotFound, TableNotFound, FlowNotFound) as e:
        return flask.abort(404)

    nodes = odl.get_nodes()
    data = [];
    eth_type = flow.get_ethernet_type()
    eth_src = flow.get_ethernet_source()
    eth_dest = flow.get_ethernet_destination()
    ipv4_src = flow.get_ipv4_source()
    ipv4_dest = flow.get_ipv4_destination()
    if eth_type == 0x0800 and (eth_src != '*' or
                               eth_dest != '*' or
                               ipv4_src != '*' or
                               ipv4_dest != '*'):
        path = explore_path(nodes, flow, eth_type, eth_src, eth_dest, ipv4_src, ipv4_dest)
        for n in path:
            ndata = {
                'id': n['id'],
                'main': get_rrd_stats(n['id'], n['main']['table_id'], n['main']['clean_flow_id'], diff)
            }
            if n.has_key('oposite'):
                ndata['oposite'] = get_rrd_stats(n['id'], n['oposite']['table_id'], n['oposite']['clean_flow_id'], diff)
            data.append(ndata)
    else:
        data.append({'id': node.id, 'main': get_rrd_stats(node.id, table.id, flow.clean_id, diff)})
    return flask.jsonify(data)

@app.route('/stats/all/flow/<name>/<int:diff>', methods=['GET'])
@requires_auth
def flow_stats_all(name, diff):
    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)
    nodes = odl.get_nodes()
    stats = {}
    for node in nodes.values():
        tables = node.get_tables()
        node_stats = {}
        for table in tables.values():
            flows = table.get_config_flows_by_name(name)
            for flow in flows:
                node_stats[flow.clean_id] = get_rrd_stats(node.id, table.id, flow.clean_id, diff)
        if node_stats:
            stats[node.id] = node_stats
    return flask.jsonify(stats)

@app.route('/routes/l2', methods=['POST'])
@requires_auth
def l2routes():
    """
    This returns a list of all paths available between two MAC address. Also an
    random ID is generated for this session for each path. So you can use this ID
    when creating a complete PATH l2 flow.

    You should pass as data to the POST request the source and destination MAC
    addresses.

    Ex:

        {'source': '00:00:00:00:00:01', 'destination': '00:00:00:00:00:02'}

    """
    data = json.loads(flask.request.get_data().decode('utf-8'))
    source = data['source']
    destination = data['destination']

    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)
    graph = odl.topology.get_networkx_graph()

    client_ip = "%s" % flask.request.environ['REMOTE_ADDR']
    session_l2paths[client_ip] = {}

    paths = []
    for path in nx.all_simple_paths(graph, source, destination):
        uid = "%s" % uuid.uuid1()
        paths.append({'uid': uid, 'path': path})
        session_l2paths[client_ip][uid] = path

    return flask.jsonify({'paths': paths})

@app.route('/routes/l3', methods=['POST'])
@requires_auth
def l3routes():
    """
    This returns a list of all paths available between two IPv4 address. Also an
    random ID is generated for this session for each path. So you can use this ID
    when creating a complete PATH l3 flow.

    You should pass as data to the POST request the source and destination IPv4
    addresses.

    Ex:

        {'source': '192.168.1.1', 'destination': '192.168.1.2'}

    """
    data = json.loads(flask.request.get_data().decode('utf-8'))
    source = data['source']
    destination = data['destination']

    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)
    graph = odl.topology.get_networkx_graph()

    source_id, dest_id = None, None

    # Theses are topology nodes
    # TODO: Topology nodes should be of same type of a normal node.
    #       EX: switch vs Host vs Port
    nodes = odl.topology.get_nodes()
    for node in nodes.values():
        node_id = node['node-id']
        if (node_id.split(":")[0] == "host"):
            ips = node['host-tracker-service:addresses']
            for ip in ips:
                if ip['ip'] == source:
                    source_id = "host:%s" % ip['mac']

                if ip['ip'] == destination:
                    dest_id = "host:%s" % ip['mac']

    if not source_id or not dest_id:
        return flask.jsonify({'paths': []})

    client_ip = "%s" % flask.request.environ['REMOTE_ADDR']
    session_l3paths[client_ip] = {}

    paths = []
    for path in nx.all_simple_paths(graph, source_id, dest_id):
        uid = "%s" % uuid.uuid1()
        path[0] = source
        path[-1] = destination
        paths.append({'uid': uid, 'path': path})
        session_l3paths[client_ip][uid] = path

    return flask.jsonify({'paths': paths})


@app.route('/flow/path/l2/<path_id>', methods=['POST'])
@requires_auth
def install_flows_for_l2path(path_id):
    """
    This will install a l2 full path flows (based on MAC addresses) in all
    switches in a path.

    You should use first '/api/routes/l2' to see the uid of path. This is a
    necessary argument for this endpoint.
    """
    client_ip = "%s" % flask.request.environ['REMOTE_ADDR']
    try:
        path = session_l2paths[client_ip][path_id]
    except KeyError:
        flask.abort(404)

    ports = get_ports_on_path(path)

    # [(u'openflow:562958149829575:2', u'openflow:562958149829575:21'),
    #  (u'openflow:440565346114459:257', u'openflow:440565346114459:217')]

    source_host = ":".join(path[0].split(":")[1::])
    target_host = ":".join(path[-1].split(":")[1::])

    # Install a flow in each switch on the path with correct output
    # port.
    for source_port, target_port in ports:
        source_switch = "%s:%s" % (source_port.split(":")[0], source_port.split(":")[1])
        target_switch = "%s:%s" % (target_port.split(":")[0], target_port.split(":")[1])
        # Just in case check
        if (source_switch != target_switch):
            print "Error 500: Switches are different on path"
            flask.abort(500)

        # Match: source_port, source_host, target_host, eth_type = 0x806 ?
        # Target Action: target_port
        # Lookup for switch in database
        try:
            credentials = (odl_user, odl_pass)
            odl = ODLInstance(odl_server, credentials)
            node = odl.get_node_by_id(target_switch)
            table = node.get_table_by_id(0) # Assuming installing on table 0
        except (NodeNotFound, TableNotFound) as e:
            print "Error: 404 - Switch or table not found in database"
            flask.abort(404)

        print "Inserting flow for %s..." % node.id

        # Install the flow one way
        table.l2output(flow_name = "L2AR%s" % path_id.split("-")[0],
                       connector_id = target_port,
                       source = source_host,
                       destination = target_host,
                       template_dir = template_dir)

        # Install the flow another way
        table.l2output(flow_name = "L2AR%s" % path_id.split("-")[0],
                       connector_id = source_port,
                       source = target_host,
                       destination = source_host,
                       template_dir = template_dir)

    # Update Json file
    return flask.redirect("/")

@app.route('/flow/path/l3/<path_id>', methods=['POST'])
@requires_auth
def install_flows_for_l3path(path_id):
    """
    This will install a l3 full path flows (based on IP Address addresses) in all
    switches in a path.

    You should use first '/api/routes/l3' to see the uid of path. This is a
    necessary argument for this endpoint.
    """
    client_ip = "%s" % flask.request.environ['REMOTE_ADDR']
    try:
        path = session_l3paths[client_ip][path_id]
    except KeyError:
        flask.abort(404)

    ports = get_ports_on_path(path)

    source_host = path[0]
    target_host = path[-1]

    # Install a flow in each switch on the path with correct output
    # port.
    for source_port, target_port in ports:
        source_switch = "%s:%s" % (source_port.split(":")[0], source_port.split(":")[1])
        target_switch = "%s:%s" % (target_port.split(":")[0], target_port.split(":")[1])
        # Just in case check
        if (source_switch != target_switch):
            print "Error 500: Switches are different on path"
            flask.abort(500)

        # Match: source_port, source_host, target_host, eth_type = 0x806 ?
        # Target Action: target_port
        # Lookup for switch in database
        try:
            credentials = (odl_user, odl_pass)
            odl = ODLInstance(odl_server, credentials)
            node = odl.get_node_by_id(target_switch)
            table = node.get_table_by_id(0) # Assuming installing on table 0
        except (NodeNotFound, TableNotFound) as e:
            print "Error: 404 - Switch or table not found in database"
            flask.abort(404)

        print "Inserting flow for %s..." % node.id

        # Install the flow one way
        table.l3output(flow_name = "L3AR%s" % path_id.split("-")[0],
                       connector_id = target_port,
                       source = "%s/32" % source_host,
                       destination = "%s/32" % target_host,
                       template_dir = template_dir)

        # Install the flow another way
        table.l3output(flow_name = "L3AR%s" % path_id.split("-")[0],
                       connector_id = source_port,
                       source = "%s/32" % target_host,
                       destination = "%s/32" % source_host,
                       template_dir = template_dir)

    # Update Json file
    return flask.redirect("/")

@app.route('/spce/path/setup', methods=['POST'])
@requires_auth
def spce_setup_path():
    data = json.loads(flask.request.get_data().decode('utf-8'))
    source = data['source']
    destination = data['destination']
    obj_metrics = data['obj_metrics']
    constraints = data['constraints']

    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)
    spce = ALTOSpce(odl)

    try:
        return flask.jsonify(spce.path_setup(src=source,
                                             dst=destination,
                                             objective_metrics=obj_metrics,
                                             constraint_metric=constraints))
    except ODLErrorOnPOST as e:
        print "Error: 500 - Setup path failed"
        flask.abort(500)

@app.route('/spce/path/retrieve', methods=['POST'])
@requires_auth
def spce_get_paths():
    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)
    spce = ALTOSpce(odl)

    try:
        paths = spce.get_all_paths()
        alto_paths = []
        for path in paths:
            p = {'path': path['path'].split('|')}
            if 'tc' in path.keys() and path['tc'] >= 0:
                p['tc'] = path['tc']
            alto_paths.append(p)
        return flask.jsonify(paths=alto_paths)
    except ODLErrorOnPOST as e:
        print "Error: 500 - Get path failed"
        flask.abort(500)

@app.route('/spce/path/remove', methods=['POST'])
@requires_auth
def spce_remove_path():
    data = json.loads(flask.request.get_data().decode('utf-8'))
    path = data['path']

    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)
    spce = ALTOSpce(odl)

    try:
        return flask.jsonify(spce.path_remove([path]))
    except ODLErrorOnPOST as e:
        print "Error: 500 - Remove path failed"
        flask.abort(500)

@app.route('/spce/tc/set', methods=['POST'])
@requires_auth
def spce_set_tc():
    data = json.loads(flask.request.get_data().decode('utf-8'))
    source = data['source']
    destination = data['destination']
    bandwidth = data['bandwidth']
    bs = data['bs']
    operation = data['operation']

    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)
    spce = ALTOSpce(odl)

    try:
        if operation == 'create':
            return flask.jsonify(spce.set_tc(src=source, dst=destination, bd=bandwidth, bs=bs))
        else:
            return flask.jsonify(spce.update_tc(src=source, dst=destination, bd=bandwidth, bs=bs))
    except ODLErrorOnPOST as e:
        print "Error: 500 - Rate limiting setup failed"
        flask.abort(500)

@app.route('/spce/tc/remove', methods=['POST'])
@requires_auth
def spce_remove_tc():
    data = json.loads(flask.request.get_data().decode('utf-8'))
    path = data['path']

    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)
    spce = ALTOSpce(odl)

    try:
        return flask.jsonify(spce.remove_tc(path))
    except ODLErrorOnPOST as e:
        print "Error: 500 - Rate limiting setup failed"
        flask.abort(500)

@app.route('/spce/task/submit', methods=['POST'])
@requires_auth
def spce_task_submit():
    data = json.loads(flask.request.get_data().decode('utf-8'))
    source = data['source']
    destination = data['destination']
    source_file = data['source_file']
    destination_dir = data['destination_dir']

    try:
        # Submit to task management server
        endpoint = fdt_master + '/task/submit'
        headers = { 'Content-type': 'application/json' }
        data = {
            "server": {"hostname": source},
            "client": {"hostname": destination},
            "files": [source_file],
            "target": destination_dir
        }
        requests.post(endpoint, headers=headers, data=json.dumps(data))
        return flask.jsonify(data)
    except ODLErrorOnPOST as e:
        print "Error: 500 - Rate limiting setup failed"
        flask.abort(500)

@app.route('/spce/task/stat', methods=['POST'])
@requires_auth
def spce_task_stat():
    tasks = []
    # Get tasks stat
    try:
        endpoint = fdt_master + '/task/status'
        headers = { 'Content-type': 'application/json' }
        response = requests.get(endpoint, headers=headers)
        data = json.loads(response.text)
        for uuid in data.keys():
            stat = data[uuid]['stat']
            source = stat.get('server', {})
            target = stat.get('client', {})
            speed = stat.get('speed', {})
            files = ','.join(data[uuid]['files'])
            tasks.append({
                "uuid": uuid,
                "source": source.get('ip', '*') + ':' + source.get('port', '*') + files,
                "target": target.get('ip', '*') + ':' + target.get('port', '*'),
                "net_speed": speed.get('net', '-'),
                "avg_speed": speed.get('avg', '-'),
                "size": stat.get('size', '-'),
                "status": stat.get('status', '-'),
                "progress": stat.get('progress', '-')
            })
        return flask.jsonify({'tasks': tasks})
    except ODLErrorOnPOST as e:
        print "Error: 500 - Rate limiting setup failed"
        flask.abort(500)

@app.route('/spce/task/sites', methods=['GET'])
@requires_auth
def spce_task_sites():
    sites = []
    try:
        endpoint = fdt_master + '/list'
        headers = { 'Content-type': 'application/json' }
        response = requests.get(endpoint, headers=headers)
        data = json.loads(response.text)
        return flask.jsonify(data)
    except ODLErrorOnPOST as e:
        print "Error: 500 - Rate limiting setup failed"
        flask.abort(500)

@app.route('/flow/<node_id>/<table_id>/delete/low', methods=['POST', 'DELETE'])
@requires_auth
def delete_low_priority_flows(node_id, table_id):
    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)

    try:
        node = odl.get_node_by_id(node_id)
        table = node.get_table_by_id(table_id)
        table.delete_low_priority_flows()
        return flask.redirect("/")
    except (NodeNotFloud, TableNotFound) as e:
        flask.abort(404)

@app.route('/flow/<node_id>/<table_id>/<flow_id>/delete', methods=['POST', 'DELETE'])
@requires_auth
def delete_flow(node_id, table_id, flow_id):
    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)

    delete_all = flask.request.form.get('delete_all')

    try:
        # Get the node object
        node = odl.get_node_by_id(node_id)
        # Get the table object
        table = node.get_table_by_id(table_id)
        # Get the flow
        flow = table.get_all_flows()[flow_id]
    except (NodeNotFound, TableNotFound, FlowNotFound) as e:
        flask.abort(404)

    if delete_all:
        nodes = odl.get_nodes()
        for node in nodes.values():
            node.delete_config_flows_by_name(flow.name)
    else:
        flow.delete()

    return flask.redirect("/")

if __name__ == "__main__":
    try:
        server = os.environ["ODL_URL"]
        user = os.environ["ODL_USER"]
        password = os.environ["ODL_PASS"]
    except KeyError:
        print "Please provide all environment vairables."
        print "Read the README.md for more information."
        sys.exit(1)

    app.run(host="0.0.0.0", port=80, debug=True, threaded=True)
