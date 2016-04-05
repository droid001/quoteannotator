#!/usr/bin/env python
#
# Convert pride and prejudice annotations to our format

import argparse
import collections
import xml
import os
import re
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
                chapters.append( { 'text': current } )
                current = []
        current.append(line)
    if len(current) > 0:
        chapters.append({ 'text': current })
    return chapters

def readlines(input):
    lines = []
    with open(input) as x:
        for line in x:
            line = line.strip()
            if len(line):
                lines.append(line)
    return lines

def convert(input, output):
    print input
    print output
    charfile = os.path.join(input, 'PeopleList_Revised.txt')
    textfile = os.path.join(input, 'PRIDPREJ_NONEWLINE_Organize_v2.txt')
    annfile = os.path.join(input, 'REAL_ALL_CONTENTS_PP.txt')
    # slurp in our inputs
    #with open(charfile) as x: characters = x.readlines()
    #with open(textfile) as x: text = x.readlines()
    #with open(annfile) as x: annotations = x.readlines()
    characters = readlines(charfile)
    text = readlines(textfile)
    annotations = readlines(annfile)
    print '# characters: ' + str(len(characters))
    print '# quotes: ' + str(len(annotations))
    print '# lines: ' + str(len(text))
    chapters = textToChapters(text)
    print '# chapters: ' + str(len(chapters))
    # Initialize chapters for processing
    #quote_pattern = re.compile('``.*''')
    for chapter in chapters:
        #print len(chapter['text'])
        # Look for multiline quotes
        inQuotes = False
        quoted = []
        startIndex = -1
        multilineQuotes = []
        for li, line in enumerate(chapter['text']):
            qsi = line.find("``")
            qei = line.find("''")
            if (qsi >= 0 and qei < 0):
                inQuotes = True
                startIndex = li
                quoted.append(line)
            elif (qei >= 0 and qsi < 0):
                inQuotes = False
                quoted.append(line)
                quote = " ".join(quoted)
                # Strip any inner quotes
                quote = quote.replace("'' -- ``", ' ')
                #quote = quote.replace("''", '')
                #quote = quote.replace("--", '')
                multilineQuotes.append( {
                    'quote': quote,
                    'quoteLines': quoted,
                    'span': [startIndex, li+1]
                })
                startIndex = -1
                quoted = []
            #elif (qei < 0 and qsi < 0):
            else:
                if inQuotes:
                    quoted.append(line)
        chapter['mulitlineQuotes'] = multilineQuotes
        mqIndex = {}
        for mqi,mq in enumerate(multilineQuotes):
            for li in range(mq['span'][0], mq['span'][1]):
                mqIndex[li] = mq
        chapter['mulitlineQuotesByLine'] = mqIndex
        # Set index
        chapter['_nextIndex'] = 0
    # Try to match annotations with the text
    for ai, annstr in enumerate(annotations):
        ann = annstr.split('\t')
        ch = int(ann[0])
        speaker = ann[1]
        quote = ann[2]
        chapter = chapters[ch-1]
        mqIndex = chapter['mulitlineQuotesByLine']
        startIndex = chapter['_nextIndex'];
        pieces = re.split('\s*\[X\]\s*', quote)
        escaped = map(re.escape, pieces)
        regex = '(' + '.*'.join(escaped) + ')'
        pattern = re.compile(regex)
        matched = False
        for i in range(startIndex, len(chapter['text'])):
            # Try to match quote to text
            line = chapter['text'][i]
            if i in mqIndex:
                mulitlineQuote = mqIndex[i]
                line = mulitlineQuote['quote']
                print line
                print quote
            #print regex
            #print line
            m = pattern.search(line)
            if m:
                print 'matched %d to chapter %d:%d' % (ai, ch, i)
                matched = True
                chapter['_nextIndex'] = i+1
                break
        if not matched:
            print 'unmatched ' + annstr



def main():
    # Argument processing
    parser = argparse.ArgumentParser(description='Convert Pride and Prejudice')
    parser.add_argument('indir', help='directory to use', action='store')
    parser.add_argument('outfile', nargs='?', type=argparse.FileType('w'),
                        default=sys.stdout)
    args = parser.parse_args()
    convert(args.indir, args.outfile);

if __name__ == "__main__": main()