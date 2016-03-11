var annotationOpts = {
  mention : "border: 4px dashed black;",
};

for (var opt in annotationOpts) {
    var css = annotationOpts[opt];
    // first split by ;
    var cssRules = css.split(';');
    for (var rule in cssRules) {
      var str = cssRules[rule];
      if (str.length == 0) {
        continue;
      }
      $('<style>.' + opt + ' { ' + str + ' }</style>').appendTo('head');
   }
}
