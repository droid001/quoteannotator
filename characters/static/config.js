$(window).load(function() {
  var annotationOpts = {
    mention : { name: 'mention', css: "border: 4px dashed black;", group: 'spanType' },
    quote : { name: 'quote', css: "border: none;", group: 'spanType' }
  };

  var annotator = new Annotator(annotationOpts);
  annotator.launch();
});
