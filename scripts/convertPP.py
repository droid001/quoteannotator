#!/usr/bin/env python
#
# Convert pride and prejudice annotations to our format

import argparse
import collections
import xml
import os
import sys
import logging
import traceback

FORMAT = '%(asctime)-15s [%(levelname)s] %(message)s'
logging.basicConfig(format=FORMAT)
log = logging.getLogger('index')
log.setLevel(logging.INFO)

def textToChapters(lines):
    # Organize lines into chapters
    chapters = []
    current = []
    for line in lines:
        if line.startswith('CHAPTER'):
            if len(current) > 0:
                chapters.append(current)
                current = []
            current.append(line)
    if len(current) > 0:
        chapters.append(current)
    return chapters

def convert(input, output):
    print input
    print output
    charfile = os.path.join(input, 'PeopleList_Revised.txt')
    textfile = os.path.join(input, 'PRIDPREJ_NONEWLINE_Organize_v2.txt')
    annfile = os.path.join(input, 'REAL_ALL_CONTENTS_PP.txt')
    # slurp in our inputs
    with open(charfile) as x: characters = x.readlines()
    with open(textfile) as x: text = x.readlines()
    with open(annfile) as x: annotations = x.readlines()
    print '# characters: ' + str(len(characters))
    print '# quotes: ' + str(len(annotations))
    print '# lines: ' + str(len(text))
    chapters = textToChapters(text)
    print '# chapters: ' + str(len(chapters))


def main():
    # Argument processing
    parser = argparse.ArgumentParser(description='Convert Pride and Prejudice')
    parser.add_argument('indir', help='directory to use', action='store')
    parser.add_argument('outfile', nargs='?', type=argparse.FileType('w'),
                        default=sys.stdout)
    args = parser.parse_args()
    convert(args.indir, args.outfile);

if __name__ == "__main__": main()