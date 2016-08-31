# Some utility functions used by our scripts
import json
import os
import sys

# Returns all text from a XML node
def get_all_text( node ):
    if node.nodeType ==  node.TEXT_NODE:
        return node.data
    else:
        text_string = ""
        for child_node in node.childNodes:
            text_string += get_all_text( child_node )
        return text_string

# Checks if node has ancestor with given tag
def has_ancestor_tag( node, tag ):
    if node:
        if node.nodeType ==  node.ELEMENT_NODE:
            if node.tagName == tag:
                return True
        return has_ancestor_tag( node.parentNode, tag )
    else:
        return False

# Read lines and returns as list (ignores empty lines)
def readlines(input):
    lines = []
    with open(input) as x:
        for line in x:
            line = line.strip()
            if len(line):
                lines.append(line)
    return lines

# Read character text file
def readCharactersTxt(filename):
    characters = readlines(filename)
    characters = map(strToCharacter, characters)
    for index,character in enumerate(characters):
        character['id'] = str(index)
    return characters

# Read character json file
def readCharactersJson(filename):
    with open(filename) as file:
        return json.load(file)

# Read character file (either json or txt based on extension)
def readCharacters(filename):
    (base,ext) = os.path.splitext(filename)
    if ext == '.json':
        return readCharactersJson(filename)
    elif ext == '.txt':
        return readCharactersTxt(filename)
    else:
        raise Exception('Unsupported character format ' + filename)

def getScriptPath():
    return os.path.dirname(os.path.realpath(sys.argv[0]))