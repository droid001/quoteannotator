
ts = new Tools();

// Utility functions
function getHtmlTagLocations(html) {
  var elements = {};
  var start = 0;
  var curr = 0;
  var inTag = false;
  while (curr < html.length) {
    if (!inTag && html.charAt(curr) == "<") {
      // append everything we've gathered so far
      inTag = true;
      start = curr;
    }
    if (inTag && html.charAt(curr) == ">") {
      // append the tag and the index that it starts at
      elements[start] = html.substring(start, curr + 1);
      inTag = false;
    }
    curr += 1; 
  }
  return elements;
}

function getSpansFromTagLocations(elements) {
  var spans = {};
  for (var elem in elements) {
    var boundsEnd = elem;
    var count = 0;
    if (elements[elem].startsWith('</') || (elements[elem].endsWith('/>'))) {
      continue;
    }
    for (var e in elements) {
      if ((e * 1.0) >= (elem * 1.0)) {
      if (elements[e].startsWith('</')) {
        count -= 1;
      } else if (elements[e].startsWith('<') && elements[e].endsWith('/>')) {
          // self closing, do nothing
        } else if (elements[e].startsWith('<')) {
          // this check should be redundant
          count += 1;
        }
        if (count == 0) {
          boundsEnd = e;
          break;
        }
      }
    }
    spans[elem] = parseInt(boundsEnd);
  }
  return spans;
}

function getRealCoords(coords, elements) {
  var spansSoFar = 0;
  var i = 0;
  while (i - spansSoFar <= coords.start) {
    if (i in elements) {
      spansSoFar += elements[i].length;
    }
    i++;
  }
  var rs = i - 1;
  var re = rs + (coords.end - coords.start);
  return {start: rs, end: re};
}

// Given jquery object jdom, returns the span with start and end coordinate
function getHighlightSpan(jdom){
  var coords = getCaretCharacterOffsetWithin(jdom[0]);
  // if the user clicks and doesn't highlight anything
  if (coords.start == coords.end) {
    return null;
  }
  var stripped = jdom.text();
  // align stripped to html
  var html = jdom.html();
  var elements = getHtmlTagLocations(html);
  var rCoords = getRealCoords(coords, elements);
  rs = rCoords.start;
  re = rCoords.end;

  // we also want to make sure that these coordinates
  // are not partially inside another span (like a quote)
  var spans = getSpansFromTagLocations(elements);

  for (var span in spans) {
    if (span != spans[span]) {
      if ((rs < span && re > span && re < spans[span]) || 
          (rs > span && rs < spans[span] && re > spans[span])) {
        return null;
      }
    }
  }

  // let's also disallow quotes over empty trimmed strings
  var toWrap = html.substring(rs, re);
  if (toWrap.trim().length == 0) {
    return null;
  }
  return {"start": rs, "end": re};
}

function highlight(jdom, annotations, coords) {
  var rs = coords.start;
  var re = coords.end;
  var html = jdom.html();
  var before = html.substring(0, rs);
  var classAttr = annotations.join(' ');
  var wrapped = '<span class="' + classAttr + '"' + 'title="' + classAttr + '">' + html.substring(rs, re) + '</span>';
  var after = html.substring(re);
  jdom.html(before + wrapped + after);
}

function deleteAnnotation(jdom) {
  var coords = getCaretCharacterOffsetWithin(document.getElementById("annotationarea"));
  if (coords.start != coords.end) {
    return;
  }
  // see if we clicked over a quote span
  var html = jdom.html();
  var elements = getHtmlTagLocations(html);
  var spans = getSpansFromTagLocations(elements);
  var rCoords = getRealCoords(coords, elements);
  var loc = rCoords.start;
  var remove = -1;
  for (var span in spans) {
    if (loc >= span && loc <= spans[span] && elements[span].startsWith("<span class=\"quote")) {
      remove = span;
    }
  }
  if (remove >= 0) {
    var startR = remove;
    var endR = spans[remove];
    var beginning = html.substring(0, startR);
    var mStart = parseInt(startR) + parseInt(elements[startR].length);
    var middle = html.substring(mStart, endR);
    var eStart = parseInt(endR) + parseInt(elements[endR].length);
    var end = html.substring(eStart);
    jdom.html(beginning + middle + end);
  }
}

