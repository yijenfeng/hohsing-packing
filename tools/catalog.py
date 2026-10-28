"""產生 plan.json 的 catalog（品號與品名對照）。
來源：OHM_PO_Consolidated 2611-2703.xlsx（Description）、最終_出貨確認表.xlsx（OHM 規格說明）、HO HSING 17614-17616.pdf（YAZAWA 品名、條碼、入數）。"""
import json, sys
OHM = {
 '04-1305':'LB-T0205-W/2P','04-1395':'LB-T0205-C/2P','04-1396':'LB-T2715-C','04-1397':'LB-T2715-F','04-1398':'LB-T0205D-W/2P',
 '04-1411':'FG-1E-2P/D','04-1469':'LB-T0205-W-2P','04-1470':'LB-T0205-W-3P','04-1473':'FG-1E 2P','04-1474':'FG-1E 3P',
 '04-1918':'LB-T0205W-A2P','04-1919':'FG-1E-A2P','04-6334':'LB-C7205-W/2P','04-6355':'LB-S3725-C','04-6356':'LB-S3740-C',
 '04-6369':'LB-G4607-F','04-6376':'LB-C7205-C/2P','04-6401':'LB-T0210-C','04-6402':'LB-G4607-W','04-6414':'LB-S3725-F',
 '04-6415':'LB-S3740-F','04-6475':'LB-T0215-C','04-6487':'LB-G4607-C','04-6489':'LB-G5610-C','04-6543':'FG-1E OG2P',
 '04-6544':'LB-T0205-W ON2P','04-6633':'FG-1P 1P','04-6634':'FG-4P 1P','04-6635':'FG-5P 1P','04-6637':'FG-1EX2P N',
 '04-6665':'FG-1E/4P','04-6666':'FG-1E/5P','04-6825':'LB-T0205-W/2P N','04-9317':'LB-T0205-W','04-9326':'FG-1E 1P',
 '04-9328':'FG-7E 1P','06-0567':'LB-NLW 5W','06-0568':'LB-NLC5W'}
SPEC = {"04-1305": "T20,E12,5W 白", "04-1395": "T20,E12,5W 清", "04-1396": "T22,E17,15W,清", "04-1397": "T22,E17,15W,砂", "04-1398": "T20,E12,5W 白", "04-1411": "FG-1E 2pcs", "04-1469": "T20,E12,5W 白", "04-1470": "T20,E12,5W 白", "04-1473": "FG-1E", "04-1474": "FG-1E", "04-1918": "T20,E12,5W 白", "04-1919": "FG-1E", "04-6334": "C-7,E12,5W,白", "04-6355": "S-35,E17,25W,清", "04-6356": "S-35,E17,40W,清", "04-6369": "G40,E26,7W,砂", "04-6376": "C-7,E12,5W,清", "04-6401": "T20,E12,10W,清", "04-6402": "G40,E26,7W,白", "04-6414": "S-35,E17,25W,砂", "04-6415": "S-35,E17,40W,砂", "04-6475": "T20,E12,15W,清", "04-6487": "G40,E26,7W,清", "04-6489": "G50,E26,10W,清", "04-6543": "FG-1E", "04-6544": "T20,E12,5W 白", "04-6633": "FG-1P", "04-6634": "FG-4P", "04-6635": "FG-5P", "04-6637": "FG-1E", "04-6665": "FG-1E/4P", "04-6666": "FG-1E/5P", "04-6825": "T20,E12,5W 白", "04-9317": "T20,E12,5W 白", "04-9326": "FG-1E", "04-9328": "FG-7E", "06-0567": "T20,5W內白長壽命", "06-0568": "T20,5W透明長壽命"}  # 規格說明：最終_出貨確認表.xlsx「OHM材料需求表」
YAZ = {  # item: (description, supplier item no, barcode, inner box, carton)
 'FG1E2P':('Glow Bulb E2P','','4966307300013',10,480),'FG1E3PY':('Glow Bulb','','4966307307258',10,480),
 'FG4P1P':('Glow Bulb','','4966307300044',10,480),'FG1E4P':('Glow Bulb','','4966307300624',10,480),
 'FG1E4P1CT':('Natsume Glow Bulb 1CT','FG1E4P1CT','4966307312375',10,400),'FG1E5P':('Glow Bulb 5P','','4966307300631',10,480),
 'FG5P1P':('Glow Bulb','','4966307300051',10,480),'FG5P2P':('Glow Bulb','','4966307303533',10,480),
 'FG7E1P':('Glow Bulb','','4966307300075',10,480),'FG1E2P1CT':('Natsume Glow Bulb','1E2P1CT','4966307300037',10,400),
 'FG1E5P1CT':('Natsume Glow Bulb 1CT','1E5P1CT','4966307300020',10,400),'FG4P2P':('Glow Bulb','','4966307303526',10,480),
 'FG1PB':('Glow Bulb','FG1P-BULK','4966307310388',250,1500),'FG4P5P':('Glow Bulb','','4966307300648',10,480),
 'FG7EB':('Glow Bulb','FG7E-BULK','4966307310418',250,1500)}
p = json.load(open(sys.argv[1]))
how = {}
for t in p['tasks']:
    if t['kind'] == 'pack': how.setdefault(t['item'], t['how'])
cust = {o['id']: o['cust'] for o in p['orders']}
seen = {}
for i in p['items']:
    c = cust[i['order']]; k = (c, i['item'])
    r = seen.setdefault(k, {'cust': c, 'item': i['item'], 'loc': i['loc'], 'how': how.get(i['item'], '')})
    if c == 'OHM':
        r['name'] = OHM[i['item']]; r['spec'] = SPEC[i['item']]
    else:
        d = YAZ[i['item']]; r.update(name=d[0], sup=d[1], barcode=d[2], inner=d[3], carton=d[4])
p['catalog'] = sorted(seen.values(), key=lambda r: (r['cust'] != 'OHM', r['item']))
json.dump(p, open(sys.argv[1], 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(p['catalog']), 'items;', sum(r['cust'] == 'OHM' for r in p['catalog']), 'OHM')
print([r for r in p['catalog'] if not r.get('name')])
