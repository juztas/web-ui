import flask
import json
import pickle

from settings.production import *

from odl.instance import ODLInstance
#from odl.exceptions import NodeNotFound, TableNotFound, FlowNotFound

app = flask.Flask(__name__)
app.debug = True

@app.route('/layout', methods=['POST', 'GET'])
def layout():
    client_ip = "%s" % flask.request.environ['REMOTE_ADDR']
    filename = "%s/%s-layout.p" % (layout_dir, client_ip)

    if flask.request.method == 'POST':
        data = json.loads(flask.request.get_data().decode('utf-8'))
        pickle.dump(data, open(filename, "wb"))
    elif flask.request.method == 'GET':
        try:
            data = pickle.load(open(filename, "rb"))
        except IOError:
            data = pickle.load(open("%s/layout.p" % layout_dir, "rb"))
        return flask.jsonify(data)

    return flask.redirect("/")

@app.route('/topology', methods=['GET'])
def get_topology():
    """
    This endpoint returns a big topology with nodes and links.
    """
    credentials = (odl_user, odl_pass)
    odl = ODLInstance(odl_server, credentials)
    data = odl.to_dict()
    return flask.jsonify(data)

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