function getCaretCharacterOffsetWithin(element) {
  var caretOffset = 0;
  var doc = element.ownerDocument || element.document;
  var win = doc.defaultView || doc.parentWindow;
  var sel;
  var end = 0;
  if (typeof win.getSelection != "undefined") {
    sel = win.getSelection();
    if (sel.rangeCount > 0) {
      var range = win.getSelection().getRangeAt(0);
      var selected = range.toString().length; // *
      var preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);

      var str = preCaretRange.toString();
      var escaped = $("<div/>").text(preCaretRange.toString()).html();
      if(selected){ // *
        caretOffset = preCaretRange.toString().length - selected;
        var escInd = 0;
        var size = 0;
        var total = 0;
        for (var i = 0; i <= caretOffset + selected; i++) { 
           if (str.charAt(i) != escaped.charAt(escInd) || escaped.charAt(escInd) == '&') {
            if (escaped.charAt(escInd) == '&') {
              while (escInd < escaped.length && escaped.charAt(escInd) != ';') {
                escInd += 1;
                if (i < caretOffset) {
                  total += 1;
                } else {
                  size += 1;
                }
              }
              escInd += 1; // we want the ; as well
            } else {
              console.log('danger, will robinson!');
              console.log(escaped.charAt(escInd));
            } 
          } else {
            escInd += 1;
          }
        }
        end = selected;
        end += size;
        caretOffset += total;
      } else {
        caretOffset = escaped.length;
      }
    }
  } else if ( (sel = doc.selection) && sel.type != "Control") {
    var textRange = sel.createRange();
    var preCaretTextRange = doc.body.createTextRange();
    preCaretTextRange.moveToElementText(element);
    preCaretTextRange.setEndPoint("EndToEnd", textRange);
    caretOffset = preCaretTextRange.text.length;
  }
  return {"start": caretOffset, "end": caretOffset + end};
}

function annotateMode() {
  var text = $("#annotationarea textarea").val();
  // make a fake div
  var escaped = $("<div/>").text(text).html();
  escaped = unescapeSpans(escaped);
  // how many lines are in this text
  var numLines = escaped.split("\n").length;
  $("#annotationarea").html("<pre>" + escaped + "</pre>");

  if (numLines > 10000) {
    alert("This text is likely too long (" + numLines + "lines!), you should probably split it into smaller ones and annotate those instead");
  }
  // now we need to set up our line numbers correctly
  var lineNums = "<pre>";
  for (var i = 0; i < numLines; i++) {
    var modded = i % 100;
    var xtra = "";
    if (i % 2 == 0) {
      xtra = " zebra"
    }
    lineNums += "<span class=\"linenum" + xtra + "\">"+ i + "</span>\n";
  }
  lineNums += "</pre>";
  $("#linenums").html(lineNums);

  // we want our boxes to scroll together
  $('#annotationarea').on('scroll', function () {
    $('#linenums').scrollTop($(this).scrollTop());
  });

  // listeners
  $("#annotationarea").mouseup(openSpecificModal);
  $("#annotationarea").click( function(event) {
    if (event.altKey) {
      deleteAnnotation($("#annotationarea"));
    }
  });
  // disable file loading
  $("#loadfiles").prop("disabled", true);
  $("#annotate").prop("disabled", true);
  $("#annotate").addClass("disabled");
  $("#annotate").css("background-color", "white");
}

function convertToXml(html) {
  var head = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><doc>";
  // replace all span tags with xml spans instead
  var xmled = html.replace(/<span class="quote ([^"]+)">/g, "<quote speaker=\"$1\">");
  xmled = xmled.replace(/<\/span>/g, "</quote>");
  var butt = "</doc>";
  return head + xmled + butt;
}

function convertToHtml(xml) {
  var html = xml.replace("<?xml version=\"1.0\" encoding=\"UTF-8\"?><doc>", "");
  html = html.replace("</doc>", "");
  html = html.replace(/<quote speaker="([^"]+)">/g, "<span class=\"quote $1\">");
  html = html.replace(/<\/quote>/g, "</span>");
  return html;
}

function unescapeSpans(html) {
  var unesc = html.replace(/&lt;span class="([^"]+)"&gt;/g, "<span class=\"$1\">");
  unesc = unesc.replace(/&lt;\/span&gt;/g, "<\/span>");
  return unesc;
}

function save(evt) {
  var id = evt.target.id;
  var savename = "";
  var name = "";
  var content = "";
  if (id == 'save') {
    savename = $('#savefilename').val().trim();
    name = savename + '.xml';
    var html = $("#annotationarea pre").html();
    content = convertToXml(html);
  } else if (id == 'saveconfig') {
    savename = $('#savefilenameconfig').val().trim();
    name = savename + '.json';
    content = JSON.stringify(annotationOpts);
  }
  if (savename.length == 0) {
    alert("filename is empty!");
    return;
  }
  var blob = new Blob([content], {type: "text/plain;charset=utf-8"});
  saveAs(blob, name);
}

