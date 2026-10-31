"""Sync public original summaries from the canonical backend corpus, or verify parity."""
import argparse,json
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parents[1];src=root/'ai-backend/knowledge.json';dst=root/'assets/data/engineering-knowledge.json'
data=json.loads(src.read_text());ids=set()
for entry in data['entries']:
    assert entry['id'] not in ids;ids.add(entry['id'])
    assert entry['basis'] in ('public_reference','original_method','simplified_model')
    for sid in entry['source_ids']:assert data['sources'][sid]['url'].startswith('https://')
if args.check:assert dst.read_bytes()==src.read_bytes(),'Run python scripts/sync-knowledge.py'
else:dst.write_bytes(src.read_bytes())
print('Knowledge corpus validated; copies match.' if args.check else 'Knowledge corpus validated and synced.')
