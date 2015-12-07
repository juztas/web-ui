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
