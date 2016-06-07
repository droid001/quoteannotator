#!/usr/bin/env python
#
# Convert characters in txt format to json

import argparse
import json
import os
import sys
import logging
import traceback

FORMAT = '%(asctime)-15s [%(levelname)s] %(message)s'
logging.basicConfig(format=FORMAT)
log = logging.getLogger('index')
log.setLevel(logging.INFO)

def strToCharacter(str):
    fields = str.split(';')
    aliases = [fields[0]] + fields[2:]
    character = { 'name': fields[0].replace(' ', '_'), 'gender': mapGender(fields[1]), 'aliases': aliases}
    return character

def mapGender(gender):
    if gender == 'M':
        return 'male'
    elif gender == 'F':
        return 'female'
    else:
        return gender

def readlines(input):
    lines = []
    with open(input) as x:
        for line in x:
            line = line.strip()
            if len(line):
                lines.append(line)
    return lines

def readCharacters(filename):
    characters = readlines(filename)
    characters = map(strToCharacter, characters)
    for index,character in enumerate(characters):
        character['id'] = str(index)
    return characters

def convertCharacters(input, output):
  characters = readCharacters(input)
  with open(output, 'w') as out:
    out.write(json.dumps(characters, indent=2, separators=(',', ': '))) 

def main():
    # Argument processing
    parser = argparse.ArgumentParser(description='Convert character list to JSON')
    parser.add_argument('infile')
    parser.add_argument('outfile', nargs='?')
    args = parser.parse_args()
    (inbase, inext) = os.path.splitext(args.infile)
    outname = args.outfile or inbase + ".json"
    convertCharacters(args.infile, outname)

if __name__ == "__main__": main()