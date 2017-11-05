

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
	return {
		start: rs,
		end: re
	};
}

// Given jquery object jdom, returns the span with start and end coordinate
function getHighlightSpan(jdom, charOffsets) {
	var coords = charOffsets || getCaretCharacterOffsetWithin(jdom[0]);
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
	return {
		"start": rs,
		"end": re,
		"totalLength": html.length,
		"characterOffsets": coords
	};
}

function highlight(annotator, jdom, annotations, coords, id) {
	var html = jdom.html();
	if (html.length != coords.totalLength) {
		// Hmm something in the html has changed, recomputed the coords
		coords = getHighlightSpan(jdom, coords.characterOffsets);
	}
	var rs = coords.start;
	var re = coords.end;
	var before = html.substring(0, rs);
	var classAttr = annotations.join(' ');
	var span = $('<span />');
	for (var ann in annotations) {
		span.addClass(annotations[ann]);
	}
	var idstr = (id) ? id : "";
	span.attr("id", idstr);
	span.attr("title", classAttr);
	span.html(html.substring(rs, re));
	var after = html.substring(re);
	jdom.html(before + span.prop("outerHTML") + after);
}

Annotator.prototype.deleteAnnotation = function(jdom) {
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
	var spanTarget = null;
	for (var span in spans) {
		var skeletonHtml = elements[span] + elements[spans[span]];
		var skeletonContents = $('<div/>').html(skeletonHtml).contents();
		if (loc >= span && loc <= spans[span] &&
			(skeletonContents.hasClass('quote') ||
			skeletonContents.hasClass('mention'))) {
				remove = span;
				spanTarget = $('#' + skeletonContents.attr('id'));
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

			// if there is a connection associated with this span
			// we need to remove it also!
			// And we'll need to remove the connection id from whatever
			// span it was connected to...
			var spanId = spanTarget.attr('id');
			var connections = [];
			var classes = spanTarget.attr('class').split(' ');
			for (var i = 0; i < classes.length; i++) {
				if (classes[i].startsWith('connection_')) {
					connections.push(classes[i].split('_')[1]);
				}
			}

			for (var i = 0; i < connections.length; i++) {
				var connection = connections[i];
				// this could also be reversed
				var connectionId = '#' + spanId + '_' + connection;
				if (!$(connectionId).length) { // this span doesn't exist
				connectionId = '#' + connection + '_' + spanId;
				if (!$(connectionId).length) { // this span doesn't exist
				// look for an up and an over
				connectionId = '#' + connection + '_' + spanId + '_up';
				$(connectionId).remove();
				connectionId = '#' + spanId + '_' + connection + '_up';
				$(connectionId).remove();
				connectionId = '#' + connection + '_' + spanId + '_over';
				$(connectionId).remove();
				connectionId = '#' + spanId + '_' + connection + '_over';
			}
		}
		$(connectionId).remove();
		//now remove the connection class from the connected span
		$('#' + connection).removeClass('connection_' + spanId);
	}
}
this.updateSpanClicks();
};

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
			if (selected) { // *
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
	} else if ((sel = doc.selection) && sel.type != "Control") {
		var textRange = sel.createRange();
		var preCaretTextRange = doc.body.createTextRange();
		preCaretTextRange.moveToElementText(element);
		preCaretTextRange.setEndPoint("EndToEnd", textRange);
		caretOffset = preCaretTextRange.text.length;
	}
	return {
		"start": caretOffset,
		"end": caretOffset + end
	};
}

function unescapeSpans(html) {
	// TODO: maybe make this less hacky
	var unesc = html.replace(/&lt;span([^&]*)&gt;/g, "<span$1>");
	unesc = unesc.replace(/&lt;\/span&gt;/g, "<\/span>");
	return unesc;
}

// UI for managing annotation options
function AnnotationOptionsUI(params) {
	//this.jdom = params.jdom;
	this.jdom = $("<div />");
	this.jdom.attr("id", "annotationOpts");
	// Map of shortcut key code (same as event.which) to input element
	this.shortcuts = {};
	// Annotation opts
	this.annotationOpts = params.annotationOpts || {};
	this.selectDone = params.selectDone;
	this.groupSearchMin = (params.groupSearchMin != undefined) ? params.groupSearchMin : 6;
	this.nextCharacterId = 0;
	this.attachListeners();
}

