-- Banco D1 do Relatório VSL
-- aplicado com: npx wrangler d1 execute relatorio-vsl --remote --file=schema.sql
-- (ou colando no console de D1 do painel da Cloudflare)

CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- ---------- quem usa o app ----------
CREATE TABLE IF NOT EXISTS usuarios (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  senha_hash  TEXT NOT NULL,
  nome        TEXT DEFAULT '',
  criado_em   TEXT DEFAULT (datetime('now'))
);

-- ---------- cadastro ----------
CREATE TABLE IF NOT EXISTS produtores (
  id          TEXT PRIMARY KEY,
  usuario_id  TEXT NOT NULL,
  nome        TEXT NOT NULL,
  documento   TEXT DEFAULT '',
  telefone    TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  criado_em   TEXT DEFAULT (datetime('now')),
  atualizado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fazendas (
  id           TEXT PRIMARY KEY,
  usuario_id   TEXT NOT NULL,
  produtor_id  TEXT,
  nome         TEXT NOT NULL,
  municipio    TEXT DEFAULT '',
  uf           TEXT DEFAULT '',
  area_ha      REAL DEFAULT 0,
  talhoes      TEXT DEFAULT '',     -- GeoJSON do KML importado
  n_talhoes    INTEGER DEFAULT 0,
  criado_em    TEXT DEFAULT (datetime('now')),
  atualizado_em TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS produtores_usuario ON produtores (usuario_id, nome);
CREATE INDEX IF NOT EXISTS fazendas_usuario  ON fazendas (usuario_id, nome);

-- ---------- relatórios ----------
CREATE TABLE IF NOT EXISTS relatorios (
  id            TEXT PRIMARY KEY,
  usuario_id    TEXT,
  produtor_id   TEXT,
  fazenda_id    TEXT,
  produtor      TEXT DEFAULT '',
  fazenda       TEXT DEFAULT '',
  safra         TEXT DEFAULT '',
  servico       TEXT DEFAULT '',
  responsavel   TEXT DEFAULT '',
  data_inicio   TEXT,
  data_fim      TEXT,
  observacoes   TEXT DEFAULT '',
  talhoes       TEXT DEFAULT '',
  status        TEXT DEFAULT 'rascunho',
  publicado_em  TEXT,
  criado_em     TEXT DEFAULT (datetime('now')),
  atualizado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS itens (
  id           TEXT PRIMARY KEY,
  relatorio_id TEXT NOT NULL,
  tipo         TEXT NOT NULL,
  legenda      TEXT DEFAULT '',
  midia        TEXT,
  thumb        TEXT,
  mime         TEXT,
  duracao_s    REAL,
  bytes        INTEGER,
  lat          REAL,
  lon          REAL,
  precisao_m   REAL,
  altitude_m   REAL,
  talhao       TEXT,
  talhao_id    TEXT,
  capturado_em TEXT NOT NULL,
  ordem        INTEGER DEFAULT 0,
  criado_em    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS itens_rel ON itens (relatorio_id, capturado_em);
CREATE INDEX IF NOT EXISTS relatorios_usuario ON relatorios (usuario_id, criado_em);

-- ---------- identidade da empresa por usuário ----------
CREATE TABLE IF NOT EXISTS perfis (
  usuario_id    TEXT PRIMARY KEY,
  empresa       TEXT DEFAULT '',
  cidade        TEXT DEFAULT '',
  logo          TEXT DEFAULT '',   -- imagem em data URL (jpg/png)
  atualizado_em TEXT DEFAULT (datetime('now'))
);

-- ---------- safras ----------
CREATE TABLE IF NOT EXISTS safras (
  id         TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  nome       TEXT NOT NULL,
  criado_em  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS safras_usuario ON safras (usuario_id, nome);

-- ---------- administrador ----------
-- marca quem pode abrir /admin. Rode uma vez e depois:
--   UPDATE usuarios SET admin = 1 WHERE email = 'seu@email.com';
ALTER TABLE usuarios ADD COLUMN admin INTEGER DEFAULT 0;
