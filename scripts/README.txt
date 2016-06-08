Here are a bunch of scripts to preprocess and postprocess our quote data.

Preprocessing:
-------------
- characterListToJson.py: Convert character list in the Pride and Prejudice txt format to a json file (not needed now that our character lists are converted)
    To run:
- convertPP.py: Convert the Pride and Prejudice Corpus into format used by the Quote Annotation UI
    To run:

- convertCQSC.py
  convertCQSCAll.py : Converts the Columbia Quoted Speech Corpus into format used by the Quote Annotation UI
    To run: ./convertCQSCAll.py -n -s <corpusdir>

Postprocessing:
--------------
- assembleParts.py : Puts back split pieces into one big file