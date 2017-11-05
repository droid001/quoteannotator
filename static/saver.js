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
    name = (savename.endsWith('.xml'))? savename : savename + '.xml';
    var html = $("#annotationarea pre").html();
    content = convertToXml(html, this.annotationOptsUI.annotationOpts);
  } else if (id == 'saveconfig') {
    savename = $('#savefilenameconfig').val().trim();
    name = (savename.endsWith('.json'))? savename : savename + '.json';
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
      };
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

Saver.prototype.loadAndReturnValue = function(evt) {

	var files = evt.target.files; // FileList object

	if (files.length == 0) {
		return;
	}
	if (files.length != 1) {
		ts.alert("Only the first selected file will be loaded!");
	}

	var textType = /text.*/;
	var file = files[0];
	var ann = this;

	if (file.type.match(/application\/json/)) {

		return new Promise( (resolve, reject) => {

			var reader = new FileReader();
			reader.onload = resolve;
			reader.readAsText(file);
		})

		// reader.onload = function(e) {
		// 	var content = reader.result;
		// 	return JSON.parse(content);
		//
		// }.bind(this);
		//
		// return reader.readAsText(file);

	} else {
		throw new Error("Wrong file format. JSON expected");
	}
};

function attrsToString(data) {
  var attrs = Object.keys(data).map( function(key) {
    return key + '="' + data[key] + '"';
  });
  var attrStr = attrs.join(" ");
  return attrStr;
}

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
  type = null;
  for (var j = 0; j < childClasses.length; j++) {
  if (childClasses[j].startsWith('speaker_')) {
      speaker = childClasses[j].substring('speaker_'.length);
    }
    if (childClasses[j].startsWith('connection_')) {
      connection.push(childClasses[j].substring('connection_'.length));
    }
    if (childClasses[j] === 'quote' || childClasses[j] === 'mention') {
      type = childClasses[j];
    }
  }
  if (type == null) {
    console.log("Warning! generating xml tag without a type!");
  }
  var data = next.data();
  data['speaker'] = speaker;
  data['connection'] = connection.join(','),
  data['id'] = childId;
  var attrStr = attrsToString(data);
  childConverted = "<" + type + " " + attrStr + ">" + childConverted + "</" + type + ">";
  return childConverted;
}

function xmlToHtmlConvert(child, childConverted) {
  // now replace the outer xml bits
  var classAttrs =  ['connection', 'speaker']; // properties to turn into classes (rest gets turned into data)
  var id = child.attr("id");
  var attrs = child.prop("attributes");
  var id = null;
  var classes = {};
  var dataAttrs = {};
  for (var attr = 0; attr < attrs.length; attr++) {
    var $attr = $(attrs[attr]);
    var name = $attr[0].name;
    var val = $attr.val();
    if (name === "id") {
      id = val;
      if (!id.startsWith('s')) {
        id = 's' + id;
      }
    } else if (classAttrs.indexOf(name) >= 0){
      classes[name] = val;
    } else {
      // Everything else store as 'data-xxx' attribute in HTML
      dataAttrs[name] = val;
    }
  }
  var span = $('<span/>');
  span.attr("id", id);
  var tagName = child[0].tagName;
  span.addClass(tagName);
  var title = tagName;
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
  for (var attr in dataAttrs) {
    if (dataAttrs.hasOwnProperty(attr)) {
      span.attr('data-' + attr, dataAttrs[attr]);
    }
  }
  span.attr('title', title);
  span.html(childConverted);
  // Need to convert &amp; back into & for some reason
  return span.prop("outerHTML").replace("&amp;", "&");
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
    var annOpt = annotationOpts[name];
    if (annOpt.group == 'character') {
      var character = "<character " + attrsToString(annOpt.data) + ">" +
        "</character>";
      head += character;
    }
  }
  head += "</characters><text>";
  var xmled = convertSingleSpan($("#annotationarea pre"), htmlToXmlConvert);
  var butt = "</text></doc>";
  return head + xmled + butt;
}

function convertToHtml(xml, ann) {
  console.log('converting...');
  var xmlDoc = $.parseXML(xml);
  console.log(xmlDoc);
  $xml = $( xmlDoc );
  // take care of adding the characters in the doc to the annotator
  if (ann != undefined) {
    $characters = $xml.find( "characters" );
    ann.addCharactersFromXml($characters);
  }
  // now we want to load everything for real
  $text = $xml.find("text");
  var inner = convertSingleSpan($text, xmlToHtmlConvert);
  // Need to convert &amp; back into & for some reason
  inner = inner.replace("&amp;", "&");
  return inner;
}
