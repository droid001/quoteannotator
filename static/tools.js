function Tools() {
  this.state = "nothing";
  this.selection = false;
}
  
Tools.prototype.selectSelector = function() {
  if (!this.selection){
    // change mouse pointer to look selecty
    $('html').css('cursor', 'crosshair');
    $('textarea').css('cursor', 'crosshair');
  } else {
    // make it normal again
    $('html').css('cursor', 'auto');
    $('textarea').css('cursor', 'auto');
  }
  this.selection = !this.selection;
};

Tools.prototype.highlight = function() {
  var html = "";
  var start = -1;
  var end = -1;
  if (typeof window.getSelection != "undefined") {
    var sel = window.getSelection();
    console.log(sel);
    if (sel.rangeCount == 1) {
      var r = sel.getRangeAt(0);
      console.log(r);
      var text = r.startContainer.data;
      start = r.startOffset;
      end = r.endOffset;
    }
  } else if (typeof document.selection != "undefined") {
//    if (document.selection.type == "Text") {
//      html = document.selection.createRange().htmlText;
//    }
  }

  return {"start": start, "end" : end};
};
