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
