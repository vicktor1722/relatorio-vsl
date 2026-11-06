/* Formatação igual ao WhatsApp nas observações (*negrito*, _itálico_, ~riscado~).
   Mesma regra de src/zap.js (relatório no servidor) — mudou lá, muda aqui.
   O build põe cada arquivo no seu escopo: por isso fica em window.ZAP. */
var ZAP = window.ZAP = (function () {
  var L = 'A-Za-z0-9À-ÖØ-öø-ÿ';
  function regra(m) {
    var e = m === '*' ? '\\*' : m;
    return new RegExp('(^|[^' + L + e + '])' + e + '(?=[^\\s' + e + '])([^' + e + '\\n]*?[^\\s' + e + '])' + e + '(?=$|[^' + L + e + '])', 'gm');
  }
  var R = [[regra('*'), 'b'], [regra('_'), 'i'], [regra('~'), 's']];
  return {
    html: function (h) { var s = String(h == null ? '' : h); R.forEach(function (r) { s = s.replace(r[0], '$1<' + r[1] + '>$2</' + r[1] + '>'); }); return s; },
    puro: function (t) { var s = String(t == null ? '' : t); R.forEach(function (r) { s = s.replace(r[0], '$1$2'); }); return s; }
  };
}());
