#!/usr/bin/env python
#
# Convert Columbia Quote Speech Corpus xml to our format

import argparse
import os
import sys
import logging
import traceback

import xml.dom.minidom as minidom
from sets import Set

FORMAT = '%(asctime)-15s [%(levelname)s] %(message)s'
logging.basicConfig(format=FORMAT)
log = logging.getLogger('index')
log.setLevel(logging.INFO)

def mapGender(gender):
    return gender

def get_all_text( node ):
    if node.nodeType ==  node.TEXT_NODE:
        return node.data
    else:
        text_string = ""
        for child_node in node.childNodes:
            text_string += get_all_text( child_node )
        return text_string

def lowercaseTags( node ):
    if node.nodeType ==  node.ELEMENT_NODE:
        node.tagName = node.tagName.lower()
    for child_node in node.childNodes:
        lowercaseTags(child_node)

def convert(input, output, mentionLevel):
    #print input
    #print output
    nertypes = ['PERSON', 'ORGANIZATION', 'LOCATION']
    dom = minidom.parse(input)
    root = dom.documentElement
    # Process paragraphs    
    entities = {}
    mentionIdToEntityId = {}
    for paragraph in root.getElementsByTagName('PARAGRAPH'):
        for nertype in nertypes:
            for mention in paragraph.getElementsByTagName(nertype):
                mention.tagName = 'MENTION'
                mention.setAttribute('entityType', nertype)
                entityId = mention.getAttribute('entity')
                mentionId = mention.getAttribute('id')
                if not entityId in entities:
                    # it would be great if the entities had names
                    entities[entityId] = {
                        'id': entityId,
                        'entityType': nertype,
                        'gender': mapGender(mention.getAttribute('gender')),
                        'aliases': Set()
                    }
                name = get_all_text(mention)
                entities[entityId]['aliases'].add(name)
                mentionIdToEntityId[mentionId] = entityId
    # Add characters
    entityElementsByType = {
        'PERSON': { 'elements': dom.createElement('CHARACTERS'), 'name': 'CHARACTER'},
        'LOCATION': { 'elements': dom.createElement('LOCATIONS'), 'name': 'LOCATION'},
        'ORGANIZATION': { 'elements': dom.createElement('ORGANIZATIONS'), 'name': 'ORGANIZATION'},
    }
    for entityId, entity in entities.iteritems():
        info = entityElementsByType[entity['entityType']]
        element = dom.createElement(info['name'])
        for k, v in entity.iteritems():
            if k == 'aliases':
                element.setAttribute(k,';'.join(v))
            else:
                element.setAttribute(k,v)
        info['elements'].appendChild(element)
    # Wrap headings and paragraphs in text tag
    newdoc = dom.createElement('DOC')
    root.tagName = 'TEXT'
    newdoc.appendChild(entityElementsByType['PERSON']['elements'])
    newdoc.appendChild(entityElementsByType['LOCATION']['elements'])
    newdoc.appendChild(entityElementsByType['ORGANIZATION']['elements'])
    newdoc.appendChild(root)
    dom.appendChild(newdoc);

    # Go over quotes and match them to characters
    quotes = dom.getElementsByTagName('QUOTE')
    speakerMentions = Set()
    speakers = Set()
    noSpeaker = 0
    for quote in quotes:
        speakerMentionId = quote.getAttribute('speaker')
        if speakerMentionId and speakerMentionId != 'none':
            speakerMentions.add(speakerMentionId)
            speakerId = mentionIdToEntityId[speakerMentionId]
            # Rename attributes
            quote.setAttribute('speaker', speakerId)
            quote.setAttribute('mention', speakerMentionId)
        else:
            noSpeaker += 1
            #print 'Unknown speaker for ' + quote.toxml('utf-8')
    print 'No speaker for ' + str(noSpeaker) + ' quotes'

    # Trim based on mention level
    if mentionLevel == 'QUOTES': # only show quotes (remove mentions)
        mentions = dom.getElementsByTagName('MENTION')
        for mention in mentions:
            t = dom.createTextNode(get_all_text(mention))
            mention.parentNode.replaceChild(t, mention)
    elif mentionLevel == 'DIRECT': # only show mention that are linked as speakers
       mentions = dom.getElementsByTagName('MENTION')
       for mention in mentions:
           if mention.getAttribute('id') not in speakerMentions:
               t = dom.createTextNode(get_all_text(mention))
               mention.parentNode.replaceChild(t, mention)
    # default 'ALL' (keep everything)

    # Convert tags to lowercase
    lowercaseTags(dom)

    output.write(dom.toxml("utf-8"))
#    output.write(dom.toprettyxml(encoding="utf-8"))

def main():
    # Argument processing
    parser = argparse.ArgumentParser(description='Convert CQSC XML')
    parser.add_argument('infile', nargs='?', type=argparse.FileType('r'),
                        default=sys.stdin)
    parser.add_argument('outfile', nargs='?')
    args = parser.parse_args()
    mentionLevels = ["ALL", "DIRECT", "QUOTES"]
    outname = args.outfile or args.infile.name
    (outbase, outext) = os.path.splitext(outname)
    outext = outext or '.xml'
    for mentionLevel in mentionLevels:
        args.infile.seek(0)
        outfilename = outbase + '.' + mentionLevel.lower() + outext
        with open(outfilename, 'w') as outfile:
            convert(args.infile, outfile, mentionLevel);

if __name__ == "__main__": main()