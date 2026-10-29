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
