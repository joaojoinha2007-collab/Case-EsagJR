"""Gera a landing page em um único arquivo (CSS, JS, motor de cálculo e logos embutidos).

Uso: python3 week-landing/build.py
Saídas:
  week-landing/dist/week-haircare-landing.html   → página publicada (link)
  week-haircare-landing.html (raiz)               → mesma página com <!doctype>, para abrir localmente
"""
import base64, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
ENGINE = ROOT.parent / 'week-mercado'
IMGS = {
    'esag-color': ENGINE / 'assets/esagjr-logo-completo.png',
    'esag-white': ENGINE / 'assets/esagjr-logo-branco.png',
    'week-teal': ENGINE / 'assets/week-haircare-logo-teal.png',
    'week-white': ENGINE / 'assets/week-haircare-logo-branco.png',
}
SCRIPTS = [ENGINE / 'js/data.js', ENGINE / 'js/format.js', ENGINE / 'js/calc.js', ROOT / 'landing.js']

page = (ROOT / 'landing.src.html').read_text(encoding='utf-8')
page = page.replace('/*CSS*/', (ROOT / 'landing.css').read_text(encoding='utf-8'))
page = page.replace('{{WEEK_MARK}}', (ROOT / 'week-mark.path').read_text(encoding='utf-8').strip())
for key, path in IMGS.items():
    page = page.replace('{{IMG:%s}}' % key, 'data:image/png;base64,' + base64.b64encode(path.read_bytes()).decode())
js = '\n'.join('<script>\n%s\n</script>' % p.read_text(encoding='utf-8').replace('</script', '<\\/script') for p in SCRIPTS)
page = page.replace('<!--SCRIPTS-->', js)

dist = ROOT / 'dist'; dist.mkdir(exist_ok=True)
(dist / 'week-haircare-landing.html').write_text(page, encoding='utf-8')
title_end = page.index('</title>') + len('</title>')
standalone = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
              '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
              + page[:title_end] + '\n' + page[title_end:page.index('<header')] + '</head>\n<body>\n'
              + page[page.index('<header'):] + '\n</body>\n</html>\n')
(ROOT.parent / 'week-haircare-landing.html').write_text(standalone, encoding='utf-8')
print('ok', len(page) // 1024, 'KB')
