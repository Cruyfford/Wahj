#!/usr/bin/env python3
# Assembles app.html from src/ (style.css, body.html, app.js)
import pathlib
d = pathlib.Path(__file__).parent
css = (d/'src/style.css').read_text()
body = (d/'src/body.html').read_text()
js = (d/'src/app.js').read_text()
html = f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#06050A"><meta name="apple-mobile-web-app-capable" content="yes">
<title>Wahj Live · وهج</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>{css}</style></head><body>
{body}
<script>{js}</script></body></html>'''
(d/'app.html').write_text(html)
print('app.html', len(html))

# English UI strings → lib/en.txt (source for automatic translation into other languages)
import subprocess, json
js_src = (d/'src/app.js').read_text()
a = js_src.index('const T = {'); e = js_src.index('\nconst t = (k, v)')
code = 'const T=' + js_src[a+10:e].rstrip().rstrip(';') + ';const o={};for(const[k,v]of Object.entries(T.en)){if(k==="errs")for(const[x,y]of Object.entries(v))o["errs."+x]=y;else if(typeof v==="string")o[k]=v;}process.stdout.write(JSON.stringify(o));'
try:
    out = subprocess.run(['node', '-e', code], capture_output=True, text=True, check=True).stdout
    json.loads(out); (d/'lib/en.txt').write_text(out); print('lib/en.txt', len(out))
except Exception as ex:
    print('en.txt skipped:', ex)
