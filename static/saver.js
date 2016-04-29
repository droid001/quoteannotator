// Main saving/loading class/functionality
//

function Saver() {
  // nothing happening here (yet)
}

Saver.prototype.save = function(evt) {
  var id = evt.target.id;
  var savename = "";
  var name = "";
  var content = "";
  if (id == 'save') {
    savename = $('#savefilename').val().trim();
    name = savename + '.xml';
    var html = $("#annotationarea pre").html();
    content = convertToXml(html, this.annotationOptsUI.annotationOpts);
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

Saver.prototype.load = function(evt) {
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
  var ann = this;
  if (file.type.match(textType) || file.type.match(/application\/json/)) {
    var reader = new FileReader();
    if (id == 'loadfiles') {
      reader.onload = function(e) {
        var content = reader.result;
        var html = convertToHtml(content, ann);
        $("#annotationarea textarea").val(html);
        $("#annotate").click();
        ann.updateSpanIds();
        ann.updateConnections();
        ann.enableConnectionClicks();
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

function htmlToXmlConvert(next, childConverted) {
  // now replace the outer xml bits
  var childId = next.attr('id');
  var childClasses = next.attr('class');
  // find the span type, connection, and speaker classes
  var type = "";
  var connection = [];
  var speaker = "";
  childClasses = childClasses.split(' ');
  // TODO: make less hacky
  type = childClasses[0];
  for (var j = 1; j < childClasses.length; j++) {
  if (childClasses[j].startsWith('speaker_')) {
      speaker = childClasses[j].substring('speaker_'.length);
    }
    if (childClasses[j].startsWith('connection_')) {
      connection.push(childClasses[j].substring('connection_'.length));
    }
  }
  childConverted = "<" + type + " speaker=\"" + speaker + "\" connection=\"" +
    connection.join(',') + "\" id=\"" + childId + "\">" + childConverted + "</" + type + ">";
  return childConverted;
}

function xmlToHtmlConvert(child, childConverted) {
  // now replace the outer xml bits
  var speaker = child.attr("speaker");
  var id = child.attr("id");
  var connection = child.attr("connection");
  var attrs = child.prop("attributes");
  var id = null;
  var classes = {};
  for (var attr = 0; attr < attrs.length; attr++) {
    var $attr = $(attrs[attr]);
    var name = $attr[0].name;
    var val = $attr.val();
    if (name === "id") {
      id = val;
    } else {
      classes[name] = val;
    }
  }
  var span = $('<span />');
  span.attr("id", id);
  span.addClass(child[0].tagName);
  var title = child[0].tagName;
  for (var cl in classes) {
    var val = classes[cl].split(' ').join('_');
    val = val.split('.').join('');
    if (val.length > 0) {
      var splitList = val.split(',');
      for (var j = 0; j < splitList.length; j++) {
        span.addClass(cl + "_" + splitList[j]);
      }
      if (cl == 'speaker') {
        title += ' ' + cl + "_" + val;
      }
    }
  }
  span.attr('title', title);
  span.html(childConverted);

  return span.prop("outerHTML");
}

function convertSingleSpan(span, conversionFunction) {
  // base case, no span in this span, can just return the html
  var children = span.children();
  if (children.length == 0) {
    return span.html();
  }
  var html = span.html();
  var prevEnd = 0;
  var gathered = "";
  for (var i = 0; i < children.length; i++) {
    var next = $(children[i]);
    var childHtml = next.prop("outerHTML");
    var start = html.indexOf(childHtml, prevEnd);  // only appears once
    var childConverted = convertSingleSpan(next, conversionFunction);
    childConverted = conversionFunction(next, childConverted);
    gathered += html.substring(prevEnd, start);
    gathered += childConverted;
    prevEnd = start + childHtml.length;
  }
  gathered += html.substring(prevEnd);
  return gathered;
}

function convertToXml(html, annotationOpts) {
  var head = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><doc>";
  // we need to insert character info here
  
  head += "<characters>";
  for (var name in annotationOpts) {
    if (name.startsWith('speaker_')) {
      var character = "<character name=\"" + name + "\" id=\"" + annotationOpts[name].id + "\">" +
        "</character>";
      head += character;
    }
  }
  head += "</characters><text>";
  var xmled = convertSingleSpan($("#annotationarea pre"), htmlToXmlConvert);
  var butt = "</text></doc>";
  return head + xmled + butt;
};

function convertToHtml(xml, ann) {
  var xmlDoc = $.parseXML(xml);
  $xml = $( xmlDoc );
  // take care of adding the characters in the doc to the annotator
  $characters = $xml.find( "characters" );
  ann.addCharactersFromXml($characters);
  // now we want to load everything for real
  $text = $xml.find( "text");
  var inner = convertSingleSpan($text, xmlToHtmlConvert);
  return inner;
};
