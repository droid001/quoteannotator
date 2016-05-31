#!/usr/bin/env python
#
# Reassembles annotated chapters into one big file

import argparse
import itertools
import json
import re
import os
import sys
import logging
import traceback

import xml.dom.minidom as minidom
from fuzzywuzzy import process
from fuzzywuzzy import fuzz

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
    return float(m.group(2)) if m else -1

def updateId(id, offset):
    if len(id) > 0:
        m = re.match(r"([a-zA-Z]+)([0-9]+)", id)
        d = int(m.group(2)) + offset
        mid = m.group(1) + str(d)
        return (mid,d)
    else:
        return (id,None)

def updateIds(elements, offset):
    maxId = -1
    for element in elements:
        eid = updateId(element.getAttribute('id'), offset)
        if eid[1] > maxId:
            maxId = eid[1]
        element.setAttribute('id', eid[0])
        connections = element.getAttribute('connection').split(",")
        connections = [updateId(c,offset)[0] for c in connections]
        connection = ",".join(connections)
        element.setAttribute('connection', connection)
    return maxId+1

def guessCharacter(name, allCharactersByAlias):
    matched = process.extractOne(name, allCharactersByAlias.keys())
    result = {
        "name": matched[0],
        "score": matched[1],
        "characters": allCharactersByAlias[matched[0]]
    }
    if result['score'] < 100:
        # match without punctuation
        m = normalizeName(result['name'])
        result['score'] = fuzz.ratio(name, m)
    result['ok'] = result['score'] == 100 and len(result['characters']) == 1
    return result

def normalizeName(s):
    s = s.replace(" ", "_")
    s = re.sub(r'[^\w\s]','',s)
    return s

def printMismatchedCharacter(name, subpart, guessed):
    detail = ' (' + subpart + ')' if subpart else ''
    log.warning('Character not found: "' + name + '"' + detail + 
        ' best match is ' + guessed['name'] + 
        ', score=' + str(guessed['score']) + 
        ', options=' + str(len(guessed['characters'])))

def updateSpeaker(elements, old, new):
    n = 0
    for element in elements:
        speaker = element.getAttribute('speaker')
        if speaker == old:
            element.setAttribute('speaker', new)
            n = n+1
    return n

def fixupCharacter(doc, character):
    dom = character['xml']
    name = dom.getAttribute('name')
    c = character['character']
    normalized = c['normalized']
    if c.get('mappedCharacter'):
        character['duplicate'] = True
    else:
        character['duplicate'] = False
        c['mappedCharacter'] = character
    # Ensure character dom contains all the necessary information
    props = ["gender", "aliases", "description"]
    for prop in props:
        v = c.get(prop)
        if v:
            if prop == "aliases":
                dom.setAttribute(prop, ";".join(v))
            else:
                dom.setAttribute(prop, v)
    if not name == normalized:
        dom.setAttribute('name', normalized)
        # Go through chapters, and replace reference to name by normalized
        chapters = doc['chapters']
        for chapter in chapters:
            chdom = chapter['xml']
            updateSpeaker(chdom.getElementsByTagName('quote'), name, normalized)
            updateSpeaker(chdom.getElementsByTagName('mention'), name, normalized)


