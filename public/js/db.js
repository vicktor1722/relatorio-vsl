/* ============================================================
   db.js — IndexedDB offline-first (relatórios, itens, mídias)
   ============================================================ */
(function (global) {
  'use strict';

  const NOME = 'krigify-relatorio';
  const VERSAO = 1;
  let _db = null;

  function abrir() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(NOME, VERSAO);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('relatorios')) {
          db.createObjectStore('relatorios', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('itens')) {
          const s = db.createObjectStore('itens', { keyPath: 'id' });
          s.createIndex('relatorio', 'relatorio_id');
          s.createIndex('sync', 'sync_state');
        }
        if (!db.objectStoreNames.contains('midias')) {
          db.createObjectStore('midias', { keyPath: 'id' }); // { id, blob }
        }
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'chave' });
        }
      };
      req.onsuccess = function () { _db = req.result; resolve(_db); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(store, modo) {
    return abrir().then(function (db) {
      return db.transaction(store, modo || 'readonly').objectStore(store);
    });
  }

  function pedido(r) {
    return new Promise(function (res, rej) {
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }

  const DB = {
    async put(store, valor) { const s = await tx(store, 'readwrite'); return pedido(s.put(valor)); },
    async get(store, id) { const s = await tx(store); return pedido(s.get(id)); },
    async del(store, id) { const s = await tx(store, 'readwrite'); return pedido(s.delete(id)); },
    async all(store) { const s = await tx(store); return pedido(s.getAll()); },

    async itensDoRelatorio(relId) {
      const s = await tx('itens');
      const idx = s.index('relatorio');
      const lista = await pedido(idx.getAll(relId));
      return lista.sort(function (a, b) { return a.capturado_em.localeCompare(b.capturado_em); });
    },

    async pendentes() {
      const todos = await DB.all('itens');
      return todos.filter(function (i) { return i.sync_state !== 'ok'; });
    },

    async salvarMidia(id, blob) { return DB.put('midias', { id: id, blob: blob }); },
    async lerMidia(id) { const m = await DB.get('midias', id); return m ? m.blob : null; },

    async cfg(chave, valor) {
      if (valor === undefined) { const r = await DB.get('config', chave); return r ? r.valor : null; }
      return DB.put('config', { chave: chave, valor: valor });
    },

    async apagarRelatorio(relId) {
      const itens = await DB.itensDoRelatorio(relId);
      for (const it of itens) { await DB.del('midias', it.id); await DB.del('itens', it.id); }
      await DB.del('relatorios', relId);
    },

    async uso() {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        return { usado: e.usage || 0, cota: e.quota || 0 };
      }
      return { usado: 0, cota: 0 };
    }
  };

  // id curto ordenável por tempo
  function novoId(prefixo) {
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 8);
    return (prefixo || '') + t + r;
  }

  global.DB = DB;
  global.novoId = novoId;
})(window);
