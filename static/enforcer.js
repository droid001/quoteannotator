
function Enforcer() {
  this.paired = {'quote' : 'mention', 'mention' : 'quote'};
}

Enforcer.prototype.enforceSpanTypes = function(selectedSpans, potentialNewSpanId) {
  // get the type of the already selected span
  if (selectedSpans.length == 0) {
    return true; 
  } else if (selectedSpans.length > 1) {
    console.log("this should be a connection error...");
  }
  var selectedType = null;
  var selectedClasses = $('#' + selectedSpans[0]).attr('class').split(' ');
  for (var i = 0; i < selectedClasses.length; i++) {
    if (this.paired[selectedClasses[i]] != undefined) {
      selectedType = selectedClasses[i];
    }
  }
  if (selectedType == null) {
    console.log("connecting with unknown class");
    return true;
  }
  // now make sure the potential new one has the correct class
  var hasMatchingClass = $('#' + potentialNewSpanId).hasClass(this.paired[selectedType]);
  return hasMatchingClass;
}