function handleFileSelect(evt) {
  var files = evt.target.files; // FileList object
  var id = evt.target.id;
  if (files.length == 0) {
    return;
  }
  if (files.length != 1) {
    alert("Only the first selected file will be loaded!");
  }

  var textType = /text.*/;
  var file = files[0];
  if (file.type.match(textType) || file.type.match(/application\/json/)) {
    var reader = new FileReader();
    if (id == 'loadfiles') {
      reader.onload = function(e) {
        var content = reader.result;
        var html = convertToHtml(content);
        $("#annotationarea textarea").val(html);
        $("#annotate").click();
      }
    } else if (id == 'loadconfig') {
      reader.onload = function(e) {
        var content = reader.result;
        annotationOpts = JSON.parse(content);
        loadConfig();
      }
    }
    reader.readAsText(file);
  }

}

function loadConfig() {
  //remove any content first
  $("#annotationOpts").html("");
  var count = 1;
  for (var name in annotationOpts) {
    var span = $('<span />').addClass(name);
    var input = $('<input type="radio" name="sg" />').attr('value', name);
    span.append(input);
    span.html('<label>' + span.html() + '(' + count + ') ' + name + '</label>');
    var br = $('<br / >');
    $("#annotationOpts").append(span);
    $("#annotationOpts").append(br);
    count += 1;
  }
  
  $("head style").remove();
  for (var name in annotationOpts) {
    var opt = annotationOpts[name];
    var css = opt;
    // first split by ;
    var cssRules = css.split(';');
    for (var rule in cssRules) {
      var str = cssRules[rule];
      if (str.length == 0) {
        continue;
      }
      $('<style>.' + name + ' { ' + str + ' }</style>').appendTo('head');
    }
  }
}

function addOption() {
  // open add option modal
  var keys = Object.keys(annotationOpts);
  var nOptions = keys.length;
  var nextColor = ts.getColor(nOptions);
  var optionCssElem = $("#optioncss");
  var value = (nextColor)? "background-color:" + nextColor + ';' : optionCssElem.attr('title') || '';
  optionCssElem.attr('value', value);
  displayTestOption();

  $("#addoptionmodal").modal({
    escapeClose: false,
    clickClose: false,
    showClose: false
  });

  // listen for key press events
  $(window).keypress(function(e) {
    var key = e.which;
    if (key == 13) {
      // 13 is return
      $("#submitoption").click();
    } 
  });
}

function displayTestOption(evt) {
  var val = $("#optioncss").val();
  $("#addtest p").attr("style", val);
}

function loadListeners() {
  $("#annotate").click(annotateMode);
  $("#save").click(save);
  $("#saveconfig").click(save);
  $("#loadfiles").change(handleFileSelect);
  $("#loadconfig").change(handleFileSelect);
  $("#closespecific").click(resetSpecific);
  $("#addoption").click(addOption);
  $("#optioncss").keyup(displayTestOption);
  $("#submitoption").click(closeAddOptionModal);
  loadConfig();
}

function closeAddOptionModal() {
  var name = $("#optionname").val().replace(/\s/g, "_");
  var css = $("#optioncss").val();
  annotationOpts[name] = css;
  loadConfig();
  $('#addtest p').attr("style", "");
  $("#closeaddoption").click();
}

function openSpecificModal() {
  var coords = getHighlightSpan($("#annotationarea"));
  // if anything weird happens like the user just clicked or 
  // they highlighted over an existing quote
  if (coords == null) {
    return;
  }

  $("#specificAnns").modal({
    escapeClose: false,
    clickClose: false,
    showClose: false
  });


  // listen for key press events
  $(window).keypress(function(e) {
    var key = e.which;
    // 49 is the numeral "1"'s code
    var ind = key - 49;
    if (ind >= 0 && ind < $('input[name="sg"]').length) {
      $('input[name="sg"]')[ind].click()
    } else if (key == 13) {
      // 13 is return
      closeSpecificModal(coords);
    } 
  });

  $("#submitspecific").click(function(e){
    closeSpecificModal(coords);
  });
}

function closeSpecificModal(coords) {
  var value = $('input[name="sg"]:checked').val();
  // now send the value to the thing doing the highlighting
  highlight($('#annotationarea'), ['quote', value], coords);
  $("#closespecific").click();
  $(window).off('keypress');
  $("#submitspecific").off('click');
}

function resetSpecific() {
  var ele = $('input[name="sg"]');
  for(var i=0;i<ele.length;i++) {
    ele[i].checked = false; // hack that depends on default value being last
  }
}

// Main annotator class
function Annotator(annotationOpts) {
  loadConfig(annotationOpts);
}

Annotator.prototype.launch = function() {
  loadListeners();

  // Check for the various File API support.
  if (window.File && window.FileReader && window.FileList && window.Blob) {
    // Great success! All the File APIs are supported.
    return true;
  } else {
    alert('The File APIs are not fully supported in this browser.');
    return false;
  }
};