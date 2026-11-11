/* Previsão de colheita = dia plantado + ciclo do material.
   Usada no painel (quadro de evolução) e no login da fazenda (portal), para os dois mostrarem a mesma curva. */
import { lerLanc, partesDe, plantioPorDia } from './plantiodia.js';
import { chaveCult, cicloMaterial } from './cultivares.js';

// ciclo padrão quando o material não tem ciclo informado nem GMR (mesmo valor do portal e do app)
export const CICLO_PADRAO = { soja: 115, milho: 135, algodao: 180, feijao: 90, sorgo: 120, outra: 120 };
const SEM_PLANTIO = { pastagem: 1, pousio: 1 };

function somaDias(iso, k) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); }

// ciclo de cada material de uma conta: linhas da tabela ciclos + regra do GMR
export function cicloDaConta(linhas, regra) {
  const porChave = {}, memo = {};
  (linhas || []).forEach((l) => { porChave[chaveCult(l.variedade)] = l; });
  return (variedade, cultura) => {
    const k = chaveCult(variedade) + '|' + (cultura || '');
    if (!(k in memo)) {
      const c = variedade ? cicloMaterial(variedade, cultura, porChave[chaveCult(variedade)], regra) : null;
      memo[k] = c && c.dias ? { dias: c.dias, est: false } : CICLO_PADRAO[cultura] ? { dias: CICLO_PADRAO[cultura], est: true } : null;
    }
    return memo[k];
  };
}

/* hectares com colheita prevista por dia, de um talhão:
   talhão em partes → cada parte na data dela; senão → cada dia plantado (lançamento do dia) + ciclo */
export function previsaoTalhao(p, area, cicloDe, colhido) {
  if (!p || !p.cultura || SEM_PLANTIO[p.cultura]) return [];
  const pt = partesDe(p, area), dias = plantioPorDia(p, area);
  const dia1 = dias.map((x) => x.d).sort()[0] || '';
  let itens;
  if (lerLanc(p).some((x) => x.v)) {
    // fazenda lançou mais de uma variedade no plantio do dia: cada dia com a variedade dele
    itens = dias.map((x) => ({ v: x.v || p.variedade || '', d: x.d, ha: x.ha }));
  } else if (pt.length > 1 && !lerLanc(p).length) {
    // sem lançamento por dia: cada parte com data de plantio (igual à evolução do plantio)
    itens = pt.filter((x) => x.data_plantio).map((x) => ({ v: x.variedade, d: x.data_plantio, ha: x.ha }));
  } else if (pt.length > 1) {
    // com lançamento por dia: só a área já plantada entra; as partes ficam na proporção dela
    const plantado = dias.reduce((s, x) => s + x.ha, 0), soma = pt.reduce((s, x) => s + x.ha, 0);
    const f = soma > 0 ? Math.min(1, plantado / soma) : 0;
    itens = pt.map((x) => ({ v: x.variedade, d: x.data_plantio || p.data_plantio || dia1, ha: x.ha * f }));
  } else itens = dias.map((x) => ({ v: (pt[0] && pt[0].variedade) || p.variedade || '', d: x.d, ha: x.ha }));
  const out = [];
  itens.forEach((x) => {
    if (!x.d || !(x.ha > 0)) return;
    const c = cicloDe(x.v, p.cultura);
    if (!c) return;
    out.push({ d: somaDias(x.d, c.dias), mat: x.v || '', cultura: p.cultura, ha: x.ha, est: c.est, col: !!colhido });
  });
  return out;
}

// junta os itens iguais (mesmo dia, material e situação) para mandar pouco dado
export function juntarPrevisao(lista) {
  const g = {};
  lista.forEach((x) => {
    const k = x.d + '|' + x.mat + '|' + x.cultura + '|' + (x.col ? 1 : 0);
    const o = g[k] || (g[k] = { d: x.d, mat: x.mat, cultura: x.cultura, ha: 0, est: false, col: x.col });
    o.ha += x.ha; if (x.est) o.est = true;
  });
  return Object.values(g).map((o) => Object.assign(o, { ha: Math.round(o.ha * 100) / 100 })).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
}
