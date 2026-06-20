import json, glob
from collections import Counter
files = sorted(glob.glob(r'D:\inventario-v2\_scale_probe\peg_out_cli\traps-*.json'))
q = 0; traps = 0; nt = Counter(); perbatch = {}
for f in files:
    d = json.load(open(f, encoding='utf-8-sig'))
    bq = bt = 0
    for r in d.get('results', []):
        q += 1; bq += 1
        k = len(r.get('traps', [])); traps += k; bt += k; nt[k] += 1
    bi = f.split('traps-')[1].split('.')[0]
    perbatch[bi] = [bq, bt]
out = {'files': len(files), 'questoes': q, 'traps': traps,
       'media': round(traps / max(1, q), 3),
       'dist_ntraps_por_q': {str(k): v for k, v in sorted(nt.items())},
       'perbatch': perbatch}
json.dump(out, open(r'D:\inventario-v2\_scale_probe\_count.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
