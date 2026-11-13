/* ============================================================
   chuvatalhao.js — chuva lançada por talhão (pluviômetro da fazenda)
   O dono/gerente lança no portal: data, milímetros e os talhões onde choveu. Um lançamento (lote) grava uma
   linha por talhão; a mesma data no mesmo talhão de novo corrige o valor (não soma duas vezes).
   O portal e o app do consultor somam as linhas no período (safra, 30 dias, 7 dias) e pintam o mapa.
   ============================================================ */
import { novoId } from './auth.js';

let pronto = false;
export async function garantirChuva(env) {
  if (pronto) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS chuva_talhao (
      id TEXT PRIMARY KEY, lote TEXT, dono_id TEXT NOT NULL, fazenda_id TEXT NOT NULL, talhao TEXT NOT NULL,
      data TEXT NOT NULL, mm REAL NOT NULL, por TEXT, criado_em TEXT, UNIQUE (fazenda_id, talhao, data))`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS chuva_faz ON chuva_talhao (dono_id, fazenda_id, data)')
  ]);
  pronto = true;
}

// safra "2026/2027" → de 01/07/2026 a 30/06/2027 (ano agrícola)
export function periodoSafra(safra) {
  const m = String(safra || '').match(/^(\d{4})/);
  const a = m ? Number(m[1]) : new Date().getUTCFullYear() - (new Date().getUTCMonth() < 6 ? 1 : 0);
  return { de: a + '-07-01', ate: (a + 1) + '-06-30' };
}

export async function listarChuva(env, dono, fid, safra) {
  await garantirChuva(env);
  const p = periodoSafra(safra);
  const { results } = await env.DB.prepare('SELECT lote, talhao, data, mm, por, criado_em FROM chuva_talhao WHERE dono_id = ? AND fazenda_id = ? AND data >= ? AND data <= ? ORDER BY data DESC, criado_em DESC')
    .bind(dono, fid, p.de, p.ate).all();
  return { periodo: p, chuvas: results || [] };
}

// talhoes: nomes já conferidos no mapa da fazenda; mm em milímetros (0 < mm ≤ 500)
export async function lancarChuva(env, dono, fid, data, mm, talhoes, por) {
  await garantirChuva(env);
  const lote = novoId(), em = new Date().toISOString();
  await env.DB.batch(talhoes.map((t) => env.DB.prepare(`INSERT INTO chuva_talhao (id, lote, dono_id, fazenda_id, talhao, data, mm, por, criado_em)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(fazenda_id, talhao, data) DO UPDATE SET lote = excluded.lote, mm = excluded.mm, por = excluded.por, criado_em = excluded.criado_em
      WHERE chuva_talhao.dono_id = excluded.dono_id`).bind(novoId(), lote, dono, fid, t, data, mm, por, em)));
  return { lote, talhoes: talhoes.length };
}

export async function apagarChuva(env, dono, fid, lote) {
  await garantirChuva(env);
  const r = await env.DB.prepare('DELETE FROM chuva_talhao WHERE dono_id = ? AND fazenda_id = ? AND lote = ?').bind(dono, fid, lote).run();
  return { apagados: (r.meta && r.meta.changes) || 0 };
}
