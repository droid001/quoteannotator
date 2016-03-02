var annotationOpts = {
  FEMALE : "border: 4px dashed black;",
  MALE : "border: 4px solid black;",
  UNKNOWN : "border: 4px dotted gray;",
  NONE : "border: none;",
};

for (var opt in annotationOpts) {
    var css = annotationOpts[opt];
    // first split by ;
    var cssRules = css.split(';');
    for (rule in cssRules) {
      var str = cssRules[rule];
      if (str.length == 0) {
        continue;
      }
      $('<style>.' + opt + ' { ' + str + ' }</style>').appendTo('head');
   }
}
