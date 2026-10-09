"""Gera um HTML único e autocontido (CSS, JS e imagens embutidos).

Uso:  python3 week-mercado/build.py
Saída: week-haircare-mercado.html na raiz do repositório.
"""
import base64, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT.parent / 'week-haircare-mercado.html'

html = (ROOT / 'index.html').read_text(encoding='utf-8')

def css(m):
    return '<style>\n' + (ROOT / m.group(1)).read_text(encoding='utf-8') + '\n</style>'
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)

def js(m):
    code = (ROOT / m.group(1)).read_text(encoding='utf-8').replace('</script', '<\\/script')
    return '<script>\n' + code + '\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', js, html)

cache = {}
def img(m):
    path = m.group(1)
    if path not in cache:
        data = base64.b64encode((ROOT / path).read_bytes()).decode()
        cache[path] = 'data:image/png;base64,' + data
    return m.group(0).replace(path, cache[path])
html = re.sub(r'(?:src|href)="(assets/[^"]+\.png)"', img, html)

OUT.write_text(html, encoding='utf-8')
print(f'{OUT} ({OUT.stat().st_size / 1024:.0f} KB)')
