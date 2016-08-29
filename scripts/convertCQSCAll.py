#!/usr/bin/env python
#
# Convert Columbia Quote Speech Corpus xml to our format

import argparse
import re
import os
import sys
import logging
import traceback

import convertCQSC as cqsc

FORMAT = '%(asctime)-15s [%(levelname)s] %(message)s'
logging.basicConfig(format=FORMAT)
log = logging.getLogger('index')
log.setLevel(logging.INFO)

def main():
    # Argument processing
    parser = argparse.ArgumentParser(description='Convert CQSC XML')
    parser.add_argument('-s', '--split', dest='splitChapters', help='split by chapter', action='store_true')
    parser.add_argument('-p', dest='includeSectionTags', help='paragraphs and headings', action='store_true')
    parser.add_argument('-n', dest='extractNestedQuotes', help='exract nested quotes', action='store_true')
    parser.add_argument('indir', help='directory to use', action='store')
    args = parser.parse_args()

    files = cqsc.readlines(args.indir + '/files.txt')
    for file in files:
        filename = args.indir + "/" + file
        (base,ext) = os.path.splitext(filename)
        match = re.match(r"(.*)_(\d+)", base)
        if match:
            base = match.group(1)
        charactersFile = base + ".characters.json"
        if not os.path.isfile(charactersFile):
            charactersFile = None
        print "convert " + filename + " with characters " + str(charactersFile)
        if args.splitChapters:
            base2 = os.path.basename(base)
            outbase = args.indir + "/converted_split/" + base2
            outfile = outbase + "/" + file
        else:
            outbase = args.indir + "/converted/"
            outfile = outbase + file
        if not os.path.exists(outbase):
            os.makedirs(outbase)
        try:
            cqsc.convertMentionLevels(filename, outfile, charactersFile, args.splitChapters, args.includeSectionTags, args.extractNestedQuotes)
        except:
            log.error("Unexpected error processing " + filename + ": ", exc_info=True)

if __name__ == "__main__": main()