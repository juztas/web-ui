var D3Force = function(nodes, links, div) {
  this.nodes = nodes;
  this.links = links;
  this.div = div;
  this.width = $(div).parent().width();
  this.height = 800;

  var _this = this;

  // Nodes vars
  var charge = {'switch': 200,
                'host': 20,
                'port': -20};

  var size = {'switch': 50,
              'host': 20,
              'port': 15};

  // Links vars
  var strength = {'link': 0.2,
                  'port': 1,
                  'host': 0.5};

  var distance = {'link': 6 * size['switch'],
                  'port': size['switch'],
                  'host': 5 * size['port']};

  this.fadein_all = function() {
    d3.selectAll(".node").attr("style", "opacity: 0.3");
    d3.selectAll(".link-link").attr("style", "opacity: 0.3");
  };

  this.fadeout_all = function() {
    d3.selectAll(".node").attr("style", "opacity: 1");
    d3.selectAll(".link-link").attr("style", "opacity: 1");
  };

  this.highlight_switch = function(node) {
    _this.fadein_all();
    var d3node = d3.selectAll(".node.switch.switch-" + node.id.replace(/:/g, "\\\:"))[0][0];
    d3node.setAttribute("style", "opacity: 1");
    _this.show_node_details(node);
  };

  this.show_node_details = function(node) {
    /* TODO: Maybe this function should not be here. */
    $("nav").show();
    clear_pannel_info();

    if (node.type == "switch") {
      getTemplateAjax('switch-details.handlebars', function(template) {
       var context = node;
       $('#node-details').html(template(context));
      });
    }
  };

  this.load_layout = function() {
    show_msg("Loading previous layout saved from server...", "alert-info", 3000);
    $.ajax({
      type: "GET",
      url: "/api/layout",
      success: function (positions) {
          _this.force.stop();
          d3.selectAll(".node").each(function(node) {
              if (positions[node.id]) {
                  node.px = positions[node.id][0];
                  node.py = positions[node.id][1];
                  node.x = positions[node.id][0];
                  node.y = positions[node.id][1];
                  node.fixed = true;
                  tick();
              }
          });
      },
      dataType: "json"
    });
  };

  this.save_layout = function() {
    show_msg("Saving current layout to server...", "alert-info", 3000);
    positions = {};
    d3.selectAll(".node").each(function (d) {
       positions[d.id] = [d.x, d.y];
    });
  
    // Remote Store
    $.ajax({
      type: "POST",
      contentType: "application/json; charset=utf-8",
      url: "/api/layout",
      data: JSON.stringify(positions),
      success: function (data) {
        console.log("Saved layout");
      },
      dataType: "json"
    });
  }

  this.show_switch_labels = function(type) {
    _this.clear_switch_labels();

    var switches = d3.selectAll(".node.switch");
    switches.append("text")
      .attr("x", 0)
      .attr("dy", ".35em")
      .style("fill", "white")
      .attr("class", "switch-label")
      .attr("text-anchor", "middle")
      .text(function(d) { return d[type]; });
  };

  this.clear_switch_labels = function() {
    var labels = d3.selectAll(".switch-label");
    labels.remove();
  };

  this.show_port_labels = function(type) {
    _this.clear_port_labels();

    var ports = d3.selectAll(".node.port");
    ports.append("text")
      .attr("x", 0)
      .attr("dy", ".35em")
      .style("fill", "white")
      .attr("class", "port-label")
      .attr("text-anchor", "middle")
      .text(function(d) { return d[type]; });
  };

  this.clear_port_labels = function() {
    var labels = d3.selectAll(".port-label");
    labels.remove();
  };

  this.toggle_unused_ports = function() {
    var ports = d3.selectAll(".node.port")[0];
    ports.forEach(function(port) {
      if (!_this.is_port_used(port.__data__.id)) {
        var id = port.__data__.id;
        var node = d3.selectAll(".node.port.port-" + id.replace(/:/g, "\\\:"));

        if (node.style("visibility") == "hidden") {
          node.style("visibility", "visible");
        } else {
          node.style("visibility", "hidden");
        }
      }
    });
  };

  this.is_port_used = function(id) {
    var links = _this['links'];
    var found = false;
    links.forEach(function(link) {
      if ((link.type == "link") ||
          (link.type == "host")) {
        if ((link.source.id == id) ||
            (link.target.id == id)) {
          found = true;
        }
      }
    });

    return found;
  };

  // Compute the distinct nodes from the links.
  this.links.forEach(function(link) {
    link.source = nodes[link.source] || (nodes[link.source] = {name: link.source});
    link.target = nodes[link.target] || (nodes[link.target] = {name: link.target});
  });

  this.force = d3.layout.force()
     .nodes(d3.values(this.nodes))
     .links(this.links)
     .size([this.width, this.height])
     .gravity(0.015)
     .linkStrength(function(d) { return strength[d.type]; })
     .linkDistance(function(d) { return distance[d.type]; })
     .charge(function(d) { return charge[d.type]; })
     .on("tick", tick)
     .start();

  this.dragstart = function(d, i) {
    _this.force.stop();
  }

  this.dragmove = function(d, i) {
    d.px += d3.event.dx;
    d.py += d3.event.dy;
    d.x += d3.event.dx;
    d.y += d3.event.dy;

    for (var key in d['connectors']) {
      port = _this.nodes[key];
      port.px += d3.event.dx;
      port.py += d3.event.dy;
      port.x += d3.event.dx;
      port.y += d3.event.dy;
      tick();
    }

    // move ports also
    tick();
  }

  this.dragend = function(d, i) {
    d.fixed = true;
    tick();
    _this.force.resume();
  }

  this.custom_drag = d3.behavior.drag()
                .on("dragstart", this.dragstart)
                .on("drag", this.dragmove)
                .on("dragend", this.dragend);

  this.svg = d3.select(this.div).append("svg")
    .attr("width", this.width)
    .attr("height", this.height)
//    .on("dblclick", hide_nav)
//    .attr("pointer-events", "all")
//    .call(d3.behavior.zoom().on("zoom", redraw))
  .append('svg:g');

  this.link = this.svg.selectAll(".link")
    .data(this.force.links())
    .enter().append("line")
    .attr("class", function(d) { return d.type + "-link"; });

  this.node = this.svg.selectAll(".node")
    .data(this.force.nodes())
    .enter().append("g")
    .attr("class", function(d) { return "node" + " " + d.type + " " + d.type + '-' + d.id;})
    .on("click", onclick)
//    .on("mouseout", mouseout)
    .call(this.custom_drag);

  function tick() {
    _this.link
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });
    _this.node
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
  }

  function onclick() {
    var element = d3.select(this);
    var node = element[0][0].__data__;
    _this.highlight_switch(node);
  }

  this.node.append("circle")
    .attr('pointer-events', 'all')
    .attr("class", function(d) { return d['type'] + "-circle";})
    .attr("r", function(d) { return size[d.type]; });


  this.show_switch_labels("ip_address");
  this.show_port_labels("port_number");
}
