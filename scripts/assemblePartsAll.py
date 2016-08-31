#!/usr/bin/env python
#
# Convert Columbia Quote Speech Corpus xml to our format

import argparse
import collections
import os
import logging
import traceback

import assembleParts
import util

from glob import glob

FORMAT = '%(asctime)-15s [%(levelname)s] %(message)s'
logging.basicConfig(format=FORMAT)
log = logging.getLogger('index')
log.setLevel(logging.INFO)

def main():
    # Argument processing
    scriptDir = util.getScriptPath()
    parser = argparse.ArgumentParser(description='Convert CQSC XML')
    parser.add_argument('-p', dest='includeSectionTags', help='paragraphs and headings', action='store_true')
    parser.add_argument('-c', '--characters', dest='characterDir', help='directory for character files', 
        action='store', default=os.path.join(scriptDir, '../data/characters'))
    parser.add_argument('-f', '--filter', dest='filter', help='filter pattern for input files', action='store')
    parser.add_argument('indir', help='directory to use', action='store')
    parser.add_argument('outdir', nargs='?')
    args = parser.parse_args()

    overallStats = collections.Counter()
    if args.outdir:
        if not os.path.exists(args.outdir):
            os.makedirs(args.outdir)
    files = glob(args.indir + '/*/')
    for filename in files:
        (base,ext) = os.path.splitext(filename)
        file = os.path.basename(base.rstrip('/'))
        charactersFile = os.path.join(args.characterDir, file + ".characters.json")
        if not os.path.isfile(charactersFile):
            charactersFile = None
        outname = os.path.join(args.outdir, file + '.xml') if args.outdir else base + '.xml'
        statsFilename = os.path.join(args.outdir, file + '.stats.txt') if args.outdir else base + '.stats.txt'
        print "Assembling " + filename + " with characters " + str(charactersFile) + " to " + outname
        try:
            characters = util.readCharacters(charactersFile) if charactersFile else None
            assembleParts.assemble(filename, characters, args.includeSectionTags, 
                outname, args.filter, overallStats, statsFilename)
        except:
            log.error("Unexpected error processing " + filename + ": ", exc_info=True)
    assembleParts.writeStats(overallStats)

if __name__ == "__main__": main()