def processCharacters(doc, allCharacterList):
    # Make sure all characters are found in our character list
    # Create a map of characters by name (string to character)
    allCharactersByName = {}
    # Create a backup map of characters by alias (string to list of characters)
    allCharactersByAlias = {}
    for character in allCharacterList:
        name = character['name']
        # Strip . (guess that's something the javascript did)
        name = name.replace(".", "")
        character['normalized'] = name
        if not allCharactersByName.get(name):
            allCharactersByName[name] = character
        else:
            log.warning('Duplicate character ' + name + ' found!')
        if character.get('aliases'):
            for alias in character['aliases']:
                if not allCharactersByAlias.get(alias):
                    allCharactersByAlias[alias] = [character]
                else:
                    allCharactersByAlias[alias].append(character)
    # Go through characters and make sure they are found in our character list!
    characters = doc['characters']
    for character in characters:
        dom = character['xml']
        name = dom.getAttribute('name')
        if allCharactersByName.get(name):
            character['character'] = allCharactersByName.get(name)
            fixupCharacter(doc, character)
        else:
            # Why character not found???
            if "_and_" in name:
                names = name.split("_and_")
                dom.setAttribute('group', "true")
                members = []
                for nm in names:
                    guessed = guessCharacter(nm, allCharactersByAlias)
                    if guessed['ok']:
                        members.append(guessed['characters'][0]['normalized'])
                    else:
                        printMismatchedCharacter(name, nm, guessed)
                if len(members) > 0:
                    dom.setAttribute('members', ';'.join(members))
            else:
                guessed = guessCharacter(name, allCharactersByAlias)
                if guessed['ok']:
                    character['character'] = guessed['characters'][0]
                    fixupCharacter(doc, character)
                else:
                    printMismatchedCharacter(name, None, guessed)
    # Remove duplicates
    deduped = [x for x in characters if not x.get('duplicate') == True] 
    for i,c in enumerate(deduped):
        c['xml'].setAttribute('id', str(i))
    doc['characters'] = deduped

# input: directory of files to merge
# allCharacterList: list of all known characters 
#                   If new character are found, will be output to separate list 
#                   so the user can manually merge it
# includeSectionTags: whether section tags are included (currently just chapter markings)
# outfilename: Output aggregated file
def assemble(input, allCharacterList, includeSectionTags, outfilename):
    # Get filelist
    files = [f for f in os.listdir(input) if f.endswith('.xml')]
    # Sort files by order
    files.sort(key=lambda val: (getPartNumber(val), val))
    # Iterate through chapters
    chapters = []
    characters = []
    charactersByName = {}
    maxSpanId = 0
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
            # TODO: fix up span ids for quote, mention, connection
            spanOffset = maxSpanId
            m1 = updateIds(chdom.getElementsByTagName('quote'), spanOffset)
            m2 = updateIds(chdom.getElementsByTagName('mention'), spanOffset)
            maxSpanId = m1 if m1 > maxSpanId else maxSpanId
            maxSpanId = m2 if m2 > maxSpanId else maxSpanId
            chapters.append({'xml': textElem})
    # Process characters
    if allCharacterList:
        doc = {
            "chapters": chapters,
            "characters": characters,
            "charactersByName": charactersByName
        }
        processCharacters(doc, allCharacterList)
        characters = doc['characters']
    # Final output
    impl = minidom.getDOMImplementation()
    dom = impl.createDocument(None, "doc", None)
    docElem = dom.documentElement
    charactersElem = dom.createElement('characters')
    for character in characters:
        charactersElem.appendChild(dom.createTextNode('\n'))
        charactersElem.appendChild(character['xml'].cloneNode(True))
    charactersElem.appendChild(dom.createTextNode('\n'))
    docElem.appendChild(dom.createTextNode('\n'))
    docElem.appendChild(charactersElem)
    docElem.appendChild(dom.createTextNode('\n'))
    textElem = dom.createElement('text')
    for chapter in chapters:
        t = chapter['xml']
        if includeSectionTags:
            chapterElem = dom.createElement('chapter')
            textElem.appendChild(dom.createTextNode('\n'))
            textElem.appendChild(chapterElem)
        else:
            chapterElem = textElem
        for c in t.childNodes:
            chapterElem.appendChild(c.cloneNode(True))
    docElem.appendChild(textElem)
    writeXml(dom, outfilename)

def readCharactersJson(filename):
    with open(filename) as file:
        return json.load(file)

def main():
    # Argument processing
    parser = argparse.ArgumentParser(description='Assembles annotated parts together')
    parser.add_argument('infile')
    parser.add_argument('-c', '--characters', dest='charactersFile', help='characters file', action='store')
    parser.add_argument('-p', dest='includeSectionTags', help='paragraphs and headings', action='store_true')
    parser.add_argument('outfile', nargs='?')
    args = parser.parse_args()
    outname = args.outfile or args.infile + '.xml'
    characters = readCharactersJson(args.charactersFile) if args.charactersFile else None
    assemble(args.infile, characters, args.includeSectionTags, outname)

if __name__ == "__main__": main()