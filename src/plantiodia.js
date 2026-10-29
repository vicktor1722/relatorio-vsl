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
  if (!l.length) return p.data_plantio && area > 0 ? [{ d: p.data_plantio, ha: area }] : [];
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
