Here are a bunch of scripts to preprocess and postprocess our quote data.

Preprocessing:
-------------
- characterListToJson.py: Convert character list in the Pride and Prejudice txt format to a json file (not needed now that our character lists are converted)
    To run: ./characterListToJson.py <infile> <outfile>

- convertPP.py: Convert the Pride and Prejudice Corpus into format used by the Quote Annotation UI
    To run: ./convertPP.py -s <pp corpus dir>

- convertCQSC.py
  convertCQSCAll.py : Converts the Columbia Quoted Speech Corpus into format used by the Quote Annotation UI
    Split chapters (with nested quotes):
      To run: ./convertCQSCAll.py -n -s <corpusdir>
    Not split (with nested quotes, takes a while, not efficient):
      To run: ./convertCQSCAll.py -n <corpusdir>

Postprocessing:
--------------
- assembleParts.py : Puts back split pieces into one big file. 
  It also performs data validation checks and prints out some statistics about the number of quotes and linked mentions.
  To run:
    1. Prepare annotated pieces by putting them into a directory: <dir>
    2. Make sure the pieces are named as follows: xxxx-<partnum>-xxx.xml
    3. To run: ./assembleParts.py -p -c <charactersFile> <dir>
  This script uses fuzzywuzzy to do some fuzzy string matching for characters.
  You may need to do 'pip install fuzzywuzzy' before running the script
- assemblePartsAll.py : Runs assembleParts.py over a several directory
  To use for getting statistics from the Columbia Quoted Speech Corpus:
    assemblePartsAll.py -f '^.*\.direct.xml$' -p converted_split outdir
- compareAnnotations.py : Compare our annotations with original annotations
  Use on assembled files
    compareAnnotations.py -q <file of common quotes> <our file> <merged converted file>
