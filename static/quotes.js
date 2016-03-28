
var ts = new Tools();

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

function highlight(jdom, annotations, coords, id) {
  var rs = coords.start;
  var re = coords.end;
  var html = jdom.html();
  var before = html.substring(0, rs);
  var classAttr = annotations.join(' ');
  var idstr = (id)? ' id="' + id + '"' : "";
  var wrapped = '<span class="' + classAttr + '"' + idstr + ' title="' + classAttr + '">' + html.substring(rs, re) + '</span>';
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
    var skeletonHtml = elements[span] + elements[spans[span]];
    var skeletonContents = $('<div/>').html(skeletonHtml).contents();
    if (loc >= span && loc <= spans[span] &&
        (skeletonContents.hasClass('quote') ||
         skeletonContents.hasClass('mention'))) {
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

function convertToXml(html) {
  var head = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><doc>";
  // replace all span tags with xml spans instead
  var xmled = html.replace(/<span [^>]*class="(quote|mention) ([^"]+)"[^>]*>([^<]*)<\/span>/g,
      "<$1 speaker=\"$2\">$3</$1>");
  var butt = "</doc>";
  return head + xmled + butt;
}

function convertToHtml(xml) {
  var html = xml.replace("<?xml version=\"1.0\" encoding=\"UTF-8\"?><doc>", "");
  html = html.replace("</doc>", "");
  html = html.replace(/<(quote|mention) speaker="([^"]+)">/g, "<span class=\"$1 $2\">");
  html = html.replace(/<\/(quote|mention)>/g, "</span>");
  return html;
}

function unescapeSpans(html) {
  var unesc = html.replace(/&lt;span class="([^"]+)"&gt;/g, "<span class=\"$1\">");
  unesc = unesc.replace(/&lt;\/span&gt;/g, "<\/span>");
  return unesc;
}

// UI for managing annotation options
function AnnotationOptionsUI(params) {
  this.jdom = params.jdom;
  // Map of shortcut key code (same as event.which) to input element
  this.shortcuts = {};
  // Annotation opts
  this.annotationOpts = params.annotationOpts || {};
  this.maxCharacterId = -1;
  this.groupType = 'spanType';
  this.attachListeners();
}

