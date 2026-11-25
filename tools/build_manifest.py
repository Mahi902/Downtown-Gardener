#!/usr/bin/env python3
"""Scans /sh and /mh and writes plants.json (the game reads it to know which plants exist).
Run after adding a plant folder: python3 tools/build_manifest.py"""
import os, json, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man = {}
for t in ('sh', 'mh'):
    base = os.path.join(ROOT, t)
    man[t] = []
    if not os.path.isdir(base): continue
    for n in sorted(os.listdir(base)):
        d = os.path.join(base, n)
        if not os.path.isfile(os.path.join(d, 'info.txt')): continue
        fs = os.listdir(d)
        cnt = lambda pre: len([f for f in fs if re.fullmatch(pre + r'\d+\.svg', f)])
        man[t].append({'name': n, 'ss': cnt('ssprite'), 'ps': cnt('psprite')})
json.dump(man, open(os.path.join(ROOT, 'plants.json'), 'w'), indent=1)
print('manifest:', {k: [e['name'] for e in v] for k, v in man.items()})