AnnotationOptionsUI.prototype.addGroupSearch = function(group, min) {
	// Add a text field for filtering/selecting characters
	var scope = this;
	group.suggestions = Object.keys(this.annotationOpts)
	.filter(function(x) {
		return scope.annotationOpts[x].group === group.name;
	})
	.map(function(x) {
		var label = x.replace("speaker_", "");
		return {
			value: label,
			label: label,
			original: x
		};
	});
	if (group.suggestions.length <= min) {
		// Don't add search field (not that many options)
		return;
	}
	var textfield = $('<input/>').attr('type', 'text');
	textfield.autocomplete({
		source: group.suggestions,
		minLength: 0,
		select: function(event, ui) {
			var v = ui.item.original;
			var selection = $('input[name="' + group.name + '"][value="' + v + '"]');
			if (selection.length > 0) {
				selection.click();
				if (scope.selectDone) {
					scope.selectDone();
				}
			}
		},
		response: function(event, ui) {
			// Only show fields that are in our list of suggestions
			scope.showGroup(group, ui.content.map(function(x) {
				return x.original;
			}));
		}
	});
	function onNameEnter() {
		var v = textfield.val().trim();
		if (group.name === 'character') {
			v = "speaker_" + v;
		}
		var selection = $('input[name="' + group.name + '"][value="' + v + '"]');
		if (selection.length > 0) {
			selection.click();
			if (scope.selectDone) {
				scope.selectDone();
			}
		}
		return false;
	}
	//So that typing into the textbox doesn't trigger other keyboard shortcuts:
	textfield.bind('keypress', null, function() {
		event.stopPropagation();
		if (event.which == 13) { // enter
			onNameEnter();
		}
	}).change(onNameEnter);
	group.div.append(textfield);
};

AnnotationOptionsUI.prototype.showAll = function() {
	this.jdom.find('label').show();
};

