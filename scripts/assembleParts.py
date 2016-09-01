#!/usr/bin/env python
#
# Reassembles annotated chapters into one big file
# Requires: pip install fuzzywuzzy

import argparse
import collections
import itertools
import json
import math
import re
import os
import sys
import logging
import traceback

import xml.dom.minidom as minidom
from fuzzywuzzy import process
from fuzzywuzzy import fuzz

from util import get_all_text
from util import has_ancestor_tag
from util import readCharacters

FORMAT = '%(asctime)-15s [%(levelname)s] %(message)s'
logging.basicConfig(format=FORMAT)
log = logging.getLogger('index')
log.setLevel(logging.INFO)

def writeXml(dom, filename):
    with open(filename, 'w') as output:
        output.write(dom.toxml("utf-8"))
#       output.write(dom.toprettyxml(encoding="utf-8"))

def getPartNumber(filename):
    m = re.match(r"(.*?)-([0-9]+)([a-zA-Z])?(-[^0-9]+)?\.xml",filename)
    if m:
        partnum = float(m.group(2))
        if (m.group(3)):
            ch = m.group(3).lower()
            code = ord(ch) - ord('a')
            partnum = partnum + code/26.0
        return partnum
    else:
        return -1

def getFilePrefix(filename):
    m = re.match(r"(.*?)-([0-9]+)([a-zA-Z])?(-[^0-9]+)?\.xml",filename)
    if m:
        return m.group(1)
    else:
        return filename

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

def updateStats(stats, flags, feature):
    for flag in flags:
        v = {}
        v[flag + '.' + feature] = 1
        stats.update(v)

