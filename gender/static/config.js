$(window).load(function() {
  var annotationOpts = {
    FEMALE : "border: 4px dashed black;",
    MALE : "border: 4px solid black;",
    UNKNOWN : "border: 4px dotted gray;",
    NONE : "border: none;",
  };

  var annotator = new Annotator(annotationOpts);
  annotator.launch();
});

