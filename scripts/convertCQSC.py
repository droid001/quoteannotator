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
        node.nodeName = node.tagName
    for child_node in node.childNodes:
        lowercaseTags(child_node)

def stripSectionTags( dom ):
    paragraphTypes = ['heading', 'paragraph']
    for ptype in paragraphTypes:
        for paragraph in dom.getElementsByTagName(ptype):
            for child in paragraph.childNodes:
                paragraph.parentNode.insertBefore(child.cloneNode(True), paragraph)
            paragraph.parentNode.insertBefore(dom.createTextNode('\n'), paragraph)
            paragraph.parentNode.removeChild(paragraph)

def toChapters( dom ):
    chapters = []
    paras = []
    elementCnt = 0
    for doc in dom.getElementsByTagName('doc'):
      for text in dom.getElementsByTagName('text'):
        for child in text.childNodes:
            if child.nodeType == child.ELEMENT_NODE and child.tagName == 'heading':
                if elementCnt > 0:
                    chapters.append(paras)
                    paras = []
                    elementCnt = 0
            if child.nodeType == child.ELEMENT_NODE:
                if child.tagName == 'paragraph':
                    elementCnt += 1
                if len(paras) == 0:
                    paras.append(dom.createTextNode('\n'))
            paras.append(child)
    if elementCnt > 0:
        chapters.append(paras)
    return chapters

def writeXml( dom, filename, includeSectionTags ):
    if not includeSectionTags:
        stripSectionTags(dom)
    with open(filename, 'w') as output:
        output.write(dom.toxml("utf-8"))
#       output.write(dom.toprettyxml(encoding="utf-8"))

def writeConverted( dom, filename, splitChapters, includeSectionTags):
    if splitChapters:
        # Create minidom for each chapter
        chapters = toChapters(dom)
        (temp, ext) = os.path.splitext(filename)
        (base, ext2) = os.path.splitext(temp)
        ext = ext2 + ext
        impl = minidom.getDOMImplementation()
        for chindex, chapter in enumerate(chapters):
            chdom = impl.createDocument(None, "doc", None)
            textElem = chdom.createElement('text')
            for para in chapter:
                textElem.appendChild(para.cloneNode(True))
            docElem = chdom.documentElement
            docElem.appendChild(textElem)
            chfile = base + '-' + str(chindex) + ext
            writeXml(chdom, chfile, includeSectionTags)
    else:
        writeXml(dom, filename, includeSectionTags)

def convert(input, outfilename, mentionLevel, splitChapters, includeSectionTags):
    #print input
    #print output
    nertypes = ['PERSON', 'ORGANIZATION', 'LOCATION']
    dom = minidom.parse(input)
    root = dom.documentElement
    # Process paragraphs    
    entities = {}
    mentionIdToEntityId = {}
    # Clean extracted mentions in HEADING
    for paragraph in root.getElementsByTagName('HEADING'):
        for nertype in nertypes:
            for mention in paragraph.getElementsByTagName(nertype):
                t = dom.createTextNode(get_all_text(mention))
                mention.parentNode.replaceChild(t, mention)
    # Convert mentions under PARAGRAPH        
    for paragraph in root.getElementsByTagName('PARAGRAPH'):
        for nertype in nertypes:
            for mention in paragraph.getElementsByTagName(nertype):
                mention.tagName = 'MENTION'
                mention.nodeName = 'MENTION' 
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
        'PERSON': { 'elements': dom.createElement('PERSONS'), 'name': 'PERSON'},
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
    root.nodeName = 'TEXT'
    entitiesElement = dom.createElement('ENTITIES');
    entitiesElement.appendChild(entityElementsByType['PERSON']['elements'])
    entitiesElement.appendChild(entityElementsByType['LOCATION']['elements'])
    entitiesElement.appendChild(entityElementsByType['ORGANIZATION']['elements'])
    newdoc.appendChild(entitiesElement)
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

    # Output
    writeConverted(dom, outfilename, splitChapters, includeSectionTags)

def main():
    # Argument processing
    parser = argparse.ArgumentParser(description='Convert CQSC XML')
    parser.add_argument('-s', '--split', dest='splitChapters', help='split by chapter', action='store_true')
    parser.add_argument('-p', dest='includeSectionTags', help='paragraphs and headings', action='store_true')
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
        convert(args.infile, outfilename, mentionLevel, args.splitChapters, args.includeSectionTags)

if __name__ == "__main__": main()