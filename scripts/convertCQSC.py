#!/usr/bin/env python
#
# Convert Columbia Quote Speech Corpus xml to our format

import argparse
import os
import sys
import logging
import traceback

import xml.etree.ElementTree as ET

FORMAT = '%(asctime)-15s [%(levelname)s] %(message)s'
logging.basicConfig(format=FORMAT)
log = logging.getLogger('index')
log.setLevel(logging.INFO)

def convert(input, output):
    print input
    print output
    nertypes = ['PERSON', 'ORGANIZATION', 'LOCATION']
    tree = ET.parse(input)
    root = tree.getroot()
    # Process paragraphs    
    entities = {}
    for paragraph in root.iter('PARAGRAPH'):
        for nertype in nertypes:
            for mention in paragraph.iter(nertype):
                mention.tag = 'MENTION'
                mention.set('entityType', nertype)
                entityId = mention.get('entity')
                if not entityId in entities:
                    # if would be great if the entities had names
                    entities[entityId] = {
                        'id': entityId,
                        'entityType': nertype,
                        'gender': mention.get('gender')
                    }
    # Add characters
    characters = ET.fromstring('<CHARACTERS></CHARACTERS>')
    for entityId, entity in entities.iteritems():
        if entity['entityType'] == 'PERSON':
            ET.SubElement(characters, 'CHARACTER', entity) 
    # Wrap headings and paragraphs in text tag
    newdoc = ET.fromstring('<DOC></DOC>')
    root.tag = 'TEXT'
    newdoc.append(characters)
    newdoc.append(root)
    tree._setroot(newdoc)
    tree.write(output)

def main():
    # Argument processing
    parser = argparse.ArgumentParser(description='Convert CQSC XML')
    parser.add_argument('infile', nargs='?', type=argparse.FileType('r'),
                        default=sys.stdin)
    parser.add_argument('outfile', nargs='?', type=argparse.FileType('w'),
                        default=sys.stdout)
    args = parser.parse_args()
    convert(args.infile, args.outfile);

if __name__ == "__main__": main()