/* ============================================================
   plantiodia.js — plantio lançado por dia (área plantada parcial do talhão)
   O gerente da fazenda lança "talhão X: N ha plantados no dia D" pelo portal; a lista fica em
   plantio.lanc (JSON [{d, ha, por}]). Sem lançamentos, vale o jeito antigo: data de plantio = talhão todo.
   ============================================================ */

export function lerLanc(p) {
  let l = [];
  try { l = JSON.parse((p && p.lanc) || '[]'); } catch (e) { l = []; }
  return (Array.isArray(l) ? l : []).filter((x) => x && /^\d{4}-\d{2}-\d{2}$/.test(x.d) && Number(x.ha) > 0)
    .map((x) => ({ d: x.d, ha: Number(x.ha), por: x.por || '' })).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
}

// hectares plantados por dia num talhão (nunca passa da área do talhão)
export function plantioPorDia(p, area) {
  if (!p || !p.cultura) return [];
  const l = lerLanc(p);
  if (!l.length) {
    // talhão em partes (variedades diferentes): cada parte entra na data dela
    const pt = partesDe(p, area);
    if (pt.length > 1 || (pt[0] && pt[0].ha < area)) return pt.filter((x) => x.data_plantio).map((x) => ({ d: x.data_plantio, ha: x.ha }));
    return p.data_plantio && area > 0 ? [{ d: p.data_plantio, ha: area }] : [];
  }
  let resto = area > 0 ? area : Infinity;
  return l.map((x) => { const ha = Math.min(x.ha, resto); resto -= ha; return { d: x.d, ha }; }).filter((x) => x.ha > 0);
}

export function haPlantada(p, area) { return plantioPorDia(p, area).reduce((s, x) => s + x.ha, 0); }

/* ---------------- aplicação parcial do talhão ----------------
   O operador pode lançar só parte do talhão (não deu tempo de terminar): d.parcial[t] = [{id, d, ha, por, porId}].
   Quando a soma chega na área do talhão, o talhão vira aplicado (d.feito[t]). */
export function parciaisDe(d, t) {
  const l = d && d.parcial && Array.isArray(d.parcial[t]) ? d.parcial[t] : [];
  return l.filter((x) => x && Number(x.ha) > 0);
}
// hectares já aplicados do talhão nesta aplicação (talhão todo se marcado aplicado)
export function haAplicada(d, t, ha) {
  if (d && d.feito && d.feito[t]) return ha;
  return Math.min(ha, parciaisDe(d, t).reduce((s, x) => s + Number(x.ha), 0));
}

/* ---------------- mais de uma variedade no mesmo talhão ----------------
   plantio.partes = JSON [{variedade, ha, data_plantio}] quando o talhão foi plantado em partes
   (variedades diferentes). Sem partes, o talhão inteiro é da variedade da linha. */
export function partesDe(p, area) {
  let l = [];
  try { l = typeof (p && p.partes) === 'string' ? JSON.parse(p.partes || '[]') : ((p && p.partes) || []); } catch (e) { l = []; }
  l = (Array.isArray(l) ? l : []).filter((x) => x && Number(x.ha) > 0)
    .map((x) => ({ variedade: String(x.variedade || ''), ha: Number(x.ha), data_plantio: /^\d{4}-\d{2}-\d{2}$/.test(x.data_plantio || '') ? x.data_plantio : '' }));
  if (l.length) {
    let resto = area > 0 ? area : Infinity;
    return l.map((x) => { const ha = Math.min(x.ha, resto); resto -= ha; return Object.assign(x, { ha }); }).filter((x) => x.ha > 0);
  }
  return p && (p.variedade || p.cultura) ? [{ variedade: p.variedade || '', ha: area || 0, data_plantio: p.data_plantio || '' }] : [];
}

/* ---------------- talhão dividido no mapa ----------------
   Corta o desenho do talhão em faixas (no sentido mais comprido) com a área proporcional a cada parte:
   60 ha de uma variedade num talhão de 100 ha = 60% do desenho na cor dela. */
function cortar(anel, eixo, c, menor) {
  const dentro = (p) => (menor ? p[eixo] <= c : p[eixo] >= c);
  const out = [];
  for (let i = 0; i < anel.length; i++) {
    const a = anel[i], b = anel[(i + 1) % anel.length], da = dentro(a), db = dentro(b);
    if (da) out.push(a);
    if (da !== db) {
      const t = (c - a[eixo]) / (b[eixo] - a[eixo]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
const areaPlana = (anel) => { let s = 0; for (let i = 0; i < anel.length; i++) { const a = anel[i], b = anel[(i + 1) % anel.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };

// geometry (GeoJSON) + partes [{variedade, ha}] → [{variedade, ha, aneis: [[lon,lat]...]}]
export function dividirTalhao(geometry, partes) {
  if (!geometry || !partes || partes.length < 2) return [];
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  const ext = polys.map((p) => p[0]).filter((r) => r && r.length > 2);
  if (!ext.length) return [];
  let lat0 = 0, n = 0; ext.forEach((r) => r.forEach((q) => { lat0 += q[1]; n++; }));
  const k = Math.cos((lat0 / n) * Math.PI / 180);
  const an = ext.map((r) => r.map((q) => [q[0] * k, q[1]]));   // longitude encolhida: área proporcional à real
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  an.forEach((r) => r.forEach((q) => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }));
  const eixo = x1 - x0 >= y1 - y0 ? 0 : 1, lo = eixo ? y0 : x0, hi = eixo ? y1 : x1;
  const ate = (c) => an.reduce((s, r) => { const q = cortar(r, eixo, c, true); return s + (q.length > 2 ? areaPlana(q) : 0); }, 0);
  const total = ate(hi) || 1, soma = partes.reduce((s, x) => s + Number(x.ha), 0) || 1;
  const cortes = [lo]; let acum = 0;
  partes.forEach((x, i) => {
    acum += Number(x.ha);
    if (i === partes.length - 1) { cortes.push(hi); return; }
    const alvo = total * acum / soma; let a = lo, b = hi;
    for (let it = 0; it < 40; it++) { const m = (a + b) / 2; if (ate(m) < alvo) a = m; else b = m; }
    cortes.push((a + b) / 2);
  });
  return partes.map((x, i) => ({
    variedade: x.variedade, ha: Number(x.ha),
    aneis: an.map((r) => cortar(cortar(r, eixo, cortes[i], false), eixo, cortes[i + 1], true))
      .filter((q) => q.length > 2).map((q) => { const f = q.map((p) => [p[0] / k, p[1]]); f.push(f[0]); return f; })
  })).filter((x) => x.aneis.length);
}
