$(window).load(function() {
  var annotationOpts = {
    mention: "border: 4px dashed black;"
//  mention : { css: "border: 4px dashed black;", group: 'spanType' },
//  quote : { css: "border: none;", group: 'spanType' }
  };

  var annotator = new Annotator(annotationOpts);
  annotator.launch();
});