AnnotationOptionsUI.prototype.showGroup = function(group, values) {
	var selection = this.jdom.find('input[name="' + group.name + '"]');
	selection.each(function(index, element) {
		element = $(element);
		var value = element.attr('value');
		if (values.indexOf(value) >= 0) {
			element.parent().show();
		} else {
			element.parent().hide();
		}
	});
};

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
		var btnClass = (allowsGroups[i] === 'spanType') ? 'btn-group' : 'btn-group-vertical';
		var div = $('<div/>').addClass(btnClass).attr('data-toggle', 'buttons').attr('role', 'group');

		groups[allowsGroups[i]] = {
			name: allowsGroups[i],
			div: div,
			text: groupNames[i]
		};

		var gdiv = $('<div/>').append($('<b></b>').append(groupNames[i])).append(div);
		this.jdom.append(gdiv);

		if (allowsGroups[i] === 'character') {
			this.addGroupSearch(groups[allowsGroups[i]], this.groupSearchMin);
		}
	}

	var scope = this;

	for (var name in this.annotationOpts) {

		var opt = this.annotationOpts[name];

		if (groups[opt.group]) {
			var div = groups[opt.group].div;
			var span = $('<label/>').addClass('btn').addClass(name);
			var input = $('<input/>').attr('type', 'radio').attr('name', opt.group).attr('value', name);
			var displayText = name.replace("speaker_", "");

			span.append(input);

			if (opt.shortcut) {
				this.shortcuts[opt.shortcut.charCodeAt(0)] = input;
				span.append('(' + opt.shortcut + ') ' + displayText);
			} else {
				span.append(displayText);
			}

			if (opt.title) {
				span.attr('title', opt.title);
			}

			div.append(span);

		} else {
			console.warn('Ignoring opt ' + name + ' in unknown group ' + opt.group);
		}
		// look for the max characterId that is being preloaded
		if (opt.group == 'character') {
			span.dblclick(function(event) {
				if (scope.selectDone) {
					scope.selectDone();
				}
			});
			var id = opt.id;
			if (id > maxId) {
				maxId = id;
			}
		}
	}
	this.nextCharacterId = maxId + 1;

	// Update our styles
	$("head style").remove();
	console.log("this.annotationOpts : ", this.annotationOpts);

	for (var name in this.annotationOpts) {
		var opt = this.annotationOpts[name];
		var css = (opt instanceof Object) ? opt.css : opt;
		// first split by ;
		if (!css) {
			console.warn("CSS property not set on character");
		}

		var cssRules = css.split(';');
		for (var rule in cssRules) {
			var str = cssRules[rule];
			if (str.length == 0) {
				continue;
			}
			$('<style>.' + CSS.escape(name) + ' { ' + str + ' }</style>').appendTo('head');
		}
	}
	// update the character list
	$("#entitydisplay div").remove();
	function getOrEmpty(x) {
		return (x != undefined) ? x : '';
	}

	for (var name in this.annotationOpts) {
		console.log("name : " , name);
		// if (name.startsWith('speaker_')) {
		if ( name === "mention" || name === "quote" ) {
			continue;
		}

		var entityDiv = $('<div/>');
		var data = this.annotationOpts[name].data;
		var prettyName = name.substring(8);
		var nameDiv = $('<div/>').addClass('name');
		var detailsDiv = $('<div/>').addClass('details');

		entityDiv.addClass(name);
		nameDiv.text(prettyName);

		detailsDiv.text(
			'gender: ' + getOrEmpty(data.gender) +
			'\ndescription: ' + getOrEmpty(data.description) +
			'\naliases: ' + getOrEmpty(data.aliases)
		);
		// Expand and hide details
		nameDiv.click(function(div) {
			div.toggle();
		}.bind(this, detailsDiv));
		//nameDiv.dblclick(function(div) { div.toggle(); }.bind(this, entityDiv));
		entityDiv.append(nameDiv).append(detailsDiv);
		$("#entitydisplay").append(entityDiv);
	}
};

	AnnotationOptionsUI.prototype.loadCharacterlist = function(e) {
		// console.log("Added event listener to : " , e.target);
		// const headers = new Headers();
		// const method = "GET";
		// const url = "../data/characters/austin_emma.characters.json"
		// headers.append('Accept', 'application/json');
		//
		// let options = {
		// 	headers,
		// 	method
		// }
		// let data = {
		//
		// 	data: {
		// 		aliases: "red",
		// 		id: 0,
		// 		name: "red"
		// 	},
		// 	group: "character",
		// 	id: 0,
		// 	name: "speaker_red",
		// 	shortcut: "0",
		// 	title: ""
		// }
		// let saverLoader = new Saver();
		// let promise = new Promise( (resolve, reject )=>{
		//
		// 	return saverLoader.loadAndReturnValue(e);
		// })
		// .then( (data)=>{
		// 	console.log("data : " , data);
		//
		// 	this.addCharacterToConfig(data);
		// })
		// let promise = Promise.resolve();
		// let data = ( e ) => {
		// 	return promise.then( ()=> saverLoader.loadAndReturnValue(e) )
		// }
		let file = e.target.files[0];
		console.log("file : ", file);
		// let fileData = new Blob( file );


		let loadFile = (resolve) => {
			var reader = new FileReader();
			reader.onload = () => {
				resolve(JSON.parse(reader.result));
			};
			reader.readAsText(file);
		}
		// console.log("saverLoader : " , saverLoader);

		let promise = new Promise(loadFile);
		promise.then((data) => {
			console.log("data : ", data.length);

			// let l = data.length;

			for (var i = 0; i < data.length; i++) {
				console.log("data : " , data[i]);
				this.addCharacterToConfig(data[i]);
			}
			// this.addCharacterToConfig(data);

			// data.map( character => { this.addCharacterToConfig(character) });

		})


		// 	fetch(url, options)
		// 		.then( response=> {
		// 			if (response.ok) {
		// 				return response.json();
		// 			}
		// 		})
		// 		.then( json=> {
		// console.log("json : " , json);
		// 			return json;
		// 		})
		// 		.catch( error=> {
		// 			throw error;
		// 		})

	}
	AnnotationOptionsUI.prototype.addCharacter = function() {
		// open add option modal
		var characterId = this.nextCharacterId;
		var nextColor = ts.getLightColor(characterId);
		var optionCssElem = $("#optioncss");
		var value = (nextColor) ? "background-color:" + nextColor + ';' : optionCssElem.attr('title') || '';

		optionCssElem.attr('value', value);
		this.displayTestOption();

		$("#addoptionmodal").modal({
			escapeClose: true,
			clickClose: true,
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
		$(window).on($.modal.CLOSE, function(e) {
			$(window).off('keypress');
		});
	};

	AnnotationOptionsUI.prototype.displayTestOption = function() {
		var val = $("#optioncss").val();
		$("#addtest p").attr("style", val);
	};

	// Places an underscore instead of a blankspace in the name
	function normalizeSpeakerName(name) {
		name = name.replace(/\s+/g, '_');
		name = name.replace('.', '');
		// prefix so that we can process/differentiate classes better!
		if (!name.startsWith('speaker_')) {
			name = 'speaker_' + name;
		}
		return name;
	}

	// Submit button for new Character submission in modal window
	AnnotationOptionsUI.prototype.submit = function() {
		// TODO: class name shouldn't have punctuation either
		var originalName = $("#optionname").val().trim();

		if (originalName.length > 0) {

			var name = normalizeSpeakerName(originalName);

			// Check that values are reasonable
			if (this.containsCharacter(name)) {
				// This annotation option already exists
				// Let's not allow adding
				ts.alert('Cannot add duplicate annotation: ' + name);
				return false;
			}

			var css = $("#optioncss").val();
			var data = {
				aliases: originalName
			};
			var character = {
				name: name,
				id: this.nextCharacterId,
				css: css,
				data: data
			};

			console.log("character : ", character);

			this.addCharacterToConfig(character);
			$('#addtest p').attr("style", "");
			if (this.nextCharacterId <= character.id) {
				// character id should have been updated in addCharacterToConfig
				// increment if not already incremented
				this.nextCharacterId = character.id + 1;
			}
		}
		$("#closeaddoption").click();
	};

	AnnotationOptionsUI.prototype.attachOptionsToDiv = function(parentDiv) {
		parentDiv.append(this.jdom);
	};

	AnnotationOptionsUI.prototype.addCharacterToConfig = function(character) {

		this.annotationOpts[character.name] = character;

		character.data = character.data || {};

		// In case there the title is missing
		if (!character.title) {
			var parts = [];
			if (character.data.aliases) {
				var aliases = character.data.aliases.split(';');
				var name = character.name.replace(/[._]+/g, ' ');
				// Look for aliases that are not included in the character name
				aliases = aliases.filter(function(alias) {
					alias = alias.replace(/[._]+/g, ' ');
					return name.indexOf(alias) < 0;
				});
				if (aliases.length > 0) {
					parts.push('Names: ' + aliases.join(','));
				}
			}
			if (character.data.description) {
				parts.push(character.data.description);
			}
			character.title = parts.join('\n');
		}
		character.data['id'] = character.id;
		character.data['name'] = character.name.startsWith('speaker_') ?
			character.name.substring('speaker_'.length) :
			character.name;
		character.group = 'character';

		// TODO: set correctly default css values
		if (!character.css) {
			// set a default color;
			character.css = "background-color:#ffbb78;"
		}

		if (character.id != undefined && character.id <= 9) {
			character.shortcut = character.id + "";
		}

		this.update();
	};

	AnnotationOptionsUI.prototype.containsCharacter = function(name) {
		return this.annotationOpts[name];
	};

	AnnotationOptionsUI.prototype.attachListeners = function() {
		// Annotation option stuff
		$("#addcharacter").click(this.addCharacter.bind(this));
		// this.savingUI.loadAndReturnValue.bind(this)
		$("#loadcharacterlist").change(this.loadCharacterlist.bind(this));
		$("#optioncss").keyup(this.displayTestOption.bind(this));
		$("#submitoption").click(this.submit.bind(this));
	};

	// Main annotator class
	function Annotator(annotationOpts) {
		this.annotationOptsUI = new AnnotationOptionsUI(
			{
				jdom: $('#annotationOpts'),
				annotationOpts: annotationOpts
			});
			this.spanType = 'quote';
			this.lastCharacter = undefined;
			this.nextSpanId = 0; // TOOD: update this when annotated file is loaded.
			this.selectedSpans = [];
			this.connectionTimes = [];
			this.allowConnections = true;
			this.savingUI = new Saver();
			this.ctrlDown = false;
			this.altDown = false;
			this.connectionNum = 0;
			this.errorChecker = new ErrorChecker();
			this.bouncer = new Enforcer();
		}


		Annotator.prototype.launch = function() {
			this.attachListeners();
			this.annotationOptsUI.update();

			if (this.allowConnections) {
				// Using jsPlumb from https://jsplumbtoolkit.com to connect elements
				jsPlumb.setContainer($("#annotationarea"));
				jsPlumb.importDefaults({
					Anchor: "Center",
					Connector: ["Bezier", {
						curviness: 30
					}],
					PaintStyle: {
						lineWidth: 4,
						strokeStyle: 'rgba(200,0,0,0.5)'
					},
					Endpoints: [["Dot", {
						radius: 4
					}], ["Dot", {
						radius: 4
					}]]
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
			$("#annotate").click(this.enterAnnotateMode.bind(this));
			$("#closespecific").click(this.resetSpecific.bind(this));
			// Saving
			$("#save").click(this.savingUI.save.bind(this));
			$("#saveconfig").click(this.savingUI.save.bind(this));
			// Loading
			$("#loadfiles").change(this.savingUI.load.bind(this));
			$("#loadconfig").change(this.savingUI.load.bind(this));
			// Error checking
			$("#checkconnections").click(this.errorChecker.checkConnections.bind(this));

			$(window).resize(function() {
				this.redrawConnections();
			}.bind(this));

		};

		Annotator.prototype.updateSpanIds = function() {
			var spans = $('#annotationarea pre span');
			var maxId = 0;
			for (var i = 0; i < spans.length; i++) {
				var targId = $(spans[i]).attr('id');
				// trim off the 's' that prepends it
				if (targId) {
					if (targId.startsWith('s')) {
						targId = parseInt(targId.substring(1), 10);
						if (targId > maxId) {
							maxId = targId;
						}
					} else {
						console.log("weirdly formatted id: " + targId);
					}
				}
			}
			this.nextSpanId = maxId + 1;
			this.ensureSpanIds();
		};

		Annotator.prototype.updateSpanClicks = function() {
			$("#annotationarea pre span").off('click');
			// listen to span clicks
			$("#annotationarea pre span").click(this.directSpanClicks.bind(this));
			$("#annotationarea pre span").mouseenter(this.hoverHighlight.bind(this));
			$("#annotationarea pre span").mouseleave(this.hoverUnhighlight.bind(this));
			// change pointer depending on tool
			$(window).keydown(this.pointerMagic.bind(this));
			$(window).keyup(this.pointerNormal.bind(this));
		};

		Annotator.prototype.pointerMagic = function(e) {
			if (e.altKey) {
				// delete the annotation
				this.altDown = true;
			} else if (e.metaKey || e.ctrlKey) {
				// do the connection
				this.ctrlDown = true;
			}
		};

		Annotator.prototype.pointerNormal = function(e) {
			this.altDown = false;
			this.ctrlDown = false;
		};

		Annotator.prototype.hoverHighlight = function(e) {
			if (this.altDown || this.ctrlDown) {
				return;
			}
			// this is the mouse entre function
			// now find everthing that this quote is "attached to" to highlight them too
			var connectionClass = '.connection_' + e.target.id;
			var connectedBits = $(connectionClass);
			for (var i = 0; i < connectedBits.length; i++) {
				$(connectedBits[i]).addClass('hover');
			}
			if (connectedBits.length > 0) {
				$('#' + e.target.id).addClass('hover');
			}
		};

		Annotator.prototype.hoverUnhighlight = function(e) {
			// this is the mouse exit function
			// now find everthing that this quote is "attached to" to highlight them too
			var connectionClass = '.connection_' + e.target.id;
			var connectedBits = $(connectionClass);
			for (var i = 0; i < connectedBits.length; i++) {
				$(connectedBits[i]).removeClass('hover');
			}
			$('#' + e.target.id).removeClass('hover');
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
					xtra = " zebra";
				}
				lineNums += "<span class=\"linenum" + xtra + "\">" + i + "</span>\n";
			}
			lineNums += "</pre>";
			$("#linenums").html(lineNums);

			// we want our boxes to scroll together
			$('#annotationarea').on('scroll', function() {
				$('#linenums').scrollTop($(this).scrollTop());
			});

			// listeners
			$("#annotationarea").mouseup(function(event) {
				if (!event.altKey) {
					this.openSpecificModal();
				}
			}.bind(this));
			// disable file loading
			$("#loadfiles").prop("disabled", true);
			$("#annotate").prop("disabled", true);
			$("#annotate").addClass("disabled");
			$("#annotate").css("background-color", "white");
			this.updateSpanIds();
			this.updateSpanClicks();
		};

		Annotator.prototype.ensureSpanIds = function() {
			// make sure that all spans have ids
			var spans = $("#annotationarea pre span");
			var spansById = {};
			for (var i = 0; i < spans.length; i++) {
				if ($(spans[i]).attr("id") == undefined) {
					$(spans[i]).attr("id", 's' + this.nextSpanId);
					console.warn("Assigning span id " + this.nextSpanId);
					this.nextSpanId++;
				} else if (spansById[$(spans[i]).attr("id")]) {
					// Duplicate id
					console.warn("You have duplicate span id " + $(spans[i]).attr("id"));
					//$(spans[i]).attr("id", 's' + this.nextSpanId);
					//this.nextSpanId++;
				}
				spansById[$(spans[i]).attr("id")] = $(spans[i]);
			}
		};

		Annotator.prototype.addCharactersFromXml = function($characters) {
			var children = $characters.children();
			for (var i = 0; i < children.length; i++) {
				var child = $(children[i]);
				var id = parseInt(child.attr("id"));
				// Name cleanup
				var name = "";
				if (child.attr("name") == undefined) {
					if (child.attr("aliases") == undefined) {
						console.warning("skipping character without name");
						console.log(child);
						continue;
					}
					name = child.attr("aliases").split(';')[0];
				} else {
					name = child.attr("name");
				}
				name = normalizeSpeakerName(name);
				// Keep other attribute from child
				var data = { };
				var attrs = child.prop("attributes");
				for (var j = 0; j < attrs.length; j++) {
					var $attr = $(attrs[j]);
					var attr = $attr[0].name;
					var val = $attr.val();
					if (attr !== 'name' && attr !== 'id') {
						data[attr] = val;
					}
				}
				var css = 'background-color: ' + ts.getLightColor(id);
				var character = {
					name: name,
					id: id,
					css: css,
					data: data
				};
				this.annotationOptsUI.addCharacterToConfig(character);
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
				clickClose: true,
				showClose: false
			});
			this.annotationOptsUI.showAll();
			this.annotationOptsUI.selectDone = function() {
				scope.closeSpecificModal(coords);
			};
			this.annotationOptsUI.attachOptionsToDiv($("#specificAnnotationOpts"));

			var scope = this;
			// Make sure the default spanType is selected
			$('input[name="spanType"][value="' + this.spanType + '"]').click();
			// Make sure last character is selected
			if (this.lastCharacter) {
				$('input[name="character"][value="' + this.lastCharacter + '"]').click();
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
					scope.annotationOptsUI.shortcuts[key].click();
				} else if (key == 13) {
					// 13 is return
					scope.closeSpecificModal(coords);
				}
			});

			$("#submitspecific").click(function(e) {
				scope.closeSpecificModal(coords);
			});
			$(window).on($.modal.CLOSE, function(e) {
				$(window).off('keypress');
				$("#submitspecific").off('click');
			});
		};

		Annotator.prototype.closeSpecificModal = function(coords) {
			var value = $('input[name="character"]:checked').val();
			var spanType = $('input[name="spanType"]:checked').val();
			this.spanType = spanType;
			this.lastCharacter = value;
			// now send the value to the thing doing the highlighting
			var spanId = 's' + this.nextSpanId;
			highlight(this, $('#annotationarea'), [spanType, value], coords, spanId);
			this.updateSpanClicks();

			this.enableConnectionClicks();
			this.nextSpanId++;
			$("#closespecific").click();
		};

		Annotator.prototype.connectClick = function(event) {
			if (event.metaKey || event.ctrlKey) { // command key, essentially
				var span = $("#" + event.target.id);
				var id = event.target.id;
				if (this.connectionTimes.length > 4) {
					this.connectionTimes.shift();
				}
				if (this.selectedSpans.indexOf(id) < 0 &&
				this.connectionTimes.indexOf(event.timeStamp) < 0 &&
				this.bouncer.enforceSpanTypes(this.selectedSpans, id)) {
					this.selectedSpans.push(id);
					this.connectionTimes.push(event.timeStamp);
					span.addClass('connectSelect');
					// if there is a click that is not on a span, stop trying to connect span one
					var ann = this;
					$(window).click(function(e) {
						if ($(e.target)[0].tagName !== 'SPAN' &&
						ann.selectedSpans.length > 0) {
							$("#" + ann.selectedSpans[0]).removeClass('connectSelect');
							ann.selectedSpans = [];
							$(window).off('click');
						}
					});
					if (this.selectedSpans.length === 2) {
						$("#" + this.selectedSpans[0]).addClass("connection_" + $("#" + this.selectedSpans[1]).attr('id'));
						$("#" + this.selectedSpans[1]).addClass("connection_" + $("#" + this.selectedSpans[0]).attr('id'));
						this.drawConnection($("#" + this.selectedSpans[0]), $("#" + this.selectedSpans[1]));
						$("#" + this.selectedSpans[0]).removeClass('connectSelect');
						$("#" + this.selectedSpans[1]).removeClass('connectSelect');
						$("#" + this.selectedSpans[0]).removeClass('missingConnection');
						$("#" + this.selectedSpans[1]).removeClass('missingConnection');
						this.selectedSpans = [];
						$(window).off('click');
					}
				} else {
					console.log('Selected spans already contain span or span doesn\'t match already selected');
				}
			}
		};

		Annotator.prototype.enableConnectionClicks = function() {
			if (this.allowConnections) {
				var spans = $('#annotationarea span');
				spans.css('cursor', 'default');
				this.updateSpanClicks();
			}
		};

		Annotator.prototype.hasClassStartsWith = function($el, target) {
			var classes = $el.attr("class").split(' ');
			for (var i = 0; i < classes.length; i++) {
				if (classes[i].startsWith(target)) {
					return classes[i];
				}
			}
			return null;
		};

		Annotator.prototype.redrawConnections = function() {
			// Update position of connections
			// clear current connections
			$('.connection').remove();
			$('.upConnect').remove();
			$('.overConnect').remove();
			this.connectionNum = 0;
			// redraw connections
			this.updateConnections();
		};

		Annotator.prototype.updateConnections = function() {
			// get all spans
			var spans = $("#annotationarea pre span.quote");
			// for each span with an annotated connection, connect it to its friend
			for (var i = 0; i < spans.length; i++) {
				var span = $(spans[i]);
				var connectionClass = this.hasClassStartsWith(span, 'connection_');
				if (connectionClass == null || connectionClass === 'connection_') {
					continue;
				}
				var connectedId = connectionClass.split('_')[1];
				var connectedSpan = $("#" + connectedId);
				// just to be doubly sure
				connectedSpan.addClass('connection_' + span.attr('id'));
				if (connectedSpan[0] == undefined) {
					ts.alert("Span " + span.attr("id") + " connected to " + connectedId + " which doesn't exist");
					continue;
				}
				this.drawConnection(span, connectedSpan);
			}
		};

		Annotator.prototype.drawConnection = function(span1, span2) {
			var connectionS1 = 'connection_' + span1.prop('id');
			var connectionS2 = 'connection_' + span2.prop('id');
			var s1Left = span1.prop("offsetLeft");
			var s1Top = span1.prop("offsetTop");
			var s2Left = span2.prop("offsetLeft");
			var s2Top = span2.prop("offsetTop");
			var rightSpan = null;
			var leftMostSpan = null;
			if (s1Left < s2Left) {
				leftMostSpan = span1;
				rightSpan = span2;
			} else {
				leftMostSpan = span2;
				rightSpan = span1;
			}
			var bottomSpan = null;
			var topMostSpan = null;
			if (s1Top < s2Top) {
				topMostSpan = span1;
				bottomSpan = span2;
			} else {
				topMostSpan = span2;
				bottomSpan = span1;
			}
			// we also want to select slightly varying colors
			var connectionColor = ts.getConnectionColor(this.connectionNum);
			var widthDiv = Math.abs(s1Left - s2Left);
			var heightDiv = Math.abs(s1Top - s2Top);
			var leftOffset = (this.connectionNum % 10) * 2;
			if (Math.abs(s1Top - s2Top) < 10) {
				heightDiv = 10;
				var div = $('<div/>');
				div.addClass('connection');
				div.addClass("flat");
				div.css({
					height: (heightDiv - 10) + "px",
					width: widthDiv + "px",
					top: (topMostSpan.prop("offsetTop") - 4) + "px",
					left: (leftMostSpan.prop("offsetLeft") + leftOffset) + "px",
					"border-color": connectionColor + " " + connectionColor + " transparent " + connectionColor
				});
				div.click(this.deleteConnection);
				div.attr("id", span1.attr("id") + "_" + span2.attr("id"));
				div.addClass(connectionS1);
				div.addClass(connectionS2);
				$("#annotationarea").append(div);
			} else {

				var divOver = $('<div />');
				divOver.addClass("overConnect");
				var divUp = $('<div />');
				divUp.addClass("upConnect");

				if (leftMostSpan == topMostSpan) { // the left span is also above
					divUp.css({
						height: (heightDiv - 5) + "px",
						width: "4px",
						top: (leftMostSpan.prop("offsetTop") + (leftMostSpan.height() - 4)) + "px",
						left: (leftMostSpan.prop("offsetLeft") + leftOffset) + "px",
					});
					divOver.css({
						height: "2px",
						width: widthDiv + "px",
						top: (bottomSpan.prop("offsetTop") + 4) + "px",
						left: (leftMostSpan.prop("offsetLeft") + leftOffset) + "px",
					});
				} else {
					divUp.css({
						height: heightDiv + "px",
						width: "4px",
						top: (rightSpan.prop("offsetTop") + 4) + "px",
						left: (leftMostSpan.prop("offsetLeft") + leftOffset) + "px",
					});
					divOver.css({
						height: "2px",
						width: widthDiv + "px",
						top: (rightSpan.prop("offsetTop") + 4) + "px",
						left: (leftMostSpan.prop("offsetLeft") + leftOffset) + "px",
					});
				}
				divUp.css({
					'background-color': connectionColor
				});
				divOver.css({
					'background-color': connectionColor
				});
				divUp.click(this.deleteConnection);
				divUp.attr("id", span1.attr("id") + "_" + span2.attr("id") + '_up');
				divOver.click(this.deleteConnection);
				divOver.attr("id", span1.attr("id") + "_" + span2.attr("id") + '_over');
				divUp.addClass(connectionS1);
				divUp.addClass(connectionS2);
				divOver.addClass(connectionS1);
				divOver.addClass(connectionS2);
				$("#annotationarea").append(divUp);
				$("#annotationarea").append(divOver);
			}
			this.connectionNum++;
		};

		Annotator.prototype.deleteConnection = function(e) {
			if (e.altKey) {
				var id = e.target.id.split('_');
				$("#" + id[0]).removeClass('connection_' + id[1]);
				$("#" + id[1]).removeClass('connection_' + id[0]);
				$(e.target).remove();
				// if this is an up/over connection, also remove the sister
				var sister = null;
				if (e.target.id.endsWith('_up')) {
					sister = id[0] + '_' + id[1] + '_over';
				} else if (e.target.id.endsWith('_over')) {
					sister = id[0] + '_' + id[1] + '_up';
				}
				if (sister != null) {
					$("#" + sister).remove();
				}
			}
		};

		Annotator.prototype.resetSpecific = function() {
			var ele = $('input[name="character"]');
			for (var i = 0; i < ele.length; i++) {
				ele[i].checked = false; // hack that depends on default value being last
			}
		};

		Annotator.prototype.openEditModal = function(e) {
			var span = $("#" + e.target.id);
			$("#editAnnotation").modal({
				escapeClose: true,
				clickClose: true,
				showClose: false
			});
			this.annotationOptsUI.showAll();
			this.annotationOptsUI.selectDone = function() {
				scope.closeEditModal(span);
			};
			this.annotationOptsUI.attachOptionsToDiv($("#editAnnotationOpts"));

			var scope = this;
			// Make sure the default spanType is selected
			$('input[name="spanType"][value="' + this.spanType + '"]').click();
			// Make sure last character is selected
			if (this.lastCharacter) {
				$('input[name="character"][value="' + this.lastCharacter + '"]').click();
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
					scope.annotationOptsUI.shortcuts[key].click();
				} else if (key == 13) {
					// 13 is return
					scope.closeEditModal(span);
				}
			});

			$("#submitedit").click(function(e) {
				scope.closeEditModal(span);
			});
		};

		Annotator.prototype.closeEditModal = function(span) {
			var value = $('input[name="character"]:checked').val();
			var spanType = $('input[name="spanType"]:checked').val();
			this.spanType = spanType;
			this.lastCharacter = value;
			// first remove any problematic classes
			// TODO: make this less hacky
			var classes = span.attr("class").split(' ');
			for (var i = 0; i < classes.length; i++) {
				if (classes[i].startsWith("speaker_") ||
				classes[i] === 'quote' ||
				classes[i] === 'mention') {
					span.removeClass(classes[i]);
				}
			}
			span.addClass(value);
			span.addClass(spanType);
			$("#closeedit").click();
			$(window).off('keypress');
			$("#submitedit").off('click');
		};

		Annotator.prototype.directSpanClicks = function(e) {
			if (e.altKey) {
				// delete the annotation
				this.deleteAnnotation($("#annotationarea"));
			} else if (e.metaKey || e.ctrlKey) {
				// do the connection
				this.connectClick(e);
			} else {
				// open the edit modal
				// egads, if it was a highlight, we want to make a new span instead!
				var coords = getHighlightSpan($("#annotationarea"));
				if (coords == null) {
					this.openEditModal(e);
				}
			}
		};
