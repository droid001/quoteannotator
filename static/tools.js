function Tools() {
  this.state = "nothing";
  this.selection = false;
}

// category20 colors from d3 (these also look to be the tableau20 colors
var d3_category20_colors = [ '#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a',
  '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94', '#e377c2', '#f7b6d2',
  '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5'];

// Subset of light colors as defaults for character coloring (also exclude grays)
// Other colors are okay too but maybe black doesn't show up as well...
var light_colors = ['#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
  '#c49c94', '#f7b6d2', '#dbdb8d', '#9edae5'];

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

Tools.prototype.alert = function(message, callback){
  alert(message);
};

Tools.prototype.getColor = function(i) {
  // TODO: generate a random color if i >= array_length
  return d3_category20_colors[i];
};

Tools.prototype.getRandomColor = function() {
  var num = Math.floor(Math.random() * 360);
  return $.husl.toHex(num, 90, 60);
}

Tools.prototype.getLightColor = function(i) {
  if (i < light_colors.length) {
    return light_colors[i];
  } else {
    return this.getRandomColor();
  }
};
