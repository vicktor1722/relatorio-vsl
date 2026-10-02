/* construir.js — junta tudo num único index.html (sem precisar de internet para CSS/JS)
   Uso:  node construir.js            -> gera ./site/
         node construir.js ../destino -> gera no destino indicado            */
const fs = require('fs');
const path = require('path');

const raiz = __dirname;
const pub = path.join(raiz, 'public');
const saida = process.argv[2] ? path.resolve(process.argv[2]) : path.join(raiz, 'site');

const ler = (f) => fs.readFileSync(path.join(pub, f), 'utf8');

// minificação leve e segura (não mexe em strings de forma agressiva)
function encolherCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\n+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

let html = ler('index.html');

/* 1. CSS inline */
const css = encolherCss(ler('styles.css'));
html = html.replace(/<link rel="stylesheet" href="styles\.css">/, function () { return '<style>' + css + '</style>'; });

/* 2. JS inline, na mesma ordem das tags <script> */
const ordem = [];
html = html.replace(/\n?[ \t]*<script src="(js\/[^"]+)"><\/script>/g, function (m, arq) {
  ordem.push(arq);
  return '';
});
// cada arquivo entra no seu próprio escopo, senão nomes iguais ($, esc…) se chocam
const js = ordem.map(a =>
  '\n/* ===== ' + a + ' ===== */\n;(function(){\n' + ler(a) + '\n})();'
).join('\n');
html = html.replace('</body>', function () { return '<script>' + js + '\n</script>\n</body>'; });

/* 3. cabeça: metas que o iPhone precisa para abrir como app */
if (!/apple-mobile-web-app-capable/.test(html)) {
  html = html.replace('<link rel="manifest"',
    '<meta name="apple-mobile-web-app-capable" content="yes">\n' +
    '<meta name="apple-mobile-web-app-title" content="Relatorio VSL">\n' +
    '<link rel="apple-touch-icon" href="icon-192.png">\n<link rel="manifest"');
}

/* 4. grava */
fs.mkdirSync(saida, { recursive: true });
fs.writeFileSync(path.join(saida, 'index.html'), html);
['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png'].forEach(function (f) {
  fs.copyFileSync(path.join(pub, f), path.join(saida, f));
});

const kb = (fs.statSync(path.join(saida, 'index.html')).size / 1024).toFixed(1);
console.log('index.html: ' + kb + ' KB  (' + ordem.length + ' scripts embutidos)');
console.log('pasta: ' + saida);
