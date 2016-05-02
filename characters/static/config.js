$(window).load(function() {
  var annotationOpts = {
    mention : { name: 'mention', css: "border: 4px dashed black;", group: 'spanType', shortcut: 'm' },
    quote : { name: 'quote', css: "border: none;", group: 'spanType', shortcut: 'q' }
  };

  var annotator = new Annotator(annotationOpts);
  annotator.launch();
  pageAnn = annotator;
});

var pageAnn = null;
