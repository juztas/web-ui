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
