/* Formatação igual ao WhatsApp nas observações: *negrito*, _itálico_, ~riscado~.
   zap(h) recebe o texto JÁ escapado (HTML seguro) e devolve com <b>, <i>, <s>.
   O marcador precisa encostar no texto (sem espaço do lado de dentro) e não pode estar no meio de uma palavra. */
const L = 'A-Za-z0-9À-ÖØ-öø-ÿ';
function regra(m) {
  const e = m === '*' ? '\\*' : m;
  return new RegExp('(^|[^' + L + e + '])' + e + '(?=[^\\s' + e + '])([^' + e + '\\n]*?[^\\s' + e + '])' + e + '(?=$|[^' + L + e + '])', 'gm');
}
const R = [[regra('*'), 'b'], [regra('_'), 'i'], [regra('~'), 's']];

export function zap(h) {
  let s = String(h == null ? '' : h);
  R.forEach(([re, tag]) => { s = s.replace(re, '$1<' + tag + '>$2</' + tag + '>'); });
  return s;
}
// sem os marcadores (texto puro: PowerPoint, alt de imagem)
export function semZap(t) {
  let s = String(t == null ? '' : t);
  R.forEach(([re]) => { s = s.replace(re, '$1$2'); });
  return s;
}

// a mesma função para ir dentro do script das páginas (sem crase nem "${")
export const ZAP_JS = String.raw`
var ZAP = (function () {
  var L = 'A-Za-z0-9À-ÖØ-öø-ÿ';
  function regra(m) {
    var e = m === '*' ? '\\*' : m;
    return new RegExp('(^|[^' + L + e + '])' + e + '(?=[^\\s' + e + '])([^' + e + '\\n]*?[^\\s' + e + '])' + e + '(?=$|[^' + L + e + '])', 'gm');
  }
  var R = [[regra('*'), 'b'], [regra('_'), 'i'], [regra('~'), 's']];
  return {
    html: function (h) { var s = String(h == null ? '' : h); R.forEach(function (r) { s = s.replace(r[0], '$1<' + r[1] + '>$2</' + r[1] + '>'); }); return s; },
    puro: function (t) { var s = String(t == null ? '' : t); R.forEach(function (r) { s = s.replace(r[0], '$1$2'); }); return s; },
    // pedaços do texto com o estilo de cada um ({ t, b, i, s }), para o PowerPoint
    partes: function (t) {
      var s = String(t == null ? '' : t);
      R.forEach(function (r) { s = s.replace(r[0], function (m, a, x) { return a + '\u0001' + r[1] + x + '\u0002'; }); });
      var out = [], pilha = [], buf = '';
      function solta() { if (buf) { out.push({ t: buf, b: pilha.indexOf('b') >= 0, i: pilha.indexOf('i') >= 0, s: pilha.indexOf('s') >= 0 }); buf = ''; } }
      for (var k = 0; k < s.length; k++) {
        var c = s.charAt(k);
        if (c === '\u0001') { solta(); pilha.push(s.charAt(++k)); }
        else if (c === '\u0002') { solta(); pilha.pop(); }
        else buf += c;
      }
      solta();
      return out;
    }
  };
}());
`;
