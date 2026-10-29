/* ============================================================
   termos.js — aceite dos Termos de Uso e Privacidade no primeiro acesso
   Aparece uma vez por versão dos termos (e por conta). No mesmo toque de "Aceitar",
   o celular pede a permissão de notificação para os avisos de aplicação — uma vez só;
   depois o app não pergunta mais. O aceite vale na conta: em outro aparelho já
   aceito, a tela não volta.
   ============================================================ */
(function (global) {
  'use strict';

  var VERSAO = '2026-10-29';          // igual a TERMOS_VERSAO em src/termos.js
  var LS = 'vsl-termos:';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function lerLocal(email) { try { return JSON.parse(localStorage.getItem(LS + (email || '')) || 'null'); } catch (e) { return null; } }
  function gravarLocal(email, o) { try { localStorage.setItem(LS + (email || ''), JSON.stringify(o)); } catch (e) { /* sem espaço */ } }

  async function conf() {
    var c = await Sync.conf();
    return { api: String(c.api || location.origin).replace(/\/$/, ''), token: c.token, email: c.email || '' };
  }
  async function chamar(c, rota, corpo) {
    var r = await fetch(c.api + rota, {
      method: corpo ? 'POST' : 'GET',
      headers: Object.assign({ Authorization: 'Bearer ' + c.token }, corpo ? { 'Content-Type': 'application/json' } : {}),
      body: corpo ? JSON.stringify(corpo) : undefined
    });
    var j = null; try { j = await r.json(); } catch (e) { /* sem corpo */ }
    if (!r.ok) { var e = new Error((j && j.erro) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return j;
  }

  // aceite feito sem internet: sobe na próxima abertura com conexão
  async function enviarPendente(c, loc) {
    if (!navigator.onLine) return;
    try {
      await chamar(c, '/api/termos/aceitar', { versao: VERSAO, em: loc.em, avisos: !!loc.avisos });
      loc.pend = false; gravarLocal(c.email, loc);
    } catch (e) { /* tenta de novo depois */ }
  }

  var aberto = null;
  // devolve uma promessa que resolve quando os termos estão aceitos
  async function checar() {
    if (aberto) return aberto;
    var c = await conf();
    if (!c.token) return true;
    var loc = lerLocal(c.email);
    if (loc && loc.v === VERSAO) { if (loc.pend) enviarPendente(c, loc); return true; }
    if (navigator.onLine) {
      try {
        var r = await chamar(c, '/api/termos');
        if (r.aceito && r.versao === VERSAO) { gravarLocal(c.email, { v: VERSAO, em: r.aceito_em }); return true; }
      } catch (e) {
        if (e.status === 401) return true;   // sessão vencida: o login aparece antes e pergunta depois
      }
    }
    aberto = mostrar(c).then(function () { aberto = null; return true; });
    return aberto;
  }

  function podeAvisar() { return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window; }

  function mostrar(c) {
    return new Promise(function (resolve) {
      var d = document.createElement('div');
      d.className = 'termos-tela';
      var avisos = podeAvisar() && Notification.permission !== 'denied';
      d.innerHTML =
        '<div class="termos-card">' +
          '<div class="termos-topo"><div class="termos-ic">📄</div><h2>Termos de Uso e Privacidade</h2>' +
          '<p>Para usar o AMVS Relatório, leia e aceite os termos. É só desta vez.</p></div>' +
          '<div class="termos-texto" id="termosTexto"><p style="color:#667781">Carregando os termos…</p></div>' +
          '<label class="termos-ck"><input type="checkbox" id="termosOk"> <span>Li e aceito os <b>Termos de Uso</b> e a <b>Política de Privacidade</b>.</span></label>' +
          (avisos ? '<label class="termos-ck"><input type="checkbox" id="termosAvisos" checked> <span>Quero receber no celular os <b>avisos das aplicações próximas</b> (o celular vai pedir permissão uma vez).</span></label>' : '') +
          '<button class="btn" id="termosAceitar" disabled>Aceitar e continuar</button>' +
          '<button class="termos-sair" id="termosSair">Não aceito — sair da conta</button>' +
        '</div>';
      document.body.appendChild(d);

      fetch(c.api + '/termos?fragmento=1', { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : Promise.reject(); }).then(function (h) {
        d.querySelector('#termosTexto').innerHTML = h;
      }).catch(function () {
        d.querySelector('#termosTexto').innerHTML = '<p>Sem conexão para carregar o texto completo agora. ' +
          'Você pode ler depois em <b>' + esc(c.api.replace(/^https?:\/\//, '')) + '/termos</b>.</p>';
      });

      var ok = d.querySelector('#termosOk'), bt = d.querySelector('#termosAceitar');
      ok.onchange = function () { bt.disabled = !ok.checked; };

      bt.onclick = function () {
        if (!ok.checked) return;
        var querAvisos = !!(d.querySelector('#termosAvisos') && d.querySelector('#termosAvisos').checked);
        // a permissão tem que ser pedida aqui, dentro do toque (o iPhone só pergunta assim)
        if (querAvisos && Notification.permission === 'default') {
          Notification.requestPermission().then(function (p) {
            if (p === 'granted' && global.Agro && Agro.assinarPush) Agro.assinarPush().catch(function () {});
          }).catch(function () {});
        } else if (querAvisos && Notification.permission === 'granted' && global.Agro && Agro.assinarPush) {
          Agro.assinarPush().catch(function () {});
        }
        try { localStorage.setItem('vsl-push-perguntado', '1'); } catch (e) {}   // não pergunta de novo
        var loc = { v: VERSAO, em: new Date().toISOString(), avisos: querAvisos, pend: true };
        gravarLocal(c.email, loc);
        enviarPendente(c, loc);
        d.remove();
        resolve();
      };

      d.querySelector('#termosSair').onclick = async function () {
        if (!confirm('Sem aceitar os termos não dá para usar o app. Sair da conta?')) return;
        await Sync.sair();
        location.reload();
      };
    });
  }

  global.Termos = { checar: checar, VERSAO: VERSAO };
})(window);