AnnotationOptionsUI.prototype.update = function(annotationOpts) {
  // AnnotationOpts was updated, lets update our UI (optional annotationOpts param)
  if (annotationOpts) {
    this.annotationOpts = annotationOpts;
  }
  this.shortcuts = {};

  // remove any content first
  this.jdom.html("");
  var allowsGroups = ['spanType', 'character'];
  var groupNames = ['Span', 'Character'];
  var groups = {};
  var maxId = -1;
  for (var i = 0; i < allowsGroups.length; i++) {
    var btnClass = (allowsGroups[i] === 'spanType')? 'btn-group' : 'btn-group-vertical';
    var div = $('<div/>').addClass(btnClass).attr('data-toggle', 'buttons').attr('role', 'group');
    groups[allowsGroups[i]] = { div: div, text: groupNames[i]};
    var gdiv = $('<div/>').append($('<b></b>').append(groupNames[i])).append(div);
    this.jdom.append(gdiv);
  }
  for (var name in this.annotationOpts) {
    var opt = this.annotationOpts[name];
    if (groups[opt.group]) {
      var div = groups[opt.group].div;
      var span = $('<label/>').addClass('btn').addClass(name);
      var input = $('<input/>').attr('type', 'radio').attr('name', opt.group).attr('value', name);
      span.append(input);
      if (opt.shortcut) {
        this.shortcuts[opt.shortcut.charCodeAt(0)] = input;
        span.append('(' + opt.shortcut + ') ' + name);
      } else {
        span.append(name);
      }
      div.append(span);
    } else {
      console.warn('Ignoring opt ' + name + ' in unknown group ' + opt.group);
    }
    // look for the max characterId that is being preloaded
    if (opt.group == 'character') {
      var id = opt.id;
      if (id > maxId) {
        maxId = id;
      }
    }
  }
  this.maxCharacterId = maxId;

  // Update our styles
  $("head style").remove();
  for (var name in this.annotationOpts) {
    var opt = this.annotationOpts[name];
    var css = (opt instanceof Object) ? opt.css : opt;
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
};

AnnotationOptionsUI.prototype.addOption = function() {
  this.groupType = 'spanType';
  // open add option modal
  $("#addoptionmodal").modal({
    escapeClose: true,
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
};

AnnotationOptionsUI.prototype.addCharacter = function() {
  // open add option modal
  this.maxCharacterId++;
  this.groupType = 'character';
  var characterId = this.maxCharacterId;
  var nextColor = ts.getLightColor(characterId);
  var optionCssElem = $("#optioncss");
  var value = (nextColor)? "background-color:" + nextColor + ';' : optionCssElem.attr('title') || '';
  optionCssElem.attr('value', value);
  this.displayTestOption();

  $("#addoptionmodal").modal({
    escapeClose: true,
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
};

AnnotationOptionsUI.prototype.displayTestOption = function() {
  var val = $("#optioncss").val();
  $("#addtest p").attr("style", val);
};

AnnotationOptionsUI.prototype.submit = function() {
  // TODO: class name shouldn't have punctuation either
  var name = $("#optionname").val().trim().replace(/\s/g, "_");

  // Check that values are reasonable
  if (this.annotationOpts[name]) {
    // This annotation option already exists
    // Let's not allow adding
    ts.alert('Cannot add duplicate annotation: ' + name);
    return false;
  }

  var css = $("#optioncss").val();
  this.annotationOpts[name] = { css: css, name: name, group: this.groupType };
  if (this.groupType === 'character') {
    this.annotationOpts[name].id = this.maxCharacterId;
    if (this.maxCharacterId <= 9) {
      this.annotationOpts[name].shortcut = this.maxCharacterId.toString();
    }
  }
  this.update();
  $('#addtest p').attr("style", "");
  $("#closeaddoption").click();
  $(window).off('keypress');
};

AnnotationOptionsUI.prototype.attachListeners = function() {
  // Annotation option stuff
  $("#addoption").click( this.addOption.bind(this) );
  $("#addcharacter").click( this.addCharacter.bind(this) );
  $("#optioncss").keyup( this.displayTestOption.bind(this) );
  $("#submitoption").click( this.submit.bind(this) );
};

// Main annotator class
function Annotator(annotationOpts) {
  this.annotationOptsUI = new AnnotationOptionsUI(
    { jdom: $('#annotationOpts'),
      annotationOpts: annotationOpts });
  this.spanType = 'quote';
  this.lastCharacter = undefined;
  this.nextSpanId = 0; // TOOD: update this when annotated file is loaded.
  this.selectedSpans = [];
  this.allowConnections = true;
}

Annotator.prototype.launch = function() {
  this.attachListeners();
  this.annotationOptsUI.update();

  if (this.allowConnections) {
    // Using jsPlumb from https://jsplumbtoolkit.com to connect elements
    jsPlumb.setContainer($("#annotationarea"));
    jsPlumb.importDefaults({
      Anchor : "Center",
      Connector:[ "Bezier", { curviness: 30 } ],
      PaintStyle: {
        lineWidth: 4,
        strokeStyle: 'rgba(200,0,0,0.5)'
      },
      Endpoints: [["Dot", {radius: 4}], ["Dot", {radius: 4}]]
    });
  }

  // Check for the various File API support.
  if (window.File && window.FileReader && window.FileList && window.Blob) {
    // Great success! All the File APIs are supported.
    return true;
  } else {
    ts.alert('The File APIs are not fully supported in this browser.');
    return false;
  }
};

Annotator.prototype.attachListeners = function() {
  // enterAnnotateMode
  $("#annotate").click( this.enterAnnotateMode.bind(this) );
  // Saving
  $("#save").click( this.save.bind(this) );
  $("#saveconfig").click( this.save.bind(this) );
  // Loading
  $("#loadfiles").change( this.load.bind(this) );
  $("#loadconfig").change( this.load.bind(this) );
  $("#closespecific").click( this.resetSpecific.bind(this) );
};

Annotator.prototype.enterAnnotateMode = function() {
  var text = $("#annotationarea textarea").val().trim();
  if (text.length === 0) {
    // Nothing to annotate - refuse to enter AnnotateMode
    ts.alert("Please enter some text to annotate!!!");
    return;
  }
  // make a fake div
  var escaped = $("<div/>").text(text).html();
  escaped = unescapeSpans(escaped);
  // how many lines are in this text
  var numLines = escaped.split("\n").length;
  $("#annotationarea").html("<pre>" + escaped + "</pre>");

  if (numLines > 10000) {
    ts.alert("This text is likely too long (" + numLines + "lines!), you should probably split it into smaller ones and annotate those instead");
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
  $("#annotationarea").mouseup( this.openSpecificModal.bind(this) );
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
};

// Annotate stuff!!!
Annotator.prototype.save = function(evt) {
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
    content = JSON.stringify(this.annotationOptsUI.annotationOpts);
  }
  if (savename.length == 0) {
    ts.alert("filename is empty!");
    return;
  }
  var blob = new Blob([content], {type: "text/plain;charset=utf-8"});
  saveAs(blob, name);
};

Annotator.prototype.load = function(evt) {
  var files = evt.target.files; // FileList object
  var id = evt.target.id;
  if (files.length == 0) {
    return;
  }
  if (files.length != 1) {
    ts.alert("Only the first selected file will be loaded!");
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
        var annotationOpts = JSON.parse(content);
        this.annotationOptsUI.update(annotationOpts);
      }.bind(this);
    }
    reader.readAsText(file);
  }
};

Annotator.prototype.openSpecificModal = function() {
  var coords = getHighlightSpan($("#annotationarea"));
  // if anything weird happens like the user just clicked or
  // they highlighted over an existing quote
  if (coords == null) {
    return;
  }

  $("#specificAnns").modal({
    escapeClose: true,
    clickClose: false,
    showClose: false
  });

  var scope = this;
  // Make sure the default spanType is selected
  $('input[name="spanType"][value="' + this.spanType + '"').click();
  // Make sure last character is selected
  if (this.lastCharacter) {
    $('input[name="character"][value="' + this.lastCharacter + '"').click();
  } else {
    // no last character selected, so don't select any
    $('input[name="character"]').prop('checked', 'false').removeClass('active');
  }
  // listen for key press events
  $(window).keypress(function(e) {
    var key = e.which;
    // 49 is the numeral "1"'s code
    //var ind = key - 49;
    if (scope.annotationOptsUI.shortcuts[key]) {
      scope.annotationOptsUI.shortcuts[key].click()
    } else if (key == 13) {
      // 13 is return
      scope.closeSpecificModal(coords);
    }
  });

  $("#submitspecific").click(function(e){
    scope.closeSpecificModal(coords);
  });
};

Annotator.prototype.closeSpecificModal = function(coords) {
  var value = $('input[name="character"]:checked').val();
  var spanType = $('input[name="spanType"]:checked').val();
  this.spanType = spanType;
  // now send the value to the thing doing the highlighting
  var spanId = 's' + this.nextSpanId;
  highlight($('#annotationarea'), [spanType, value], coords, spanId);

  if (this.allowConnections) {
    var spans = $('#annotationarea span');
    spans.css('cursor', 'default');
    var scope = this;
    spans.click(function (event) {
      if (event.ctrlKey) {
        console.log('Selected span ' + $(this).attr('id'));
        if (scope.selectedSpans.indexOf($(this)) < 0) {
          scope.selectedSpans.push($(this));
          if (scope.selectedSpans.length === 2) {
            console.log('Connect ' + scope.selectedSpans[0].attr('id') + ' with ' + scope.selectedSpans[1].attr('id'));
            // TODO: Visualize and record
            jsPlumb.connect({
              source: scope.selectedSpans[0],
              target: scope.selectedSpans[1],
              scope: "someScope"
            });
            scope.selectedSpans = [];
          }
        } else {
          console.log('Selected spans already contain span');
        }
      }
    });
  }
  this.nextSpanId++;
  $("#closespecific").click();
  $(window).off('keypress');
  $("#submitspecific").off('click');
};

Annotator.prototype.resetSpecific = function() {
  var ele = $('input[name="character"]');
  for(var i=0;i<ele.length;i++) {
    ele[i].checked = false; // hack that depends on default value being last
  }
};


