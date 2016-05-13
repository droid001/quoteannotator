#!/usr/bin/env python
#
# Reassembles annotated chapters into one big file

import argparse
import re
import os
import sys
import logging
import traceback

import xml.dom.minidom as minidom

FORMAT = '%(asctime)-15s [%(levelname)s] %(message)s'
logging.basicConfig(format=FORMAT)
log = logging.getLogger('index')
log.setLevel(logging.INFO)

def writeXml(dom, filename):
    with open(filename, 'w') as output:
        output.write(dom.toxml("utf-8"))
#       output.write(dom.toprettyxml(encoding="utf-8"))

def getPartNumber(filename):
    m = re.match(r"(.*?)-([0-9]+)(-[^0-9]+)?\.xml",filename)
    if m:
        return float(m.group(2))
    else:
        return -1

def assemble(input, outfilename):
    # Get filelist
    files = [f for f in os.listdir(input) if f.endswith('.xml')]
    # Sort files by order
    files.sort(key=lambda val: (getPartNumber(val), val))
    # Iterate through chapters
    chapters = []
    characters = []
    charactersByName = {}
    for file in files:
        chdom = minidom.parse(input + '/' + file)
        characterElems = chdom.getElementsByTagName('character')
        for characterElem in characterElems:
            name = characterElem.getAttribute('name')
            if not charactersByName.get(name):
                charactersByName[name] = {'xml': characterElem}
                characterElem.setAttribute('id', str(len(characters)))
                characters.append(charactersByName[name])
        textElems = chdom.getElementsByTagName('text')
        for textElem in textElems:
            # TODO: fix up span ids
            chapters.append( { 'xml': textElem } )
    # Final output
    impl = minidom.getDOMImplementation()
    dom = impl.createDocument(None, "doc", None)
    docElem = dom.documentElement
    charactersElem = dom.createElement('characters')
    for character in characters:
        charactersElem.appendChild(character['xml'].cloneNode(True))
    docElem.appendChild(charactersElem)
    textElem = dom.createElement('text')
    for chapter in chapters:
        t = chapter['xml']
        for c in t.childNodes:
            textElem.appendChild(c.cloneNode(True))
    docElem.appendChild(textElem)
    writeXml(dom, outfilename)

def main():
    # Argument processing
    parser = argparse.ArgumentParser(description='Assembles annotated parts together')
    parser.add_argument('infile')
    parser.add_argument('outfile', nargs='?')
    args = parser.parse_args()
    outname = args.outfile or args.infile + '.xml'
    assemble(args.infile, outname)

if __name__ == "__main__": main()