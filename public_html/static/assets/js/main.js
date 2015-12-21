function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function show_msg(msg, type, timeout) {
  $("#alert").fadeTo(0, 500).slideDown(500, function(){
    classes = "navbar-fixed-bottom alert col-md-12 pull-right " + type;
    $("#alert").removeClass();
    $("#alert").addClass(classes);
    $("#alert").show();
    $("#alert").html(msg);
  });

  window.setTimeout(function() {
    $("#alert").fadeTo(500, 0).slideUp(500, function(){
        $("#alert").hide();
    });
  }, timeout);
}

function clear_pannel_info() {
  $("#node-details").html('');
}

function getTemplateAjax(path, callback) {
  var source;
  var template;

  $.ajax({
    url: '/static/assets/templates/' + path,
    cache: false,
    success: function(data) {
      source    = data;
      template  = Handlebars.compile(source);

      //execute the callback if passed
      if (callback) callback(template);
    }
  });
}

function display_paths(source, destination, paths) {
  $("nav").show();
  clear_pannel_info();

  getTemplateAjax('paths-details.handlebars', function(template) {
    var context = {source: source,
                   destination: destination,
                   paths: paths};
    $('#node-details').html(template(context));
  });
}

function plot_flow(clean_flow_id, table_id, node_id) {
  clear_pannel_info();

  $.ajax({
    url: "/api/flow/" + node_id + "/" + table_id + "/" + clean_flow_id,
    cache: false,
    success: function(data) {
      console.log(data);
/*
      var flow_id = Object.keys(data)[0];
      var flow = data[flow_id];
      getTemplateAjax('/static/assets/templates/flow-details.handlebars', function(template) {
        var context = {flow: flow};
       $('#flow-details-handlebars').html(template(context));
      }); 
*/
    },  
  }); 

/*
  node = get_node_details(node_id);
  table = node[node_id]['tables'][table_id][0];
  operational = table['operational_flows'];
  flow_details = null;
  operational.forEach(function(op) {
    key = Object.keys(op)[0];
    if (op[key]['clean_id'] == clean_flow_id) {
      flow_details = op[key];
      flow_details['node_id'] = node_id;
    }   
  }); 

  var source = $("#plot-flow-template").html();
  var context = {flow: flow_details};

  
  var template = Handlebars.compile($.trim(source));
  var html = template(context);
  $("#node-details").html(html);
*/
}

Handlebars.registerHelper("len", function(json) {
    return Object.keys(json).length;
});