def checkLinks(filename, textElem, charactersByName, overallStats):
    quotes = textElem.getElementsByTagName('quote')
    mentions = textElem.getElementsByTagName('mention')
    prefix = 'checkLinks(' + filename + '): '
    stats = collections.Counter()
    # Make a map of quoteId to quote
    quotesById = {}
    for quote in quotes:
        qid = quote.getAttribute('id')
        quotesById[qid] = quote
    # Make a map of mentionId to mention
    mentionsById = {}
    for mention in mentions:
        mid = mention.getAttribute('id')
        mentionsById[mid] = mention
    # Make sure each mention is linked to at least one quote
    # Make sure that the speaker is the same for the mention or quote
    for mention in mentions:
        mid = mention.getAttribute('id')
        mspeaker = mention.getAttribute('speaker')
        # getAttribute Returns empty string if attribute not there
        connections = mention.getAttribute('connection').split(",")
        connections = filter(None, connections)
        mprefix = prefix + 'Mention ' + mid + '(' + mspeaker + ')'
        if len(connections) > 0:
            for conn in connections:
                quote = quotesById.get(conn)
                # Make sure mention is linked to quote and not something else
                if quote:
                    # Make sure that the speaker is the same for the mention or quote
                    if quote.getAttribute('speaker') != mspeaker:
                        log.warning(mprefix + ' and quote ' + conn + ' has different speakers')
                        log.warning(mprefix + ' quote ' + conn + ': ' + get_all_text(quote))
                    # Make sure that the mention links to quote and quote to mention
                    if not mid in quote.getAttribute('connection').split(","):
                        log.warning(mprefix + ' connects to quote ' + conn + ', but quote do not connect back')
                        log.warning(mprefix + ' quote ' + conn + ': ' + get_all_text(quote))
                else:
                    desc = ' (mention)' if mentionsById.get(conn) else ''
                    log.warning(mprefix + ' connected to invalid quote ' + conn + desc)
        else:
            log.warning(mprefix + ' has no connections')
    # Make sure each quote is linked to one mention
    # Make sure that the speaker is the same for the mention or quote
    # If a quote is not linked, make sure the speaker is none
    stats.update({'quotes.all': len(quotes)})
    for quote in quotes:
        statsFlags = ['quotes.all']
        isNested = has_ancestor_tag(quote.parentNode, 'quote')
        if isNested:
            stats.update({'quotes.nested': 1})
            statsFlags.append('quotes.nested')
        qoid = quote.getAttribute('oid')
        if qoid:
            stats.update({'quotes.orig': 1})
            statsFlags.append('quotes.orig')
        qid = quote.getAttribute('id')
        qspeaker = quote.getAttribute('speaker')
        # getAttribute Returns empty string if attribute not there
        connections = quote.getAttribute('connection').split(",")
        connections = filter(None, connections)
        qprefix = prefix + 'Quote ' + qid + '(' + qspeaker + ')'
        hasError = False
        # Check if qspeaker is known character
        character = charactersByName.get(qspeaker)
        if not character:
            updateStats(stats, statsFlags, 'unknownCharacter')
            log.warning(qprefix + ' has speaker ' + qspeaker + ' with unknown character')
            hasError = True
        else:
            updateStats(stats, statsFlags, 'withCharacter')
        if qspeaker == '':
            updateStats(stats, statsFlags, 'speakerEmpty')
        elif qspeaker == 'none':
            updateStats(stats, statsFlags, 'speakerNone')
        else:
            updateStats(stats, statsFlags, 'speakerSpecified')
        if len(connections) > 0:
            updateStats(stats, statsFlags, 'withMention')
            if not character:
                updateStats(stats, statsFlags, 'withMentionUnknownCharacter')
            if len(connections) > 1:
                log.warning(qprefix + ' has multiple connections ' + ','.join(connections))
                hasError = True
            for conn in connections:
                mention = mentionsById.get(conn)
                # Make sure quote is linked to mention and not something else
                if mention:
                    # Make sure that the speaker is the same for the mention or quote
                    if mention.getAttribute('speaker') != qspeaker:
                        log.warning(qprefix + ' and mention ' + conn + ' has different speakers')
                        hasError = True
                    # Make sure that the mention links to quote and quote to mention
                    if not qid in mention.getAttribute('connection').split(","):
                        log.warning(qprefix + ' connects to mention ' + conn + ', but mention do not connect back')
                        hasError = True
                else:
                    updateStats(stats, statsFlags, 'connectedToInvalidMention')
                    desc = ' (quote)' if quotesById.get(conn) else ''
                    log.warning(qprefix + ' connected to invalid mention ' + conn + desc)
                    hasError = True
        else:
            updateStats(stats, statsFlags, 'noMention')
            if not character:
                updateStats(stats, statsFlags, 'noMentionUnknownCharacter')
            # If a quote is not linked, make sure the speaker is none
            if qspeaker != 'none':
                log.warning(qprefix + ' has no connections')
                hasError = True
            else:
                updateStats(stats, statsFlags, 'noMentionSpeakerNone')
        # Print out text of the quote that errored
        if hasError:
            log.warning(qprefix + ': ' + get_all_text(quote))
    #writeStats(stats)
    overallStats.update(stats)
    return stats

def guessCharacter(name, allCharactersByAlias, allCharactersByNormalized):
    matched = process.extractOne(name, allCharactersByAlias.keys())
    result = {
        "name": matched[0],
        "score": matched[1],
        "characters": allCharactersByAlias[matched[0]]
    }
    if result['score'] < 100:
        # match without punctuation
        m = normalizeName(name)
        matched = process.extractOne(m, allCharactersByNormalized.keys())
        result = {
            "name": matched[0],
            "score": matched[1],
            "characters": allCharactersByNormalized[matched[0]]
        }
    result['ok'] = result['score'] == 100 and len(result['characters']) == 1
    if result['ok']:
        log.info('Guess ' + name + ' is ' + result['characters'][0]['name'] )
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
    allCharactersByNormalized = {}  # normalized
    for character in allCharacterList:
        name = character['name']
        # Strip . (guess that's something the javascript did)
        name = name.replace(".", "")
        #name = normalizeName(name)
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
                nalias = normalizeName(alias)
                if not allCharactersByNormalized.get(nalias):
                    allCharactersByNormalized[nalias] = [character]
                else:
                    allCharactersByNormalized[nalias].append(character)
    # Go through characters and make sure they are found in our character list!
    characters = doc['characters']
    for character in characters:
        dom = character['xml']
        name = dom.getAttribute('name')
        #name = normalizeName(name)
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
                    guessed = guessCharacter(nm, allCharactersByAlias, allCharactersByNormalized)
                    if guessed['ok']:
                        members.append(guessed['characters'][0]['normalized'])
                    else:
                        printMismatchedCharacter(name, nm, guessed)
                if len(members) > 0:
                    dom.setAttribute('members', ';'.join(members))
            else:
                guessed = guessCharacter(name, allCharactersByAlias, allCharactersByNormalized)
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

