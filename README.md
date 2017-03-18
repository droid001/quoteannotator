Quote Annotator
===============

This is a small annotation tool that allows you to annotate quotes in texts and the speakers that they are linked to. It supports the [QuoteLi](https://nlp.stanford.edu/~muzny/quoteli.html) project.

It allows for multi-line annotation and has some small safeguards in place.

If you use this tool please cite the following paper:

Grace Muzny, Michael Fang, Angel Fang and Dan Jurafsky. A Two-stage Sieve Approach to Quote Attribution. In Proceedings of the *European Chapter of the Association for Computational Linguistics* (EACL), 2017, Valencia, Spain.

The main project page 

Usage
-----

This tool currently only supports client-side annotation. To use, open `characters/index.html` in a browser. Here, you can either enter text in the text box, then click `Annotate` or load a file for annotation. More detailed instructions are also found on this webpage.

If you choose to load a file, any annotations that are already present in that file will be preserved.

Adding Quotes/Mentions
----------------------

To add a quote or mention, highlight a span of text, then choose whether it is a quote or a mention. You can also assign a `character` to the quote/mention as this point, or edit at a later point simply by clicking on the span and editting its attributes.

To delete a quote, mention, or connect, alt+click on it.

To connect a quote to a mention span (or vice versa), ctrl+click on the first span, then ctrl+click on the second span. If you are using a mac, these key bindings will be command+click.


Adding Characters
-----------------

To add a character, click the `Add Character` button, which will make your character available from now on.

Saving
------

To save, click the save button, which will download an xml file to your computer. You can re-load your saved file at any point and all characters and annotations will be loaded into the tool.
