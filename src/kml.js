/* ============================================================
   kml.js — KML -> GeoJSON no servidor (painel do administrador importa o mapa na fazenda de uma conta)
   Mesmas regras do app (public/js/geo.js): um talhão por Placemark com polígono, nome do <name>
   (ou "Talhão N"), buracos como anéis internos e área esférica em hectares.
   ============================================================ */

const R = 6378137;
function areaAnel(anel) {
  let t = 0;
  for (let i = 0; i < anel.length; i++) {
    const p1 = anel[i], p2 = anel[(i + 1) % anel.length];
    t += (p2[0] - p1[0]) * Math.PI / 180 * (2 + Math.sin(p1[1] * Math.PI / 180) + Math.sin(p2[1] * Math.PI / 180));
  }
  return Math.abs(t * R * R / 2);
}
function areaHa(polys) {
  let m2 = 0;
  polys.forEach((aneis) => aneis.forEach((a, i) => { m2 += (i === 0 ? 1 : -1) * areaAnel(a); }));
  return +(m2 / 10000).toFixed(2);
}
const texto = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim();
function coords(bloco) {
  const m = /<(?:\w+:)?coordinates[^>]*>([\s\S]*?)<\/(?:\w+:)?coordinates>/i.exec(bloco);
  if (!m) return null;
  const pts = m[1].trim().split(/\s+/).map((p) => p.split(',').slice(0, 2).map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite));
  if (pts.length < 3) return null;
  const a = pts[0], b = pts[pts.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) pts.push([a[0], a[1]]);
  return pts;
}

export function kmlParaGeo(kml) {
  const feats = [];
  const pms = String(kml || '').match(/<(?:\w+:)?Placemark\b[\s\S]*?<\/(?:\w+:)?Placemark>/gi) || [];
  pms.forEach((pm) => {
    const polys = [];
    (pm.match(/<(?:\w+:)?Polygon\b[\s\S]*?<\/(?:\w+:)?Polygon>/gi) || []).forEach((pg) => {
      const fora = /<(?:\w+:)?outerBoundaryIs\b[\s\S]*?<\/(?:\w+:)?outerBoundaryIs>/i.exec(pg);
      const ext = fora && coords(fora[0]);
      if (!ext) return;
      const dentro = (pg.match(/<(?:\w+:)?innerBoundaryIs\b[\s\S]*?<\/(?:\w+:)?innerBoundaryIs>/gi) || []).map(coords).filter(Boolean);
      polys.push([ext].concat(dentro));
    });
    if (!polys.length) return;
    const n = feats.length + 1;
    const nm = /<(?:\w+:)?name\b[^>]*>([\s\S]*?)<\/(?:\w+:)?name>/i.exec(pm);
    const nome = (nm && texto(nm[1])) || 'Talhão ' + n;
    feats.push({
      type: 'Feature',
      properties: { nome, id: 'T' + n, _ordem: n, area_ha: areaHa(polys) },
      geometry: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys }
    });
  });
  return { type: 'FeatureCollection', features: feats };
}
