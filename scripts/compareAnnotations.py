#!/usr/bin/env python
#
# Script to compare annotations

import argparse
import collections
import os
import logging
import traceback
import xml.dom.minidom as minidom

import util


def getAnnotations(dom):
    textElems = dom.getElementsByTagName('text')
    allQuotes = []
    allMentions = []
    for textElem in textElems:
        quotes = textElem.getElementsByTagName('quote')
        allQuotes.extend(quotes)
        mentions = textElem.getElementsByTagName('mention')
        allMentions.extend(mentions)

    qdictOid = {}
    for quote in allQuotes:
        oid = quote.getAttribute('oid')
        if oid != None:
            qs = qdictOid.get(oid)
            if qs:
                qdictOid[oid].append(quote)
            else:
                qdictOid[oid] = [quote]
    qdict = {x.getAttribute('id'):x for x in allQuotes}
    mdict = {x.getAttribute('id'):x for x in allMentions}
    return {'quotes': qdict, 'quotesOid': qdictOid, 'mentions': mdict}

def compare(file1, file2, quoteIds):
    dom1 = minidom.parse(file1)
    dom2 = minidom.parse(file2)
    ann1 = getAnnotations(dom1)
    ann2 = getAnnotations(dom2)
    for qid in quoteIds:
        q1 = ann1['quotes'].get(qid)
        if q1:
            oid = q1.getAttribute('oid')
            if oid:
                q2s = ann2['quotesOid'].get(oid)
                q2 = None
                if q2s:
                    q1text = util.get_all_text(q1)
                    for q2opt in q2s:
                        q2text = util.get_all_text(q2opt)
                        if q1text == q2text:
                            q2 = q2opt
                if q2:
                    # Compare q1 and q2
                    s1 = q1.getAttribute('speaker')
                    s2 = q2.getAttribute('speaker')
                    if s1 != s2:
                        print 's1 = ' + s1 + ', s2 = ' + s2 + ', qid=' + qid + ', oid=' + oid
                else:
                    print 'missing q2 for ' + qid + ', oid=' + oid
            else:
                print 'missing oid for ' + qid
        else:
            print 'missing q1 ' + qid

def main():
    # Argument processing
    scriptDir = util.getScriptPath()
    parser = argparse.ArgumentParser(description='Compare annotations')
    parser.add_argument('-q', '--quoteIds', dest='quoteIdsFile', help="List of original quoteIds"); 
    parser.add_argument('-c', '--characters', dest='characterDir', help='directory for character files', 
        action='store', default=os.path.join(scriptDir, '../data/characters'))
    parser.add_argument('file1', help='file with new annotations', action='store')
    parser.add_argument('file2', help='file with old annotations', action='store')
    args = parser.parse_args()

    quoteIds = []
    if args.quoteIdsFile != None:
        quoteIds = util.readlines(args.quoteIdsFile)
    compare(args.file1, args.file2, quoteIds)

if __name__ == "__main__": main()