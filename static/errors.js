
function ErrorChecker() {

}

ErrorChecker.prototype.checkConnections = function(e) {
  // We want to ensure that every quote is connected to
  // one (and only one) mention.
  var quotes = $(".quote");
  var numWrong = 0;
  for (var i = 0; i < quotes.length - 1; i++) {
    var q = $(quotes[i]);
    var classes = q.attr("class").split(" ");
    var foundConnection = false;
    for (var j = 0; j < classes.length; j++) {
      if (classes[j].startsWith("connection")) {
        if (!foundConnection) {
          foundConnection = true;
        } else {
          // oh no! this quote is connected to multiple mentions! 
          console.log("This quote connected to muptiple mentions!");
        }
      }
    }
    if (!foundConnection) {
      // this quote isn't connected at all!
      console.log(q);
      q.addClass("missingConnection");
      numWrong++;
    }
  }
  console.log(numWrong);
  $("#connectionstatus").text("Number of quotes unlinked to mentions: " + numWrong);
}
