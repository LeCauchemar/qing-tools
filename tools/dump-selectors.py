import re
css = open('assets/site.css', encoding='utf-8').read()
names = sorted(set(re.findall(r'\.([A-Za-z][A-Za-z0-9_-]*)', css)))
print(len(names))
print(' '.join(names))
js = open('assets/site.js', encoding='utf-8').read()
sel = sorted(set(re.findall(r"""['"]([#.][A-Za-z0-9_.#\-> \[\]=]+)['"]""", js)))
print('--- js selectors ---')
print(' | '.join(sel))