def writeStats(stats, statsFilename = None):
    if statsFilename:
        with open(statsFilename, "w") as out:
            out.write(json.dumps(stats, sort_keys=True, indent=2))
    else:
        print(json.dumps(stats, sort_keys=True, indent=2))

# input: directory of files to merge
#        to ensure files are correctly sorted, make sure each piece is named
#             xxxx-<partnum>-xxx.xml
# allCharacterList: list of all known characters 
#                   If new character are found, will be output to separate list 
#                   so the user can manually merge it
# includeSectionTags: whether section tags are included (currently just chapter markings)
# outFilename: Output aggregated file
# filterPattern:    Pattern to use when filtering filename
# overallStats:     Cumulative stats
# statsFilename:    Filename for output stats
def assemble(input, allCharacterList, includeSectionTags, outFilename, 
    filterPattern = None, overallStats = None, statsFilename = None):
    # Get filelist
    xml_files = [f for f in os.listdir(input) if f.endswith('.xml')]
    if filterPattern:
        p = re.compile(filterPattern)
        files = [f for f in xml_files if re.match(p, f)]
    else:
        xml_files
    # Sort files by order
    files.sort(key=lambda val: (getFilePrefix(val), getPartNumber(val)))
    # Iterate through chapters
    chapters = []
    characters = []
    charactersByName = {}
    maxSpanId = 0
    novelStats = collections.Counter()
    for file in files:
        print file
        partNumber = getPartNumber(file)
        chapterStart = not partNumber or math.floor(partNumber) == partNumber
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
            checkLinks(file, textElem, charactersByName, novelStats)
            m1 = updateIds(textElem.getElementsByTagName('quote'), spanOffset)
            m2 = updateIds(textElem.getElementsByTagName('mention'), spanOffset)
            maxSpanId = m1 if m1 > maxSpanId else maxSpanId
            maxSpanId = m2 if m2 > maxSpanId else maxSpanId
            if chapterStart:
                chapters.append({'xml': textElem, 'part': partNumber})
            else:
                # merge with previous chapter
                chapter = chapters[-1]
                for child in textElem.childNodes:
                    chapter['xml'].appendChild(child.cloneNode(True))
            chapterStart = False
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
    writeXml(dom, outFilename)
    writeStats(novelStats, statsFilename)
    if overallStats is not None:
        overallStats.update(novelStats)

def main():
    # Argument processing
    parser = argparse.ArgumentParser(description='Assembles annotated parts together')
    parser.add_argument('infile')
    parser.add_argument('-c', '--characters', dest='charactersFile', help='characters file', action='store')
    parser.add_argument('-p', dest='includeSectionTags', help='paragraphs and headings', action='store_true')
    parser.add_argument('-f', '--filter', dest='filter', help='filter pattern for input files', action='store')
    parser.add_argument('outfile', nargs='?')
    args = parser.parse_args()
    outname = args.outfile or args.infile + '.xml'
    characters = readCharacters(args.charactersFile) if args.charactersFile else None
    assemble(args.infile, characters, args.includeSectionTags, outname, args.filter)

if __name__ == "__main__": main()