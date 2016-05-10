$("#menu-toggle").click(function(e) {
  e.preventDefault();
  $("#wrapper").toggleClass("toggled");
}); 
    
$("#zoom-mode").click(function(e) {
  zoom = ! zoom;
}); 

/* Save positions */
d3.select('#save-layout').on('click', function() {
  chart.save_layout()
}); 
    
/* Restore positions */
d3.select('#load-layout').on('click', function() {
  chart.load_layout();
}); 

/* switch labels */
d3.select('#change-switch-label-none').on('click', function() {
  chart.clear_switch_labels();
}); 
d3.select('#change-switch-label-id').on('click', function() {
  chart.show_switch_labels('id');
}); 
d3.select('#change-switch-label-description').on('click', function() {
  chart.show_switch_labels('description');
}); 
d3.select('#change-switch-label-address').on('click', function() {
  chart.show_switch_labels('ip_address');
}); 
d3.select('#change-switch-label-manufacturer').on('click', function() {
  chart.show_switch_labels('manufacturer');
}); 
d3.select('#change-switch-label-hardware').on('click', function() {
    chart.show_switch_labels('hardware');
}); 

/* port labels */
d3.select('#change-port-label-none').on('click', function() {
  chart.clear_port_labels();
}); 
d3.select('#change-port-label-number').on('click', function() {
  chart.show_port_labels('port_number');
}); 
d3.select('#change-port-label-name').on('click', function() {
  chart.show_port_labels('name');
}); 
d3.select("#unused-ports-toggle").on('click', function() {
  chart.toggle_unused_ports();
});

/* host labels */
d3.select('#change-host-label-id').on('click', function() {
  chart.show_host_labels('id');
});
d3.select('#change-host-label-ip').on('click', function() {
    chart.show_host_labels('ip');
});
d3.select('#change-host-label-mac').on('click', function() {
  chart.show_host_labels('mac');
});

$('#L2RouteCalculationModal').on('show.bs.modal', function (event) {
  var modal = $(this);
  var source = modal.find("#l2source")[0];
  var destination = modal.find("#l2destination")[0];
  hosts = chart.get_all_hosts();

  while (source.children.length > 0) {
    source.children[0].remove();
  }

  while (destination.children.length >0) {
    destination.children[0].remove();
  }

  for(var i = 0; i < hosts.length; i++) {
    var opt = hosts[i]['node-id'];
    var el = document.createElement("option");
    el.textContent = opt;
    el.value = opt;
    source.appendChild(el);
  }

  for(var i = 0; i < hosts.length; i++) {
    var opt = hosts[i]['node-id'];
    var el = document.createElement("option");
    el.textContent = opt;
    el.value = opt;
    destination.appendChild(el);
  }

});

$("#L2RouteCalculationFormSubmit").click(function(e) {
  var modal = $('#L2RouteCalculationModal');
  var source = modal.find("#l2source")[0]['value'];
  var destination = modal.find("#l2destination")[0]['value'];

  // Remote Store
  $.ajax({
    type: "POST",
    contentType: "application/json; charset=utf-8",
    url: "/api/routes/l2",
    data: JSON.stringify({'source': source,
                          'destination': destination}),
    success: function (data) {
      display_paths(source, destination, data['paths']);
      modal.modal('toggle');
      var confirm_modal = $("#PathFlowsConfirmationModal");
      var type = confirm_modal.find("#type")[0];
      type.value = "l2";
    },
    dataType: "json"
  });

});

$('#L3RouteCalculationModal').on('show.bs.modal', function (event) {
  var modal = $(this);
  var source = modal.find("#l3source")[0];
  var destination = modal.find("#l3destination")[0];
  hosts = chart.get_all_hosts();

  while (source.children.length > 0) {
    source.children[0].remove();
  }

  while (destination.children.length >0) {
    destination.children[0].remove();
  }

  for(var i = 0; i < hosts.length; i++) {
    addresses = hosts[i]['host-tracker-service:addresses'];
    for (var j = 0; j < addresses.length; j++) {
      ip = addresses[j]['ip'];
      mac = addresses[j]['mac'];

      var el = document.createElement("option");
      el.textContent = ip + " - " + mac;
      el.value = ip;
      source.appendChild(el);

    }
  }

  for(var i = 0; i < hosts.length; i++) {
    addresses = hosts[i]['host-tracker-service:addresses'];
    for (var j = 0; j < addresses.length; j++) {
      ip = addresses[j]['ip'];
      mac = addresses[j]['mac'];

      var el = document.createElement("option");
      el.textContent = ip + " - " + mac;
      el.value = ip;
      destination.appendChild(el);

    }
  }

});

$("#L3RouteCalculationFormSubmit").click(function(e) {
  var modal = $("#L3RouteCalculationModal");
  var source = modal.find("#l3source")[0]['value'];
  var destination = modal.find("#l3destination")[0]['value'];

  // Remote Store
  $.ajax({
    type: "POST",
    contentType: "application/json; charset=utf-8",
    url: "/api/routes/l3",
    data: JSON.stringify({'source': source,
                          'destination': destination}),
    success: function (data) {
      display_paths(source, destination, data['paths']);
      modal.modal('toggle');
      var confirm_modal = $("#PathFlowsConfirmationModal");
      var type = confirm_modal.find("#type")[0];
      type.value = "l3";
    },
    dataType: "json"
  });

});

$('#PathFlowsConfirmationModal').on('show.bs.modal', function (event) {
  var button = $(event.relatedTarget);
  var path_id = button.data('path');

  var modal = $(this);
  var type = modal.find("#type")[0].value;
  var endpoint = "/api/flow/path/" + type + "/" + path_id;
  modal.find("#PathFlowsInstallForm").attr("action", endpoint);
});

$('#FlowRemoveModal').on('show.bs.modal', function (event) {
  var button = $(event.relatedTarget);
  var flow_id = button.data('flow');
  var table_id = button.data('table');
  var node_id = button.data('node');
  var flow_name = button.data('name');

  var endpoint = "/api/flow/" + node_id + "/" + table_id + "/" + flow_id + "/delete";

  var modal = $(this);

  modal.find("#RemoveFlowForm").attr("action", endpoint);

  $('#flowid').text(flow_id);
  $('#flowname').text(flow_name);
});

$('#FlowLowPriorityRemoveModal').on('show.bs.modal', function (event) {
  var button = $(event.relatedTarget);
  var node_id = button.data('node');
  var endpoint = "/api/flow/" + node_id + "/0/delete/low";
  var modal = $(this);
  modal.find("#FlowLowPriorityRemoveForm").attr("action", endpoint);
});


$('#FlowAddModal').on('show.bs.modal', function (event) {
  var button = $(event.relatedTarget);
  var table_id = button.data('table');
  var node_id = button.data('node');

  var endpoint = "/api/flow/" + node_id + "/0";
  var modal = $(this);

  var output_to = modal.find("#output")[0];

  var interfaces = chart.nodes[node_id]['connectors']; 

  while (output_to.children.length > 0) {
    output_to.children[0].remove();
  }

  for(var key in interfaces) {
    var el = document.createElement("option");
    el.textContent = key;
    el.value = key.split(":")[2];
    output.appendChild(el);
  }

  modal.find("#FlowAddForm").attr("action", endpoint);
  modal.find("#node_id").attr("value", node_id);
});
