$("#menu-toggle").click(function(e) {
  e.preventDefault();
  $("#wrapper").toggleClass("toggled");
  $("nav").toggleClass("narrow");
});

$("#zoom-mode").click(function(e) {
  $('#zoom-mode').toggleClass('active');
});

/* Save positions */
d3.select('#save-layout').on('click', function() {
  chart.save_layout();
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

$('#L3RouteCalculationModal, #ALTORouteCalculationModal').on('show.bs.modal', function (event) {
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

$("#ALTOTaskSubmissionModal").on('show.bs.modal', function (event) {
  var modal = $(this);
  var source = modal.find("#l3source")[0];
  var destination = modal.find("#l3destination")[0];
  $.ajax({
    method: 'GET',
    contentType: "application/json; charset=utf-8",
    url: "/api/spce/task/sites",
    success: function (data) {
      var servers = data['servers'];
      var clients = data['clients'];
      while (source.children.length > 0) {
        source.children[0].remove();
      }

      while (destination.children.length >0) {
        destination.children[0].remove();
      }

      for(var i = 0; i < servers.length; i++) {
        var el = document.createElement("option");
        el.textContent = servers[i];
        el.value = servers[i];
        source.appendChild(el);
      }

      for(var i = 0; i < clients.length; i++) {
        var el = document.createElement("option");
        el.textContent = clients[i];
        el.value = clients[i];
        destination.appendChild(el);
      }
    }
  });

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

$("#ALTORouteManagementTab").click(function(e) {
  $.ajax({
    type: "POST",
    contentType: "application/json; charset=utf-8",
    url: "api/spce/path/retrieve",
    data: JSON.stringify({}),
    success: function (data) {
      alto_path_manager(data['paths']);
    },
    dataType: "json"
  });
});

$("#ALTOTaskManagementTab").click(function (e) {
  toggle_task_timer = true;
  task_management_timer = function () {
    if (toggle_task_timer) {
      $.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: "api/spce/task/stat",
        data: JSON.stringify({}),
        success: function (data) {
          alto_task_manager(data['tasks']);
        },
        error: function (xhr, status, error) {
          alto_task_manager([]);
        },
        dataType: "json"
      });
      setTimeout(task_management_timer, 2000);
    }
  };
  task_management_timer();
});

$("#ALTORouteRemoveModal").on("show.bs.modal", function (event) {
  var button = $(event.relatedTarget);
  var route = button.data('route');
  var modal = $(this);
  modal.find("#route").data('route', route.replace(/,/g, '|'));
  modal.find("#route").html('<span class="label label-primary">' + route.replace(/,/g, '</span><span class="label label-primary">') + '</span>');
});

$("#ALTORateRemoveModal").on("show.bs.modal", function (event) {
  var button = $(event.relatedTarget).parent().siblings()
        .first().children().first();
  var route = button.data('route');
  var modal = $(this);
  modal.find("#route").data('route', route.replace(/,/g, '|'));
  modal.find("#route").html('<span class="label label-primary">' + route.replace(/,/g, '</span><span class="label label-primary">') + '</span>');
});

$("#ALTORemoveRouteFormSubmit").click(function (e) {
  var form = $(this).parent().parent();
  var route = form.find("#route").data("route");
  $.ajax({
    type: "POST",
    contentType: "application/json; charset=utf-8",
    url: "api/spce/path/remove",
    data: JSON.stringify({'path': route}),
    success: function (data) {
      $('#ALTORouteRemoveModal').modal('hide');
      $("#ALTORouteManagementTab").click();
    }
  });
});

$("#SPCESetupPathFormSubmit").click(function(e) {
  var modal = $("#ALTORouteCalculationModal");
  var source = modal.find("#l3source").val();
  var destination = modal.find("#l3destination").val();
  var obj_metrics = [modal.find("#obj-metrics").val()];
  var constraints = [{'metric': 'hopcount',
                      'min': parseInt(modal.find("#min-hopcount").val()) || 0,
                      'max': parseInt(modal.find("#max-hopcount").val()) || 100000000000},
                     {'metric': 'bandwidth',
                      'min': parseInt(modal.find("#min-bandwidth").val()) || 0,
                      'max': parseInt(modal.find("#max-bandwidth").val()) || 100000000000}];

  $.ajax({
    type: "POST",
    contentType: "application/json; charset=utf-8",
    url: "api/spce/path/setup",
    data: JSON.stringify({'source': source,
                          'destination': destination,
                          'obj_metrics': obj_metrics,
                          'constraints': constraints}),
    success: function (data) {
      modal.modal('hide');
      // TODO: feedback
      $("#ALTORouteManagementTab").click();
    },
    dataType: "json"
  });
});

$("#SPCERateLimitingFormSubmit").click(function(e) {
  var modal = $("#SPCERateControllerModal");
  var operation = modal.find("#ALTORateControllerForm").attr("action");
  var source = modal.find("#l3source").text();
  var destination = modal.find("#l3destination").text();
  var bandwidth = parseInt(modal.find("#rate-limit").val()) || 1000000;
  var bs = parseInt(modal.find("#burst-size").val()) || bandwidth;
  // Test Input
  $.ajax({
    type: "POST",
    contentType: "application/json; charset=utf-8",
    url: "api/spce/tc/set",
    data: JSON.stringify({'source': source,
                          'destination': destination,
                          'bandwidth': bandwidth,
                          'bs': bs,
                          'operation': operation}),
    success: function (data) {
      modal.modal('hide');
      $("#ALTORouteManagementTab").click();
    },
    dataType: "json"
  });
});

$("#ALTOTaskSubmissionFormSubmit").click(function (e) {
  var modal = $("#ALTOTaskSubmissionModal");
  var source = modal.find("#l3source").val();
  var destination = modal.find("#l3destination").val();
  var source_file = modal.find("#source_file").val();
  var destination_dir = modal.find("#destination_dir").val();
  $.ajax({
    type: "POST",
    contentType: "applicaiton/json; charset=utf-8",
    url: "api/spce/task/submit",
    data: JSON.stringify({'source': source,
                          'destination': destination,
                          'source_file': source_file,
                          'destination_dir': destination_dir}),
    success: function (data) {
      modal.modal('hide');
      $("#ALTOTaskManagementTab").click();
      alert(JSON.stringify(data));
    },
    error: function (xhr, status, error) {
      alert('Submission Failed for Some Reasons...');
      modal.modal('hide');
    },
    dataType: "json"
  });
});

$("#ALTORemoveRateFormSubmit").click(function (e) {
  var form = $(this).parent().parent();
  var route = form.find("#route").text();
  $.ajax({
    type: "POST",
    contentType: "application/json; charset=utf-8",
    url: "api/spce/tc/remove",
    data: JSON.stringify({'path': route}),
    success: function (data) {
      $("#ALTORateRemoveModal").modal('hide');
      $("#ALTORouteManagementTab").click();
    }
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
