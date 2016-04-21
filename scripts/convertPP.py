#!/usr/bin/env python
#
# Convert pride and prejudice annotations to our format

import argparse
import os
import re
import sys
import logging
import traceback

import xml.dom.minidom as minidom

FORMAT = '%(asctime)-15s [%(levelname)s] %(message)s'
logging.basicConfig(format=FORMAT)
log = logging.getLogger('index')
log.setLevel(logging.INFO)

def mapGender(gender):
    if gender == 'M':
        return 'male'
    elif gender == 'F':
        return 'female'
    else:
        return 'unknown'

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

def writeXml(filename, characters, chapters, includeSectionTags):
    with open(filename, 'w') as output:
        output.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        output.write('<doc>\n')
        output.write('<characters>\n') 
        for index, character in enumerate(characters):
            output.write(
                '<character id="{0}" name="{1}" gender="{2}" aliases="{3}">'
                .format(index, character['name'], character['gender'], ';'.join(character['aliases'])))
            output.write('</character>\n')
        output.write('</characters>\n')
        output.write('<text>\n') 
        for chapter in chapters:
            for line in chapter['xml']:
                tag = 'paragraph'
                if line.startswith('CHAPTER'):
                    tag = 'heading'
                if includeSectionTags:
                    output.write('<' + tag + '>')
                output.write(line)
                if includeSectionTags:
                    output.write('</' + tag + '>')
                output.write('\n\n')
        output.write('</text>')
        output.write('</doc>\n')

def convertToXml(filename, characters, chapters, splitChapters, includeSectionTags):
    impl = minidom.getDOMImplementation()

    for chapter in chapters:
        textlines = chapter['text']
        mqIndex = chapter['mulitlineQuotesByLine']
        speakersByLine = chapter['speakersByLine']
        chapter['xml'] = []
        for li, line in enumerate(textlines):
            lineXml = line
            if li in speakersByLine:
                # Special skipping (n)
                if li in mqIndex and line.find("'' -- ``") >= 0:
                    print 'skipping replacing inner quotes for multiline quote on line %d' % (li) 
                else:
                    speaker = speakersByLine[li]
                    lineXml = lineXml.replace("``", '<quote speaker="' + speaker + '">``')
                    lineXml = lineXml.replace("''", "''</quote>")
            lineXml = lineXml.replace("&", "&amp;")
            lineXml = lineXml.replace("``", "&quot;")
            lineXml = lineXml.replace("''", "&quot;")
            lineXml = lineXml.replace("'", "&apos;")
            chapter['xml'].append(lineXml)

    if splitChapters:
        (base, ext) = os.path.splitext(filename)
        for chindex, chapter in enumerate(chapters):
            chfile = base + '-' + str(chindex) + ext
            writeXml(chfile, characters, [chapter], includeSectionTags)
    else:
        writeXml(filename, characters, chapters, includeSectionTags)

def strToCharacter(str):
    fields = str.split(';')
    aliases = [fields[0]] + fields[2:]
    return { 'name': fields[0].replace(' ', '_'), 'gender': mapGender(fields[1]), 'aliases': aliases}

def convert(input, outfilename, splitChapters, includeSectionTags):
    charfile = os.path.join(input, 'PeopleList_Revised.txt')
    textfile = os.path.join(input, 'PRIDPREJ_NONEWLINE_Organize_v2.txt')
    annfile = os.path.join(input, 'REAL_ALL_CONTENTS_PP.txt')
    # slurp in our inputs
    #with open(charfile) as x: characters = x.readlines()
    #with open(textfile) as x: text = x.readlines()
    #with open(annfile) as x: annotations = x.readlines()
    characters = readlines(charfile)
    characters = map(strToCharacter, characters)
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
            elif (qsi >= 0 and line.startswith("``It was greatly my wish")):
                inQuotes = True
                startIndex = li
                quoted.append(line)
            elif (qei >= 0 and qsi < 0):
              if inQuotes:  
                inQuotes = False
                quoted.append(line)
                quote = " ".join(quoted)
                # Strip any inner quotes
                quote = quote.replace("'' -- ``", ' ')
                multilineQuotes.append( {
                    'quote': quote,
                    'quoteLines': quoted,
                    'span': [startIndex, li+1]
                })
                startIndex = -1
                quoted = []
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
        chapter['speakersByLine'] = {}
    # Try to match annotations with the text
    for ai, annstr in enumerate(annotations):
        ann = annstr.split('\t')
        ch = int(ann[0])
        speaker = ann[1]
        speaker = speaker.replace(' ', '_')
        quote = ann[2]
        quote = quote.replace('  ', ' ')
        chapter = chapters[ch-1]
        mqIndex = chapter['mulitlineQuotesByLine']
        speakersByLine = chapter['speakersByLine']
        debug = False
        startIndex = chapter['_nextIndex'];
        if ai == 452:
            quote = quote.replace(' apology, Hunsford, Lady Catherine de Bourgh.', '') 
        elif quote == 'delightful, charming,':
            quote = 'delightful, [X] charming,'
        pieces = re.split('\s*\[X\]\s*', quote)
        escaped = map(re.escape, pieces)
        escaped = [x.replace('\ ', '\s+') for x in escaped]
        regex = '(``' + ')(.*)('.join(escaped) + "'')"
        pattern = re.compile(regex)
        matched = False
        for i in range(startIndex, len(chapter['text'])):
            # Try to match quote to text
            line = chapter['text'][i]
            mulitlineQuote = None
            if i in mqIndex:
                mulitlineQuote = mqIndex[i]
                line = mulitlineQuote['quote']
            if debug:
                print i
                print line
                print quote
            m = pattern.search(line)
            if m:
                #print 'matched %d to chapter %d:%d' % (ai, ch, i)
                if i in speakersByLine and not speakersByLine[i] == speaker:
                    print 'line %d already has speaker %s' % (i, speakersByLine[i])
                speakersByLine[i] = speaker
                if mulitlineQuote:
                    span = mulitlineQuote['span']
                    for j in range(span[0], span[1]):
                        speakersByLine[j] = speaker
                    chapter['_nextIndex'] = span[1]
                else:
                    chapter['_nextIndex'] = i+1
                matched = True
                break
        if not matched:
            print 'unmatched ' + annstr
    convertToXml(outfilename, characters, chapters, splitChapters, includeSectionTags)

def main():
    # Argument processing
    parser = argparse.ArgumentParser(description='Convert Pride and Prejudice')
    parser.add_argument('-s', '--split', dest='splitChapters', help='split by chapter', action='store_true')
    parser.add_argument('-p', dest='includeSectionTags', help='paragraphs and headings', action='store_true')
    parser.add_argument('indir', help='directory to use', action='store')
    parser.add_argument('outfile')
    args = parser.parse_args()
    convert(args.indir, args.outfile, args.splitChapters, args.includeSectionTags)

if __name__ == "__main__": main()
