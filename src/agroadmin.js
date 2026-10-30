/* ============================================================
   agroadmin.js — pedaços do painel /admin ligados a Plantio e Recomendações.
   O admin.js só encaixa estes textos em lugares marcados; aqui ficam
   abas, estilos e o JavaScript do painel. (Dentro de um template literal do
   admin.js: nada de crases nem de dólar+chave aqui.)
   ============================================================ */

export const AGRO_ABAS =
  '<button data-aba="plantio" id="abaPlantio" style="display:none">Plantio</button>' +
  '<button data-aba="recs" id="abaRecs" style="display:none">Recomendações</button>' +
  '<button data-aba="custo" id="abaCusto" style="display:none">Custo × produção</button>' +
  '<button data-aba="acessos" id="abaAcessos" style="display:none">Acessos fazenda</button>' +
  '<button data-aba="modulos" id="abaModulos" style="display:none">Módulos</button>';

export const AGRO_PAINEIS = `
    <section class="painel" id="pPlantio"><div id="agPlantio" class="ag-tela"></div></section>
    <section class="painel" id="pRecs"><div id="agRecs" class="ag-tela"></div></section>
    <section class="painel" id="pCusto"><div id="agCusto"><div class="aviso">Carregando…</div></div></section>
    <section class="painel" id="pAcessos"><div id="agAcessos"><div class="aviso">Carregando…</div></div></section>
    <section class="painel" id="pModulos">
      <div id="boxModulos"><div class="aviso">Carregando…</div></div>
    </section>
`;

export const AGRO_CSS = `
.sw{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.35;cursor:pointer}
.sw input{width:22px;height:22px;flex:none;accent-color:var(--verde);margin-top:1px}
.ck{display:inline-flex;align-items:center;gap:6px;font-size:13px;cursor:pointer}
.ck input{width:20px;height:20px;accent-color:var(--verde)}
.ck.fixo{color:var(--fraco);cursor:default}
.nota{font-size:12.5px;color:var(--fraco);line-height:1.4;margin:6px 0 0}
/* ---------- Acessos da fazenda / operador ---------- */
.ac-topo{background:#EEF6F0;border:1px solid #CFE5D6;border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:14px;line-height:1.45}
.ac-topo a{color:var(--verde);font-weight:700}
.ac-lista{background:#fff;border:1px solid var(--linha);border-radius:12px;overflow-x:auto}
.ac-lista table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:620px}
.ac-lista th{text-align:left;font-size:11.5px;color:var(--fraco);padding:8px 10px;border-bottom:1px solid var(--linha)}
.ac-lista td{padding:9px 10px;border-bottom:1px solid #EEF1EF;vertical-align:top}
.ac-tipo{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:10px;background:#E6F0FA;color:#1A4E85}
.ac-tipo.op{background:#FFF3DC;color:#8A5A00}
.ac-fz{display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto;border:1px solid var(--linha);border-radius:10px;padding:8px 10px;margin-bottom:12px}
.ac-fz label{display:flex;gap:8px;align-items:center;font-size:14px}.ac-fz input{width:18px;height:18px;accent-color:var(--verde)}
.ag-reg{font-size:12.5px;color:#1A4E85;margin-top:3px;line-height:1.4;overflow-wrap:anywhere}
.ag-regf{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}.ag-regf img{width:64px;height:64px;object-fit:cover;border-radius:8px;display:block}
/* ---------- Custo × produção ---------- */
.cp-topo{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:12px}
.cp-topo label{display:block;font-size:12px;color:var(--fraco);margin-bottom:3px}
.cp-topo select,.cp-topo input{padding:8px 10px;border:1px solid var(--linha);border-radius:8px;font-size:14px;background:#fff}
.cp-topo input{width:110px}
.cp-faz{background:#fff;border:1px solid var(--linha);border-radius:12px;padding:12px;margin:0 0 14px;overflow-x:auto}
.cp-faz h3{margin:0 0 2px;font-size:16px;color:var(--verde-escuro)}
.cp-faz .sub{font-size:12.5px;color:var(--fraco);margin-bottom:8px}
.cp-kpis{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 10px}
.cp-kpis div{background:#F3F7F4;border-radius:10px;padding:8px 12px;min-width:120px}
.cp-kpis b{display:block;font-size:17px;color:var(--verde-escuro)}.cp-kpis span{font-size:11.5px;color:var(--fraco)}
.cp-faz table{width:100%;border-collapse:collapse;font-size:13px;min-width:640px}
.cp-faz th{text-align:right;font-size:11.5px;color:var(--fraco);font-weight:600;padding:6px 6px;border-bottom:1px solid var(--linha);white-space:nowrap}
.cp-faz td{text-align:right;padding:6px;border-bottom:1px solid #EEF1EF;white-space:nowrap}
.cp-faz th:first-child,.cp-faz td:first-child{text-align:left}
.cp-faz tr.tot td{font-weight:700;border-top:2px solid var(--linha);border-bottom:0}
.cp-pos{color:#1B7A43}.cp-neg{color:#C62828}.cp-sem{color:var(--fraco)}
.cp-barra{height:8px;border-radius:4px;background:#E3E8E5;overflow:hidden;min-width:70px}
.cp-barra i{display:block;height:100%;background:#D9A21B}
.cp-aviso{background:#FFF3DC;color:#7A5200;border-radius:10px;padding:8px 10px;font-size:12.5px;margin:8px 0 0}
/* ---------- Plantio e Recomendações (módulos novos) ---------- */
.ag-nova-aba::after{content:"novo";margin-left:6px;background:#E53935;color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;text-transform:uppercase;vertical-align:middle}
.ag-novo{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
.ag-novo-card{background:#fff;border-radius:16px;padding:22px 20px;max-width:380px;width:100%;text-align:center}
.ag-novo-ic{font-size:40px}.ag-novo-card h3{margin:6px 0 8px;font-size:19px;color:#146034}
.ag-novo-card p{font-size:14.5px;line-height:1.45;color:#333;margin:0 0 10px}.ag-novo-como{background:#EEF6F0;border-radius:10px;padding:8px 10px}
.ag-novo-card .btn{width:100%;margin:6px 0 0}
.ag-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px;align-items:center}
.ag-chips>span{font-size:12.5px;color:var(--texto-fraco)}
.ag-chip{padding:7px 12px;border-radius:16px;background:#fff;border:1px solid var(--linha);font-size:13px}
.ag-chip.on{background:var(--verde);color:#fff;border-color:var(--verde)}
.ag-dica{font-size:12.5px;color:var(--texto-fraco);margin:2px 0 12px;line-height:1.4}
.ag-nota{font-size:12.5px;color:var(--texto-fraco);margin:10px 2px;line-height:1.4}
.ag-nota.aviso-obs{background:#FFF3DC;color:#7A5200;padding:10px 12px;border-radius:10px}
.ag-l{display:block;font-size:12.5px;color:var(--texto-fraco);margin:6px 0 4px}
.ag-tal .ic{font-size:20px}
.ag-barra{height:5px;border-radius:3px;background:#E4EAE6;margin-top:6px;overflow:hidden}
.ag-barra i{display:block;height:100%;background:var(--verde-acento)}
.ag-barra.b{background:rgba(255,255,255,.3);margin-top:8px}
.ag-barra.b i{background:#fff}
.ag-capa{background:linear-gradient(135deg,#146034,#1B7A43);color:#fff;border-radius:14px;padding:14px 16px;margin-bottom:10px}
.ag-capa h3{margin:4px 0 2px;font-size:21px}
.ag-capa small{font-size:12px;opacity:.92}
.ag-sec{background:#fff;border-radius:12px;padding:12px;margin:10px 0;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.ag-sec.azul{background:#E6F0FA}
.ag-sec>b{display:block;font-size:14px;margin-bottom:4px}
.ag-sec small{display:block;font-size:12.5px;color:var(--texto-fraco);margin:2px 0 6px;line-height:1.4}
.ag-mix{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid rgba(0,0,0,.06);font-size:14px}
.ag-mix span{flex:1;min-width:0}
.ag-mix em{font-style:normal;font-weight:600;white-space:nowrap}
.ag-ord{width:22px;height:22px;border-radius:50%;background:var(--verde);color:#fff;font-size:12px;display:inline-grid;place-items:center;flex:none}
.ag-talc{background:#fff;border-radius:12px;padding:12px;margin-bottom:10px;border-left:4px solid #D0D6D2;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.ag-talc.ok{border-left-color:var(--verde-acento);background:#F4FBF6}
.ag-tt{display:flex;justify-content:space-between;align-items:baseline}
.ag-tt b{font-size:16px}.ag-tt span{font-size:12.5px;color:var(--texto-fraco)}
.ag-tp{margin:6px 0 2px}
.ag-tp div{display:flex;justify-content:space-between;font-size:13.5px;padding:3px 0}
.ag-feito{margin-top:8px;font-size:13.5px;color:var(--verde-escuro);font-weight:600}
.ag-link{color:var(--texto-fraco);text-decoration:underline;font-size:12.5px;margin-left:6px;font-weight:400}
.ag-sw{display:flex;gap:10px;align-items:flex-start;font-size:14px;margin:14px 0 4px;line-height:1.35}
.ag-sw input{width:22px;height:22px;flex:none;accent-color:var(--verde)}
.ag-alerta{display:flex;gap:10px;align-items:center;background:#fff;border-radius:12px;padding:10px 12px;margin-bottom:8px;border-left:4px solid #2E8B8B;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.ag-alerta.venc,.ag-alerta.hoje{border-left-color:#C0392B}
.ag-alerta.perto{border-left-color:#E0A100}
.ag-ai{font-size:20px}
.ag-ac{flex:1;min-width:0;font-size:14px}
.ag-ac span.badge{margin-left:4px}
.ag-ac>span:not(.badge){display:block;font-size:12.5px;color:var(--texto-fraco);margin-top:2px}
.ag-peq{padding:8px 12px;border-radius:10px;background:var(--verde);color:#fff;font-size:13px;font-weight:600;flex:none}
.ag-passos{display:flex;gap:6px;margin-bottom:12px}
.ag-passo{flex:1;text-align:center;font-size:12.5px;color:var(--texto-fraco);padding:6px 4px;border-radius:10px;background:#fff}
.ag-passo b{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#E4EAE6;margin-right:5px;font-size:11px}
.ag-passo.on{color:var(--verde-escuro);font-weight:600;box-shadow:inset 0 0 0 1.5px var(--verde)}
.ag-passo.on b,.ag-passo.ok b{background:var(--verde);color:#fff}
.ag-mapa{background:#fff;border-radius:12px;padding:6px;margin-bottom:8px}
.ag-mapa svg{width:100%;height:auto;max-height:340px;display:block}
.ag-poly{fill:#CFE3D5;stroke:#fff;stroke-width:3;cursor:pointer}
.ag-poly.feito{fill:#A8D5B5}
.ag-poly.on{fill:var(--verde-acento);stroke:var(--verde-escuro);stroke-width:4}
.ag-mapa text{font-size:24px;font-weight:700;fill:#10331f;pointer-events:none;paint-order:stroke;stroke:#fff;stroke-width:4px}
.ag-resumo-ha{background:#fff;border-radius:10px;padding:10px 12px;font-size:14px;margin-bottom:6px}
.ag-seq{background:#E6F0FA;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.45;margin-bottom:12px}
.ag-prod{background:#fff;border-radius:12px;padding:10px;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.ag-pt{display:flex;gap:10px;align-items:center}
.ag-pt .ag-ord{width:30px;height:30px;font-size:15px}
.ag-pt select{flex:1;min-width:0;min-height:50px;padding:12px 10px;border:1px solid var(--linha);border-radius:12px;background:#fff;font-size:17px}
.ag-mv{display:flex;gap:4px}
.ag-mv button{width:46px;height:46px;border-radius:10px;background:#F0F2F1;font-size:20px}
.ag-dose{display:flex;align-items:center;gap:8px;margin-top:12px;flex-wrap:wrap}
.ag-dose>button{width:50px;height:50px;border-radius:12px;background:#F0F2F1;font-size:26px;flex:none}
.ag-dose input{width:110px;min-height:50px;padding:12px;border:1px solid var(--linha);border-radius:12px;text-align:center;font-size:18px}
.ag-dose select{min-height:50px;padding:12px 8px;border:1px solid var(--linha);border-radius:12px;background:#fff;font-size:17px}
.ag-tot{flex-basis:100%;font-size:12.5px;color:var(--texto-fraco)}
.ag-duas{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.ag-duas .btn{margin-top:0;font-size:13.5px;padding:11px 6px}
.ag-rep{background:#fff;border-radius:12px;padding:10px 12px;margin-bottom:12px}
.ag-g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}
.ag-g3 label{font-size:11.5px}
.ag-rodape{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:8px;margin-top:14px}
.ag-rodape .btn{margin-top:0}
.ag-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3000;display:flex;align-items:flex-end;justify-content:center}
.ag-mod{background:#fff;width:100%;max-width:480px;border-radius:18px 18px 0 0;padding:16px 16px calc(16px + 0px);max-height:90vh;overflow-y:auto}
.ag-mod h3{margin:0 0 8px;font-size:17px}
.ag-abas{display:flex;background:#E4EAE6;border-radius:12px;padding:3px;margin-bottom:12px}
.ag-abas button{flex:1;padding:9px;border-radius:10px;font-size:14px;font-weight:600;color:var(--texto-fraco)}
.ag-abas button.on{background:#fff;color:var(--verde-escuro);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.ag-calhead{display:flex;align-items:center;justify-content:space-between;margin:4px 0 8px}
.ag-calhead b{font-size:16px}
.ag-calhead button{width:40px;height:40px;border-radius:50%;background:#fff;font-size:22px;box-shadow:0 1px 2px rgba(0,0,0,.1)}
.ag-grade{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
.ag-dow{text-align:center;font-size:11px;color:var(--texto-fraco);padding:2px 0}
.ag-dia{aspect-ratio:1/1.05;background:#fff;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:5px;font-size:14px;gap:3px}
.ag-dia.hoje{box-shadow:inset 0 0 0 1.5px var(--verde)}
.ag-dia.sel{background:#E4F2E8;color:#14532D;font-weight:800;box-shadow:inset 0 0 0 2.5px var(--verde)}
.ag-dia i{display:flex;gap:2px;height:6px}
.ag-grade u,.ag-leg u{display:inline-block;width:6px;height:6px;border-radius:50%;text-decoration:none}
u.c-prev{background:#3B78C3}u.c-apl{background:#2F9E5B}u.c-perto{background:#E0A100}u.c-venc{background:#C0392B}u.c-ok{background:#2E8B8B}
.ag-leg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px;color:var(--texto-fraco);margin:8px 2px}
.ag-leg u{margin-right:4px}
.ag-alerta.c-prev{border-left-color:#3B78C3}.ag-alerta.c-apl{border-left-color:#2F9E5B}.ag-alerta.c-perto{border-left-color:#E0A100}.ag-alerta.c-venc{border-left-color:#C0392B}.ag-alerta.c-ok{border-left-color:#2E8B8B}

.ag-tela{max-width:720px;margin:0 auto;--texto-fraco:var(--fraco);--verde-acento:#25D366;--verde-claro:#DCF8C6}
.ag-tela h2{font-size:13px;margin:18px 0 8px;color:var(--fraco);text-transform:uppercase;letter-spacing:.5px}
.ag-tela .campo textarea{width:100%;padding:11px 12px;border:1px solid var(--linha);border-radius:9px;font:inherit;background:#fff}
.ag-tela .btn,.ag-mod .btn{display:block;margin-top:10px}
.ag-tela .btn.secundario,.ag-mod .btn.secundario{background:#fff;color:var(--verde);border:1.5px solid var(--verde)}
.ag-tela .btn.perigo,.ag-mod .btn.perigo{background:#fff;color:var(--erro);border:1.5px solid var(--erro)}
.ag-hd{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.ag-hd .info{flex:1;min-width:0}
.ag-hd h1{margin:0;font-size:18px;color:var(--verde-escuro)}
.ag-hd p{margin:1px 0 0;font-size:12.5px;color:var(--fraco)}
.ag-volta{border:1px solid var(--linha);background:#fff;border-radius:50%;width:38px;height:38px;font-size:19px;cursor:pointer}
.ag-tela button{cursor:pointer;font:inherit}
.ag-tela .lista-item{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--linha);border-radius:12px;padding:12px;margin-bottom:10px;cursor:pointer}
.ag-tela .lista-item .ic{width:42px;height:42px;border-radius:10px;background:var(--verde-claro);display:grid;place-items:center;font-size:19px;flex:none}
.ag-tela .lista-item .txt{flex:1;min-width:0}
.ag-tela .lista-item .txt b{display:block;font-size:15px}
.ag-tela .lista-item .txt span{display:block;font-size:12.5px;color:var(--fraco)}
.ag-tela .badge,.ag-mod .badge{font-size:11px;padding:3px 8px;border-radius:10px;background:#eee;color:var(--fraco);white-space:nowrap;flex:none}
.ag-tela .badge.pub{background:var(--verde-claro);color:var(--verde-escuro)}
.ag-tela .badge.fila{background:#FFF3DC;color:#8A5A00}
.ag-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#222;color:#fff;padding:11px 18px;border-radius:22px;font-size:14px;z-index:4000;max-width:90vw}
.ag-tela input[type=checkbox],.ag-mod input[type=checkbox]{width:auto}
.ag-dose input,.ag-dose select,.ag-pt select{width:auto}
.ag-pt select{flex:1}
.ag-mod .campo input,.ag-mod .campo select{width:100%;padding:11px 12px;border:1px solid var(--linha);border-radius:9px;font-size:15px;background:#fff}
.ag-mod .campo label{display:block;font-size:12px;color:var(--fraco);margin-bottom:4px}
.ag-mod .linha2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ag-abas button,.ag-dia,.ag-calhead button,.ag-mv button,.ag-dose>button,.ag-peq{border:0}
.ag-abas button{background:none}
.ag-dia{font:inherit;aspect-ratio:auto;min-height:54px}
.ag-hd .btn-mini{margin-left:auto}

/* ---------- Dashboard: plantio das áreas ---------- */
.dp-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:10px}
.dp-k{background:var(--verde-claro);border-radius:10px;padding:10px 12px;min-width:0}
.dp-k b{display:block;font-size:22px;line-height:1.15;color:var(--verde-escuro)}
.dp-k b small{font-size:12px;font-weight:400;color:var(--fraco)}
.dp-k span{font-size:12px;color:var(--fraco)}
.dp-barra{height:10px;border-radius:5px;background:var(--linha);overflow:hidden;margin-bottom:10px}
.dp-barra i{display:block;height:100%;background:var(--verde)}
.dp-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.dp-chip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;border:1px solid var(--linha);border-radius:14px;padding:4px 10px;background:#fff}
.dp-chip i{width:10px;height:10px;border-radius:50%;display:inline-block}
.dp-t{margin:16px 0 8px;font-size:13.5px;color:var(--verde-escuro)}
.dp-det>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px}
.dp-det>summary::-webkit-details-marker{display:none}
.dp-det>summary .dp-t{margin:16px 0 8px}
.dp-det>summary em{font-style:normal;font-size:12.5px;font-weight:600;color:var(--verde);white-space:nowrap}
.dp-det>summary em::after{content:"▸ Expandir"}.dp-det[open]>summary em::after{content:"▾ Recolher"}
.dp-t span{font-weight:400;color:var(--fraco);font-size:12px;margin-left:6px}
.dp-graf svg{display:block;width:100%;max-width:760px;height:auto}
.dp-gl{stroke:var(--linha);stroke-width:1}
.dp-ax{font-size:11px;fill:var(--fraco)}
.dp-ar{fill:var(--verde-claro);stroke:none}
.dp-ln{fill:none;stroke:var(--verde);stroke-width:2.5}
.dp-pt{fill:#fff;stroke:var(--verde);stroke-width:2.5}
.dp-tot{stroke:var(--fraco);stroke-width:1;stroke-dasharray:4 4}
.dp-vars{display:flex;flex-direction:column;gap:8px}
.dp-v{display:grid;grid-template-columns:minmax(120px,1.2fr) minmax(80px,2fr) minmax(86px,.8fr);gap:10px;align-items:center}
.dp-vn{min-width:0}
.dp-vn b{display:block;font-size:13.5px;overflow-wrap:anywhere}
.dp-vn span,.dp-vh span{display:block;font-size:11.5px;color:var(--fraco)}
.dp-vb{height:12px;border-radius:6px;background:var(--linha);overflow:hidden}
.dp-vb i{display:block;height:100%;border-radius:6px}
.dp-vh{text-align:right;font-size:13px}
.dp-mini{height:7px;border-radius:4px;background:var(--linha);overflow:hidden;min-width:90px;margin-bottom:3px}
.dp-mini i{display:block;height:100%;background:var(--verde)}
.dp-tab td{vertical-align:top}
@media (max-width:620px){.dp-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.dp-v{grid-template-columns:1fr 1fr}.dp-vb{grid-column:1/-1;order:3}}
`;

// String.raw: o código abaixo tem expressões regulares com barra invertida
export const AGRO_JS = String.raw`
  /* ---------- módulos por conta (Plantio e Recomendações) ---------- */
  function agroAposPainel(adm) {
    $('#abaModulos').style.display = adm ? '' : 'none';
    if (adm) agroModulos();
    agroDash(adm);
    if (window.agroIniciar) window.agroIniciar();
  }

  /* ---------- Dashboard: evolução do plantio e variedades de todas as contas ---------- */
  var DP = { dados: null, safra: '' };
  var DP_CULT = { soja: 'Soja', milho: 'Milho', algodao: 'Algodão', feijao: 'Feijão', sorgo: 'Sorgo', outra: 'Outra cultura' };
  var DP_COR = { soja: '#1B7A43', milho: '#D9A21B', algodao: '#4A86C5', feijao: '#A5603B', sorgo: '#B5483A', outra: '#7A8A80' };
  function dpN(n, d) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function dpData(i) { var p = String(i || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : '—'; }
  function dpDias(a, b) { return Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 864e5); }
  function dpSoma(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dpCult(c) { return DP_CULT[c] || c || '—'; }

  async function agroDash(adm) {
    var box = document.getElementById('caixaPlantio');
    if (!adm) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement('div'); box.className = 'caixa'; box.id = 'caixaPlantio';
      $('#kpis').insertAdjacentElement('afterend', box);
      box.innerHTML = '<h2>Plantio das áreas</h2><div class="nota">Carregando…</div>';
    }
    try { DP.dados = await api('/api/agro/admin/plantio'); }
    catch (e) { box.innerHTML = '<h2>Plantio das áreas</h2><div class="aviso ruim">' + esc(e.message) + '</div>'; return; }
    var ss = DP.dados.safras || [];
    if (!ss.length) { box.innerHTML = '<h2>Plantio das áreas</h2><div class="nota">Nenhum plantio lançado ainda. Lance na aba Plantio.</div>'; return; }
    if (!DP.safra || !ss.some(function (s) { return s.safra === DP.safra; })) DP.safra = ss[0].safra;
    dpPintar(box);
  }

  function dpGrafico(S) {
    var ev = S.linha || [];
    if (!ev.length || !S.total_ha) return '<div class="nota">Ainda não há data de plantio lançada nesta safra.</div>';
    var hojeIso = new Date().toISOString().slice(0, 10);
    var W = 640, H = 230, L = 52, R = 16, T = 16, B = 28;
    var x0 = dpSoma(ev[0].d, -1), x1 = hojeIso > ev[ev.length - 1].d ? hojeIso : ev[ev.length - 1].d;
    var rg = Math.max(1, dpDias(x1, x0));
    var X = function (d) { return L + dpDias(d, x0) / rg * (W - L - R); };
    var step = Math.max(1, Math.ceil(S.total_ha / 3 / 100) * 100), ym = step * 3;
    var Y = function (v) { return T + (1 - v / ym) * (H - T - B); };
    var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Área plantada acumulada por dia">';
    for (var k = 0; k <= 3; k++) {
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(k * step) + '" y2="' + Y(k * step) + '" class="dp-gl"/>' +
        '<text x="' + (L - 6) + '" y="' + (Y(k * step) + 4) + '" text-anchor="end" class="dp-ax">' + dpN(k * step) + '</text>';
    }
    var tk = Math.max(1, Math.ceil(rg / 6));
    for (var d = 0; d <= rg; d += tk) { var di = dpSoma(x0, d); g += '<text x="' + X(di) + '" y="' + (H - 8) + '" text-anchor="middle" class="dp-ax">' + dpData(di) + '</text>'; }
    var cum = 0, ln = 'M' + X(x0) + ',' + Y(0), pts = '';
    ev.forEach(function (e, i) {
      cum += e.ha; ln += ' H' + X(e.d) + ' V' + Y(cum);
      pts += '<circle cx="' + X(e.d) + '" cy="' + Y(cum) + '" r="' + (i === ev.length - 1 ? 5 : 3.5) + '" class="dp-pt"><title>' +
        dpData(e.d) + ': +' + dpN(e.ha, 1) + ' ha · acumulado ' + dpN(cum) + ' ha (' + dpN(cum / S.total_ha * 100, 1) + '%)</title></circle>';
    });
    ln += ' H' + X(x1);
    g += '<path d="' + ln + ' V' + Y(0) + ' Z" class="dp-ar"/><path d="' + ln + '" class="dp-ln"/>' + pts;
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(S.total_ha) + '" y2="' + Y(S.total_ha) + '" class="dp-tot"/>' +
      '<text x="' + (L + 4) + '" y="' + (Y(S.total_ha) - 5) + '" class="dp-ax">área total ' + dpN(S.total_ha) + ' ha</text></svg>';
    return g;
  }

  function dpPintar(box) {
    var S = DP.dados.safras.filter(function (s) { return s.safra === DP.safra; })[0];
    var pc = S.total_ha ? S.plantado_ha / S.total_ha * 100 : 0;
    var sel = '<select id="dpSafra" aria-label="Safra">' + DP.dados.safras.map(function (s) {
      return '<option value="' + esc(s.safra) + '"' + (s.safra === DP.safra ? ' selected' : '') + '>Safra ' + esc(s.safra) + '</option>'; }).join('') + '</select>';
    var h = '<div class="cab-caixa"><h2>Plantio das áreas</h2>' + sel + '</div>';
    h += '<div class="dp-kpis"><div class="dp-k"><b>' + dpN(pc, 1) + '%</b><span>plantado</span></div>' +
      '<div class="dp-k"><b>' + dpN(S.plantado_ha) + ' <small>ha</small></b><span>de ' + dpN(S.total_ha) + ' ha</span></div>' +
      '<div class="dp-k"><b>' + S.fazendas.length + '</b><span>' + (S.fazendas.length === 1 ? 'fazenda com plantio' : 'fazendas com plantio') + '</span></div>' +
      '<div class="dp-k"><b>' + S.variedades.length + '</b><span>' + (S.variedades.length === 1 ? 'variedade' : 'variedades') + '</span></div></div>';
    h += '<div class="dp-barra"><i style="width:' + Math.min(100, pc).toFixed(1) + '%"></i></div>';
    if (S.fora_ha) h += '<p class="nota">Pastagem e pousio ficam fora da área de plantio: ' + dpN(S.fora_ha) + ' ha.</p>';
    if (S.culturas.length) {
      h += '<div class="dp-chips">' + S.culturas.map(function (c) {
        return '<span class="dp-chip"><i style="background:' + (DP_COR[c.cultura] || DP_COR.outra) + '"></i>' + esc(dpCult(c.cultura)) + ' <b>' + dpN(c.plantado) + '</b> de ' + dpN(c.ha) + ' ha</span>'; }).join('') + '</div>';
    }
    h += '<h3 class="dp-t">Evolução do plantio</h3><div class="dp-graf">' + dpGrafico(S) + '</div>';

    var mx = S.variedades.reduce(function (m, v) { return Math.max(m, v.ha); }, 0) || 1;
    h += '<h3 class="dp-t">Variedades <span>' + dpN(S.variedades.reduce(function (a, v) { return a + v.ha; }, 0)) + ' ha com variedade informada</span></h3>';
    h += S.variedades.length ? '<div class="dp-vars">' + S.variedades.map(function (v) {
      return '<div class="dp-v"><div class="dp-vn"><b>' + esc(v.variedade) + '</b><span>' + esc(dpCult(v.cultura)) + ' · ' + v.fazendas + (v.fazendas === 1 ? ' fazenda' : ' fazendas') + '</span></div>' +
        '<div class="dp-vb"><i style="width:' + (v.ha / mx * 100).toFixed(1) + '%;background:' + (DP_COR[v.cultura] || DP_COR.outra) + '"></i></div>' +
        '<div class="dp-vh"><b>' + dpN(v.ha) + ' ha</b><span>plantado ' + dpN(v.plantado) + '</span></div></div>'; }).join('') + '</div>'
      : '<div class="nota">Nenhuma variedade informada nesta safra.</div>';

    // "Por fazenda" fica recolhido (a lista é longa); o painel lembra se a pessoa deixou aberto
    var fzAberto = false; try { fzAberto = localStorage.getItem('vsl-dp-faz') === '1'; } catch (e) {}
    h += '<details class="dp-det" id="dpFaz"' + (fzAberto ? ' open' : '') + '><summary><h3 class="dp-t">Por fazenda <span>' + S.fazendas.length + (S.fazendas.length === 1 ? ' fazenda' : ' fazendas') + '</span></h3><em></em></summary>' +
      '<div class="rolagem"><table class="dp-tab"><tr><th>Fazenda</th><th>Andamento</th><th>Período</th><th>Variedades</th></tr>' +
      S.fazendas.map(function (f) {
        var p = f.total_ha ? f.plantado_ha / f.total_ha * 100 : 0;
        return '<tr><td><b>' + esc(f.nome) + '</b><br><span class="peq">' + esc(f.produtor || f.conta) + '</span></td>' +
          '<td><div class="dp-mini"><i style="width:' + Math.min(100, p).toFixed(0) + '%"></i></div><span class="peq">' + dpN(f.plantado_ha) + ' de ' + dpN(f.total_ha) + ' ha · ' + dpN(p) + '%</span></td>' +
          '<td class="peq">' + (f.primeira ? dpData(f.primeira) + ' a ' + dpData(f.ultima) : '—') + '</td>' +
          '<td class="peq">' + (f.variedades.length ? esc(f.variedades.join(', ')) : '—') + '</td></tr>'; }).join('') + '</table></div></details>';
    if (S.sem_lancamento && S.sem_lancamento.length) {
      h += '<p class="nota">Sem plantio lançado nesta safra: ' + S.sem_lancamento.map(function (f) { return esc(f.nome) + ' (' + dpN(f.total_ha) + ' ha)'; }).join(', ') + '.</p>';
    }
    box.innerHTML = h;
    $('#dpSafra').onchange = function () { DP.safra = this.value; dpPintar(box); };
    var df = document.getElementById('dpFaz');
    if (df) df.addEventListener('toggle', function () { try { localStorage.setItem('vsl-dp-faz', df.open ? '1' : '0'); } catch (e) {} });
  }

  async function agroModulos() {
    var box = $('#boxModulos');
    var r;
    try { r = await api('/api/admin/modulos'); }
    catch (e) { box.innerHTML = '<div class="aviso ruim">' + esc(e.message) + '</div>'; return; }
    var h = '<div class="caixa"><h2>Liberar para as demais contas</h2>' +
      '<label class="sw"><input type="checkbox" id="agLib"' + (r.liberado ? ' checked' : '') + '>' +
      '<span><b>' + (r.liberado ? 'Ligado' : 'Desligado') + '</b> — quando ligado, as contas marcadas abaixo passam a ver ' +
      'Plantio dos talhões e Recomendações no app e no relatório do cliente.</span></label>' +
      '<p class="nota">Enquanto estiver desligado, só a conta administradora usa os módulos novos (fase de validação).</p></div>';
    h += '<div class="caixa"><h2>O que cada conta pode acessar</h2>' +
      '<p class="nota" style="margin:-6px 0 10px">Relatório de campo é sempre liberado. As caixas abaixo controlam as abas extras.</p>' +
      '<div class="rolagem"><table><tr><th>Conta</th><th>Plantio</th><th>Recomendações</th></tr>';
    r.contas.forEach(function (c) {
      var fixo = c.admin;
      h += '<tr><td><b>' + esc(c.nome || '—') + '</b>' + (c.admin ? ' <span class="selo adm">admin</span>' : '') +
        '<br><span style="color:var(--fraco);font-size:12px">' + esc(c.email) + '</span></td>' +
        '<td>' + agroCk(c, 'plantio', fixo) + '</td><td>' + agroCk(c, 'recomendacoes', fixo) + '</td></tr>';
    });
    h += '</table></div></div>';
    box.innerHTML = h;
    $('#agLib').onchange = async function () {
      try { await api('/api/admin/modulos', { liberado: this.checked }); agroModulos(); }
      catch (e) { alert(e.message); this.checked = !this.checked; }
    };
    box.querySelectorAll('input[data-mod]').forEach(function (inp) {
      inp.onchange = async function () {
        var linha = inp.closest('tr');
        var p = linha.querySelector('input[data-mod="plantio"]'), rc = linha.querySelector('input[data-mod="recomendacoes"]');
        try {
          await api('/api/admin/modulos', { id: inp.dataset.id, plantio: p.checked, recomendacoes: rc.checked });
        } catch (e) { alert(e.message); inp.checked = !inp.checked; }
      };
    });
  }

  function agroCk(c, mod, fixo) {
    if (fixo) return '<span class="ck fixo"><input type="checkbox" checked disabled> sempre</span>';
    return '<label class="ck"><input type="checkbox" data-mod="' + mod + '" data-id="' + esc(c.id) + '"' +
      (c[mod] ? ' checked' : '') + '> liberar</label>';
  }

(function () {
  "use strict";
  var CULTURAS = [['soja', 'Soja'], ['milho', 'Milho'], ['algodao', 'Algodão'], ['feijao', 'Feijão'], ['sorgo', 'Sorgo'],
    ['pastagem', 'Pastagem'], ['pousio', 'Pousio'], ['outra', 'Outra cultura']];
  var NOME_CULT = {}; CULTURAS.forEach(function (c) { NOME_CULT[c[0]] = c[1]; });
  var OPS = ['Dessecação', 'Adubação de base', 'Adubação de cobertura', 'Plantio', 'Fungicida', 'Inseticida', 'Herbicida pós'];
  var TIPOS = ['Herbicida', 'Fungicida', 'Inseticida', 'Fertilizante', 'Corretivo', 'Adjuvante', 'Semente', 'Outro'];
  var UNIDADES = ['L/ha', 'mL/ha', 'kg/ha', 'g/ha', 't/ha'];
  var MODELOS = {
    'Dessecação pré-plantio': ['Dessecação', [['Glifosato 480', 2, 'L/ha'], ['Óleo mineral', 0.5, 'L/ha']]],
    'Fungicida na soja': ['Fungicida', [['Fungicida duplo mix', 0.4, 'L/ha'], ['Óleo mineral', 0.5, 'L/ha']]],
    'Adubação de base': ['Adubação de base', [['MAP', 200, 'kg/ha'], ['Cloreto de potássio (KCl 60%)', 150, 'kg/ha']]],
    'Inseticida': ['Inseticida', [['Inseticida piretroide', 0.15, 'L/ha']]]
  };
  var PADRAO = [
    ['Glifosato 480', 'Herbicida', 'glifosato 480 g/L', 2, 'L/ha', 0], ['Cletodim 240', 'Herbicida', 'cletodim 240 g/L', 0.4, 'L/ha', 0],
    ['Atrazina 500', 'Herbicida', 'atrazina 500 g/L', 3, 'L/ha', 0], ['Fungicida duplo mix', 'Fungicida', 'estrobilurina + triazol', 0.4, 'L/ha', 14],
    ['Fungicida multissítio', 'Fungicida', 'mancozebe 750 g/kg', 1.5, 'kg/ha', 10], ['Inseticida piretroide', 'Inseticida', 'lambda-cialotrina 50 g/L', 0.15, 'L/ha', 10],
    ['Inseticida neonicotinoide', 'Inseticida', 'imidacloprido + bifentrina', 0.25, 'L/ha', 14], ['Cloreto de potássio (KCl 60%)', 'Fertilizante', '60% K2O', 150, 'kg/ha', 0],
    ['MAP', 'Fertilizante', '52% P2O5 · 11% N', 200, 'kg/ha', 0], ['Superfosfato simples', 'Fertilizante', '18% P2O5 · 12% S', 300, 'kg/ha', 0],
    ['Calcário dolomítico', 'Corretivo', 'PRNT 85%', 2, 't/ha', 0], ['Gesso agrícola', 'Corretivo', '16% Ca · 15% S', 1, 't/ha', 0],
    ['Óleo mineral', 'Adjuvante', 'óleo mineral 760 g/L', 0.5, 'L/ha', 0], ['Semente de soja', 'Semente', 'cultivar a definir', 60, 'kg/ha', 0],
    ['Semente de braquiária', 'Semente', 'B. Marandu · VC 70%', 8, 'kg/ha', 0]
  ];

  /* ---------------- ajudantes ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var p2 = function (n) { return ('0' + n).slice(-2); };
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function fmt(n, d) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }); }
  function numBR(v) {
    v = String(v == null ? '' : v).trim(); if (!v) return 0;
    if (v.indexOf(',') >= 0) v = v.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
    var n = parseFloat(v); return isNaN(n) ? 0 : n;
  }
  function dataBR(i) { var p = String(i || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; }
  function curta(i) { return dataBR(i).slice(0, 5); }
  function addDias(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function difDias(a, b) { return Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 864e5); }
  function novoId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function cp(o) { return JSON.parse(JSON.stringify(o)); }
  function toast(m) { var e = document.createElement('div'); e.className = 'ag-toast'; e.textContent = m; document.body.appendChild(e); setTimeout(function () { e.remove(); }, 2600); }
  var FEM = /^(Dessecação|Adubação|Outra)/;
  function ordTxt(op, n) { return n + (FEM.test(op) ? 'ª ' : 'º ') + op; }
  function unid(u) { return String(u || '').split('/')[0]; }
  function liquido(u) { return /^(L|mL)\//.test(String(u || '')); }
  function volTotal(v, u) { return fmt(v, v < 10 ? 1 : 0) + ' ' + unid(u); }
  function doseTxt(d) { return fmt(d, d < 1 ? 2 : (d % 1 ? 1 : 0)); }
  function tanques(ha, hat, calda) {
    var n = Math.floor(ha / hat + 1e-9), resto = Math.round((ha - n * hat) * 10) / 10;
    var t = n + (n === 1 ? ' tanque cheio' : ' tanques cheios');
    if (resto > 0.05) t += ' + 1 com ' + fmt(resto) + ' ha (' + fmt(resto * calda, 0) + ' L de calda)';
    return t;
  }
  function espDe(c, esp) { return esp || (c === 'soja' ? 50 : c === 'milho' ? 70 : 0); }
  function daeDe(emerg) { if (!emerg) return null; var n = difDias(hoje(), emerg); return n >= 0 ? n : null; }


  /* ---------------- dados em memória + servidor ---------------- */
  var ST = { mod: { plantio: false, recomendacoes: false }, plantio: [], recs: [], produtos: [], fila: [], ult: {} };
  var CAD = { fazendas: [], safras: [], responsaveis: [] };
  function gravar() { /* no painel tudo vive no servidor */ }

  var enviando = false;
  async function descarregar() {
    if (enviando) return; enviando = true;
    try {
      while (ST.fila.length) {
        var it = ST.fila.shift();
        try { await api(it.rota, it.corpo); }
        catch (e) { toast('Não salvou na nuvem: ' + e.message); }
      }
    } finally { enviando = false; }
  }
  function enfileirar(rota, corpo) { ST.fila.push({ rota: rota, corpo: corpo }); return descarregar(); }

  async function atualizarModulos() {
    try { var m = await api('/api/modulos'); ST.mod = { plantio: !!m.plantio, recomendacoes: !!m.recomendacoes }; } catch (e) { /* mantém */ }
    var a = document.getElementById('abaPlantio'), b = document.getElementById('abaRecs');
    if (a) a.style.display = ST.mod.plantio ? '' : 'none';
    if (b) b.style.display = ST.mod.recomendacoes ? '' : 'none';
    var c = document.getElementById('abaCusto'); if (c) c.style.display = (ST.mod.plantio || ST.mod.recomendacoes) ? '' : 'none';
    var ab = document.getElementById('abaAcessos'); if (ab) ab.style.display = (ST.mod.plantio || ST.mod.recomendacoes) ? '' : 'none';
  }

  async function baixar() {
    await descarregar();
    if (ST.fila.length) return false;
    try {
      var tudo = await Promise.all([
        api('/api/cadastro'),
        ST.mod.plantio ? api('/api/agro/plantio') : null,
        ST.mod.recomendacoes ? api('/api/agro/recs') : null,
        ST.mod.recomendacoes ? api('/api/agro/produtos') : null
      ]);
      var c = tudo[0] || {};
      CAD = { fazendas: (c.fazendas || []).map(function (f) {
        if (typeof f.talhoes === 'string' && f.talhoes) { try { f.talhoes = JSON.parse(f.talhoes); } catch (e) { f.talhoes = null; } }
        return f; }), safras: c.safras || [], safra_atual: c.safra_atual || '', responsaveis: c.responsaveis || [], produtores: c.produtores || [] };
      if (tudo[1]) ST.plantio = tudo[1].plantio || [];
      if (tudo[2]) ST.recs = tudo[2].recs || [];
      if (tudo[3]) ST.produtos = tudo[3].produtos || [];
      return true;
    } catch (e) { toast('Não consegui atualizar: ' + e.message); return false; }
  }

  /* ---------------- cadastro (fazendas, safras) ---------------- */
  function cad() { return CAD; }
  function fazendas() { return (cad().fazendas || []).filter(function (f) { return f.talhoes && f.talhoes.features && f.talhoes.features.length; }); }
  function fazDe(id) { return (cad().fazendas || []).filter(function (f) { return f.id === id; })[0]; }
  function safras() { return (cad().safras || []).map(function (s) { return s.nome; }); }
  function talhoesDe(f) {
    if (!f || !f.talhoes || !f.talhoes.features) return [];
    return f.talhoes.features.map(function (ft) { var p = ft.properties || {}; return { nome: String(p.nome || ''), ha: Number(p.area_ha) || 0, f: ft }; }).filter(function (t) { return t.nome; });
  }
  // área usada de um talhão: o talhão inteiro ou, se a recomendação pegar só uma parte, os ha informados
  function haUsada(total, p) { p = Number(p); return p > 0 && p < total ? p : total; }
  function haDe(f, nomes, parte) { var h = 0; talhoesDe(f).forEach(function (t) { if (nomes.indexOf(t.nome) >= 0) h += haUsada(t.ha, parte && parte[t.nome]); }); return Math.round(h * 10) / 10; }
  function produtorDe(f) { return f ? (f.produtor_id || '') : ''; }
  function nomeProd(id) { var p = (cad().produtores || []).filter(function (x) { return x.id === id; })[0]; return p ? p.nome : ''; }
  function fazDoProd(prod) { return fazendas().filter(function (f) { return !prod || produtorDe(f) === prod; }); }
  function opcoesProd(sel) {
    var ids = {}; fazendas().forEach(function (f) { ids[produtorDe(f)] = 1; });
    var l = (cad().produtores || []).filter(function (p) { return ids[p.id]; });
    return '<option value="">Todos os produtores</option>' + l.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.nome) + '</option>'; }).join('');
  }
  function opcoesFaz(sel, prod) {
    return fazDoProd(prod).map(function (f) {
      var np = !prod ? nomeProd(produtorDe(f)) : '';
      return '<option value="' + esc(f.id) + '"' + (f.id === sel ? ' selected' : '') + '>' + esc(f.nome) + (np ? ' · ' + esc(np) : '') + '</option>';
    }).join('');
  }
  function campoProd(S) { return '<div class="campo"><label>Produtor</label><select data-c="prod">' + opcoesProd(S.prod) + '</select></div>'; }
  function trocaProd(S, v) {
    S.prod = v; var l = fazDoProd(v);
    if (!l.some(function (f) { return f.id === S.faz; })) S.faz = l.length ? l[0].id : '';
    ST.ult.prod = v; ST.ult.faz = S.faz; gravar();
  }
  function opcoesSafra(sel) {
    var l = safras(); if (sel && l.indexOf(sel) < 0) l.unshift(sel);
    if (!l.length) return '<option value="">— sem safra —</option>';
    return l.map(function (s) { return '<option value="' + esc(s) + '"' + (s === sel ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
  }
  function fazPadrao() {
    var l = fazendas(); if (!l.length) return '';
    return l.some(function (f) { return f.id === ST.ult.faz; }) ? ST.ult.faz : l[0].id;
  }
  // a última escolhida; senão a safra em andamento
  function safraPadrao() {
    var l = safras(), atual = cad().safra_atual;
    return ST.ult.safra && l.indexOf(ST.ult.safra) >= 0 ? ST.ult.safra : (atual && l.indexOf(atual) >= 0 ? atual : (l[0] || ''));
  }

  /* ---------------- telas (dentro das abas do painel) ---------------- */
  function pintar(el, titulo, sub, acoes, corpo) {
    var topo = (el === tP && !P.ed) || (el === tR && (R.view === 'lista' || R.view === 'cal'));
    var y = window.pageYOffset;
    el.innerHTML = '<div class="ag-hd">' + (topo ? '' : '<button class="ag-volta" data-a="voltar">←</button>') + '<div class="info"><h1>' + esc(titulo) + '</h1><p>' + esc(sub || '') +
      '</p></div>' + (acoes ? '<div class="acoes">' + acoes + '</div>' : '') + '</div><div class="conteudo">' + corpo + '</div>';
    window.scrollTo(0, y);
  }
  function topoRolagem() { window.scrollTo(0, 0); }

  /* =================== PLANTIO =================== */
  var tP = null, P = { faz: '', safra: '', ed: null, nome: '', outros: [], sel: [] };

  function linhaPlantio(fid, safra, nome) {
    return ST.plantio.filter(function (r) { return r.fazenda_id === fid && (r.safra || '') === (safra || '') && r.talhao === nome; })[0] || null;
  }
  function semTxt(r) { return r.sem_ha ? fmt(r.sem_m, 1) + ' sem/m · ' + fmt(r.sem_ha, 0) + ' sem/ha' : ''; }
  // DAE: cada talhão tem a sua data = emergência dele + DAE. Sem emergência informada, usa o plantio + 5 dias.
  // Calculado na hora a partir do plantio (se a emergência mudar, a data acompanha).
  var EMERG_APOS_PLANTIO = 5;
  function baseDae(fid, safra, t) {
    var p = linhaPlantio(fid, safra, t); if (!p) return '';
    return p.data_emerg || (p.data_plantio ? addDias(p.data_plantio, EMERG_APOS_PLANTIO) : '');
  }
  function datasTal(r) {
    var d = dd(r), n = Number(d.dae) || 0, out = {};
    talDe(r).forEach(function (t) {
      var b = n > 0 ? baseDae(r.fazenda_id, r.safra, t) : '';
      out[t] = b ? addDias(b, n) : ((d.datas && d.datas[t]) || r.data_prevista || '');
    });
    return out;
  }
  function faixaDatas(r, so) {
    var m = datasTal(r), v = (so || talDe(r)).map(function (t) { return m[t]; }).filter(Boolean).sort();
    if (!v.length) return curta(r.data_prevista);
    return v[0] === v[v.length - 1] ? curta(v[0]) : curta(v[0]) + ' a ' + curta(v[v.length - 1]);
  }
  // área de plantio da fazenda nesta safra: todos os talhões menos os marcados como pastagem/pousio,
  // que ficam fora da conta (aparecem à parte)
  var SEM_PLANTIO = { pastagem: 1, pousio: 1 };
  // plantio lançado por dia pela fazenda (r.lanc): soma os hectares; sem lançamentos, data de plantio = talhão todo
  function lancDe(r) { var l = r && r.lanc; if (typeof l === 'string') { try { l = JSON.parse(l || '[]'); } catch (e) { l = []; } } return Array.isArray(l) ? l.filter(function (x) { return x && x.d && Number(x.ha) > 0; }) : []; }
  function haPlantadaDe(r, area) {
    var l = lancDe(r); if (!l.length) return r && r.data_plantio ? area : 0;
    return Math.min(area || Infinity, l.reduce(function (s, x) { return s + Number(x.ha); }, 0));
  }
  function resumoArea(fid, safra, tl) {
    var area = 0, nArea = 0, fora = 0, nomesFora = [], plantado = 0;
    tl.forEach(function (t) {
      var r = linhaPlantio(fid, safra, t.nome);
      if (r && SEM_PLANTIO[r.cultura]) { fora += t.ha; nomesFora.push(t.nome); return; }
      area += t.ha; nArea++;
      if (r && r.cultura) plantado += haPlantadaDe(r, t.ha);
    });
    return '<div class="ag-resumo-ha"><b>Área de plantio: ' + fmt(area) + ' ha</b> · ' + nArea + (nArea === 1 ? ' talhão' : ' talhões') +
      (plantado ? '<br>Plantado: ' + fmt(plantado) + ' ha (' + fmt(area ? plantado / area * 100 : 0) + '%)' : '') +
      (fora ? '<br><span style="color:#6B7B72;font-size:13px">Fora da conta (pastagem/pousio): ' + fmt(fora) + ' ha · ' + esc(nomesFora.join(', ')) + '</span>' : '') + '</div>';
  }

  function mapaPlantio(f, tl) {
    var feitos = tl.filter(function (t) { var r = linhaPlantio(P.faz, P.safra, t.nome); return r && (r.cultura || r.variedade || r.data_plantio); }).map(function (t) { return t.nome; });
    P.sel = P.sel.filter(function (n) { return tl.some(function (t) { return t.nome === n; }); });
    return '<div class="ag-dica">👆 Toque nos talhões do mapa para marcar onde lançar o plantio (pode marcar vários). Mais claro = já informado. Para os talhões pequenos, amplie com + / − ou com dois dedos.</div><div class="ag-mapa">' + mapaSVG(f, P.sel, 'ptog', feitos) + '</div>' +
      '<div class="ag-chips"><button class="ag-chip" data-a="ptodos">Todos</button><button class="ag-chip" data-a="plimpar">Limpar</button></div>' +
      (P.sel.length ? '<button class="btn" data-a="plancar">🌱 Lançar plantio em ' + P.sel.length + ' talhão(ões) · ' + fmt(haDe(f, P.sel)) + ' ha</button>' : '') +
      '<div class="ag-dica">Ou toque num talhão da lista abaixo para lançar só nele.</div>';
  }

  function pintarPlantio() {
    if (P.ed) return pintarEditorPlantio();
    var f = fazDe(P.faz), tl = talhoesDe(f), feitos = 0;
    var cards = tl.map(function (t) {
      var r = linhaPlantio(P.faz, P.safra, t.nome); if (r && (r.cultura || r.variedade || r.data_plantio)) feitos++;
      var d = r ? daeDe(r.data_emerg) : null;
      var l2 = r ? [r.variedade, r.data_plantio ? 'plantio ' + curta(r.data_plantio) : '', d !== null ? 'DAE ' + d : (r.data_emerg ? 'ainda não emergiu' : ''), semTxt(r)].filter(Boolean).join(' · ') : '';
      return '<div class="lista-item ag-tal" data-a="edtal" data-v="' + esc(t.nome) + '"><div class="ic">' + (r && r.cultura ? '🌱' : '＋') + '</div><div class="txt"><b>' + esc(t.nome) + '</b><span>' +
        (t.ha ? fmt(t.ha) + ' ha' : '') + (r && r.cultura ? ' · ' + esc(NOME_CULT[r.cultura] || r.cultura) : '') + '</span>' +
        '<span>' + esc(l2 || 'toque para informar o plantio') + '</span></div></div>';
    }).join('');
    pintar(tP, 'Plantio dos talhões', tl.length ? feitos + ' de ' + tl.length + ' talhões informados' : 'sem talhões',
      '', campoProd(P) + '<div class="linha2"><div class="campo"><label>Fazenda</label><select data-c="faz">' + opcoesFaz(P.faz, P.prod) + '</select></div>' +
      '<div class="campo"><label>Safra</label><select data-c="safra">' + opcoesSafra(P.safra) + '</select></div></div>' +
      (tl.length ? resumoArea(P.faz, P.safra, tl) + mapaPlantio(f, tl) + cards : '<div class="aviso">Esta fazenda ainda não tem talhões. Importe o KML em Produtores e fazendas.</div>') +
      '<div class="ag-nota">Cultura, variedade, datas e sementes alimentam o mapa por variedade e a evolução do plantio no relatório do cliente.</div>');
    if (!fazendas().length) $('.conteudo', tP).innerHTML = '<div class="aviso">Nenhuma fazenda com talhões. Importe o KML em Produtores e fazendas.</div>';
  }

  function pintarEditorPlantio() {
    var e = P.ed, t = talhoesDe(fazDe(P.faz)).filter(function (x) { return x.nome === P.nome; })[0] || { ha: 0 };
    var esp = espDe(e.cultura, e.espac_cm), d = daeDe(e.data_emerg);
    var vars = {}; ST.plantio.forEach(function (r) { if (r.variedade && (!e.cultura || r.cultura === e.cultura)) vars[r.variedade] = 1; });
    var outros = talhoesDe(fazDe(P.faz)).filter(function (x) { return x.nome !== P.nome; }).map(function (x) {
      return '<button class="ag-chip' + (P.outros.indexOf(x.nome) >= 0 ? ' on' : '') + '" data-a="outro" data-v="' + esc(x.nome) + '">' + esc(x.nome) + '</button>';
    }).join('');
    pintar(tP, P.nome, (t.ha ? fmt(t.ha) + ' ha · ' : '') + P.safra, '',
      '<div class="campo"><label>Cultura</label><select data-k="cultura"><option value="">— escolher —</option>' + CULTURAS.map(function (c) {
        return '<option value="' + c[0] + '"' + (c[0] === e.cultura ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Variedade / híbrido</label><input data-k="variedade" list="agVars" value="' + esc(e.variedade) + '" placeholder="Ex.: Cultivar A-7210" autocomplete="off">' +
      '<datalist id="agVars">' + Object.keys(vars).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist></div>' +
      '<div class="linha2"><div class="campo"><label>Data de plantio</label><input type="date" data-k="data_plantio" value="' + esc(e.data_plantio) + '"></div>' +
      '<div class="campo"><label>Data de emergência</label><input type="date" data-k="data_emerg" value="' + esc(e.data_emerg) + '"></div></div>' +
      '<div class="ag-chips"><span>Emergência:</span><button class="ag-chip" data-a="emerg" data-v="4">plantio + 4 dias</button><button class="ag-chip" data-a="emerg" data-v="5">plantio + 5 dias</button></div>' +
      '<div class="ag-dica" id="agDae">' + daeTxt(e) + '</div>' +
      '<div class="linha2"><div class="campo"><label>Espaçamento (cm)</label><input inputmode="decimal" data-k="espac_cm" value="' + (e.espac_cm ? String(e.espac_cm).replace('.', ',') : '') + '" placeholder="' + (esp || 'ex.: 50') + '"></div><div></div></div>' +
      '<div class="linha2"><div class="campo"><label>Sementes por metro</label><input inputmode="decimal" data-k="sem_m" value="' + (e.sem_m ? String(e.sem_m).replace('.', ',') : '') + '"></div>' +
      '<div class="campo"><label>Sementes por hectare</label><input inputmode="numeric" data-k="sem_ha" value="' + (e.sem_ha ? fmt(e.sem_ha, 0) : '') + '"></div></div>' +
      '<div class="ag-dica" id="agSem">' + semDica(e) + '</div>' +
      (outros ? '<h2>Aplicar também aos talhões</h2><div class="ag-chips">' + outros + '</div>' : '') +
      '<button class="btn" data-a="salvarplantio">Salvar</button><button class="btn perigo" data-a="limparplantio">Limpar plantio deste talhão</button>');
  }
  function daeTxt(e) { var d = daeDe(e.data_emerg); return d === null ? (e.data_emerg ? 'ainda não emergiu' : 'Informe a data de emergência para contar os dias (DAE).') : 'DAE ' + d + ' · emergiu em ' + curta(e.data_emerg); }
  function semDica(e) { var esp = espDe(e.cultura, e.espac_cm); return e.sem_ha ? '= ' + fmt(e.sem_m, 1) + ' sementes/m a ' + esp + ' cm = ' + fmt(e.sem_ha, 0) + ' sementes/ha' : 'Informe sementes/m ou sementes/ha: a outra é calculada pelo espaçamento (' + (esp ? esp + ' cm' : 'informe o espaçamento') + ').'; }

  function entradaPlantio(inp) {
    var e = P.ed, k = inp.dataset.k; if (!e) return;
    if (k === 'cultura' || k === 'variedade') { e[k] = inp.value; if (k === 'cultura') pintarPlantio(); return; }
    if (k === 'data_plantio' || k === 'data_emerg') { e[k] = inp.value; var d = $('#agDae', tP); if (d) d.textContent = daeTxt(e); return; }
    var esp = espDe(e.cultura, e.espac_cm);
    if (k === 'espac_cm') { e.espac_cm = numBR(inp.value); esp = espDe(e.cultura, e.espac_cm); if (e.sem_m && esp) e.sem_ha = Math.round(e.sem_m * 10000 / (esp / 100)); }
    if (k === 'sem_m') { e.sem_m = numBR(inp.value); e.sem_ha = (e.sem_m && esp) ? Math.round(e.sem_m * 10000 / (esp / 100)) : 0; }
    if (k === 'sem_ha') { e.sem_ha = Math.round(numBR(inp.value)); e.sem_m = (e.sem_ha && esp) ? Math.round(e.sem_ha * (esp / 100) / 10000 * 10) / 10 : 0; }
    var a = $('[data-k="sem_m"]', tP), b = $('[data-k="sem_ha"]', tP);
    if (k !== 'sem_m' && a) a.value = e.sem_m ? String(e.sem_m).replace('.', ',') : '';
    if (k !== 'sem_ha' && b) b.value = e.sem_ha ? fmt(e.sem_ha, 0) : '';
    var dc = $('#agSem', tP); if (dc) dc.textContent = semDica(e);
  }

  function vazioPlantio(e) { return !e.cultura && !e.variedade && !e.data_plantio && !e.data_emerg && !e.sem_m && !e.sem_ha; }
  function gravarPlantio(limpar) {
    var e = P.ed, alvo = [P.nome].concat(P.outros), enviar = [];
    alvo.forEach(function (nome) {
      var row = { fazenda_id: P.faz, safra: P.safra, talhao: nome, cultura: limpar ? '' : e.cultura, variedade: limpar ? '' : e.variedade,
        data_plantio: limpar ? '' : e.data_plantio, data_emerg: limpar ? '' : e.data_emerg,
        espac_cm: limpar ? 0 : (e.sem_m ? espDe(e.cultura, e.espac_cm) : (e.espac_cm || 0)), sem_m: limpar ? 0 : e.sem_m, sem_ha: limpar ? 0 : e.sem_ha };
      ST.plantio = ST.plantio.filter(function (r) { return !(r.fazenda_id === P.faz && (r.safra || '') === (P.safra || '') && r.talhao === nome); });
      if (!vazioPlantio(row)) ST.plantio.push(row);
      enviar.push(row);
    });
    gravar();
    enfileirar('/api/agro/plantio', { fazenda_id: P.faz, safra: P.safra, talhoes: enviar });
    P.sel = []; toast(limpar ? 'Plantio limpo' : 'Plantio salvo' + (alvo.length > 1 ? ' em ' + alvo.length + ' talhões' : ''));
    P.ed = null; P.outros = []; pintarPlantio();
  }

  function abrirPlantio() {
    if (!ST.mod.plantio) return;
    P.faz = fazPadrao(); P.prod = produtorDe(fazDe(P.faz)); P.safra = safraPadrao(); P.ed = null; P.outros = []; P.sel = [];
    pintarPlantio();
    baixar().then(function (ok) { if (ok && !P.ed) pintarPlantio(); });
  }

  function cliquePlantio(a, v, alvo) {
    if (a === 'voltar') { if (P.ed) { P.ed = null; P.outros = []; pintarPlantio(); } return; }
    if (a === 'ptog') { var kp = P.sel.indexOf(v); if (kp >= 0) P.sel.splice(kp, 1); else P.sel.push(v); pintarPlantio(); return; }
    if (a === 'ptodos') { P.sel = talhoesDe(fazDe(P.faz)).map(function (t) { return t.nome; }); pintarPlantio(); return; }
    if (a === 'plimpar') { P.sel = []; pintarPlantio(); return; }
    if (a === 'plancar') { if (!P.sel.length) return; var p0 = P.sel[0], resto = P.sel.slice(1); cliquePlantio('edtal', p0); P.outros = resto; pintarPlantio(); topoRolagem(tP); return; }
    if (a === 'edtal') {
      var r = linhaPlantio(P.faz, P.safra, v);
      P.nome = v; P.outros = [];
      P.ed = r ? { cultura: r.cultura || '', variedade: r.variedade || '', data_plantio: r.data_plantio || '', data_emerg: r.data_emerg || '', espac_cm: r.espac_cm || 0, sem_m: r.sem_m || 0, sem_ha: r.sem_ha || 0 }
        : { cultura: '', variedade: '', data_plantio: '', data_emerg: '', espac_cm: 0, sem_m: 0, sem_ha: 0 };
      pintarPlantio(); topoRolagem(); return;
    }
    if (a === 'emerg') {
      if (!P.ed.data_plantio) { toast('Informe primeiro a data de plantio'); return; }
      P.ed.data_emerg = addDias(P.ed.data_plantio, Number(v)); pintarPlantio(); return;
    }
    if (a === 'outro') { var i = P.outros.indexOf(v); if (i >= 0) P.outros.splice(i, 1); else P.outros.push(v); pintarPlantio(); return; }
    if (a === 'salvarplantio') { gravarPlantio(false); return; }
    if (a === 'limparplantio') { if (confirm('Limpar o plantio de ' + P.nome + '?')) gravarPlantio(true); }
  }
  function mudancaPlantio(sel) {
    if (sel.dataset.c === 'prod') { trocaProd(P, sel.value); pintarPlantio(); }
    else if (sel.dataset.c === 'faz') { P.sel = []; P.faz = sel.value; ST.ult.faz = P.faz; gravar(); pintarPlantio(); }
    else if (sel.dataset.c === 'safra') { P.safra = sel.value; ST.ult.safra = P.safra; gravar(); pintarPlantio(); }
    else if (sel.dataset.k) entradaPlantio(sel);
  }

  /* =================== RECOMENDAÇÕES =================== */
  var tR = null, R = { view: 'lista', faz: '', filtro: 'todas', id: null, W: null, cy: 0, cm: 0, sel: '' };
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function recDe(id) { return ST.recs.filter(function (r) { return r.id === id; })[0]; }
  function dd(r) { r.dados = r.dados || {}; return r.dados; }
  function talDe(r) { return dd(r).tal || []; }
  function feitoDe(r) { return dd(r).feito || {}; }
  function proxDe(r) { return dd(r).prox || {}; }
  function prodsDe(r) { return dd(r).prods || []; }
  function venc(r, t) { var f = feitoDe(r)[t]; return f && Number(dd(r).rep) > 0 ? addDias(f, Number(dd(r).rep)) : null; }
  function stRec(r) {
    var n = talDe(r).filter(function (t) { return feitoDe(r)[t]; }).length;
    return n === 0 ? 'Pendente' : n >= talDe(r).length ? 'Aplicada' : 'Em andamento';
  }
  function selo(s) { return '<span class="badge ' + (s === 'Aplicada' ? 'pub' : s === 'Pendente' ? '' : 'fila') + '">' + s + '</span>'; }
  function situ(data, aviso) {
    var n = difDias(data, hoje());
    if (n < 0) return { k: 'venc', t: 'Vencida há ' + (-n) + ' dia' + (n < -1 ? 's' : '') };
    if (n === 0) return { k: 'hoje', t: 'Vence hoje' };
    if (n <= aviso) return { k: 'perto', t: 'Vence em ' + n + ' dia' + (n > 1 ? 's' : '') };
    return { k: 'ok', t: 'Em ' + n + ' dias' };
  }
  function alertasDe(fid) {
    var out = [];
    ST.recs.forEach(function (r) {
      if (r.fazenda_id !== fid) return;
      var d = dd(r); if (!(Number(d.rep) > 0) || !((Number(d.num) || 1) < (Number(d.total) || 1))) return;
      var g = {};
      talDe(r).forEach(function (t) { if (feitoDe(r)[t] && !proxDe(r)[t]) { var v = venc(r, t); (g[v] = g[v] || []).push(t); } });
      Object.keys(g).forEach(function (v) { out.push({ d: v, r: r, tal: g[v], sit: situ(v, Number(d.aviso) || 0) }); });
    });
    return out.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
  }

  /* ----- lista ----- */
  function pintarRecs() {
    var v = R.view;
    if (v === 'det') return pintarOrdem();
    if (v === 'wiz') return pintarWiz();
    if (v === 'prods') return pintarCatalogo();
    if (v === 'cal') return pintarCalendario();
    var f = fazDe(R.faz);
    var lista = ST.recs.filter(function (r) { return r.fazenda_id === R.faz; }).filter(function (r) {
      var s = stRec(r);
      return R.filtro === 'todas' || (R.filtro === 'pend' && s === 'Pendente') || (R.filtro === 'and' && s === 'Em andamento') || (R.filtro === 'apl' && s === 'Aplicada');
    }).sort(function (a, b) { return (b.data_prevista || '') < (a.data_prevista || '') ? -1 : 1; });
    var al = alertasDe(R.faz).map(function (e) {
      var d = dd(e.r), ic = e.sit.k === 'ok' ? '🟢' : e.sit.k === 'perto' ? '🟡' : '🔴';
      return '<div class="ag-alerta ' + e.sit.k + '"><div class="ag-ai">' + ic + '</div><div class="ag-ac"><b>' + esc(ordTxt(e.r.operacao, (Number(d.num) || 1) + 1)) + '</b> <span class="badge">' + esc(e.sit.t) + '</span>' +
        '<span>' + curta(e.d) + ' · ' + esc(e.tal.join(', ')) + ' · ' + fmt(haDe(f, e.tal, dd(e.r).parte)) + ' ha</span></div>' +
        '<button class="ag-peq" data-a="prog" data-v="' + esc(e.r.id) + '|' + e.d + '">Programar</button></div>';
    }).join('');
    var cards = lista.map(function (r) {
      var d = dd(r), ha = haDe(f, talDe(r), d.parte), pf = haDe(f, talDe(r).filter(function (t) { return feitoDe(r)[t]; }), d.parte), pc = ha ? Math.round(pf / ha * 100) : 0;
      return '<div class="lista-item ag-rec" data-a="abrirrec" data-v="' + esc(r.id) + '"><div class="ic">📋</div><div class="txt"><b>' + esc(Number(d.rep) > 0 ? ordTxt(r.operacao, Number(d.num) || 1) : r.operacao) + '</b>' +
        '<span>' + faixaDatas(r) + ' · ' + talDe(r).length + ' talhão(ões) · ' + fmt(ha) + ' ha</span>' +
        '<span>' + esc(prodsDe(r).map(function (p) { return p[0]; }).join(' + ') || 'sem produtos') + '</span>' +
        '<div class="ag-barra"><i style="width:' + pc + '%"></i></div></div>' + selo(stRec(r)) + '</div>';
    }).join('');
    var filtros = [['todas', 'Todas'], ['pend', 'Pendentes'], ['and', 'Em andamento'], ['apl', 'Aplicadas']].map(function (x) {
      return '<button class="ag-chip' + (R.filtro === x[0] ? ' on' : '') + '" data-a="filtro" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    pintar(tR, 'Recomendações', f ? f.nome : '—', '<button class="btn-mini" data-a="catalogo">🧪 Produtos</button>',
      abasRec('lista') + campoProd(R) + '<div class="campo"><label>Fazenda</label><select data-c="faz">' + opcoesFaz(R.faz, R.prod) + '</select></div>' +
      '<button class="btn" data-a="nova">+ Nova recomendação</button>' +
      (al ? '<h2>Próximas aplicações</h2>' + al : '') +
      '<div class="ag-chips" style="margin-top:14px">' + filtros + '</div>' +
      (cards || '<div class="aviso" style="margin-top:10px">Nenhuma recomendação aqui ainda.</div>'));
    if (!fazendas().length) $('.conteudo', tR).innerHTML = '<div class="aviso">Nenhuma fazenda com talhões. Importe o KML em Produtores e fazendas.</div>';
  }

  function abrirRecs() {
    if (!ST.mod.recomendacoes) return;
    R.faz = fazPadrao(); R.prod = produtorDe(fazDe(R.faz)); R.view = 'lista'; R.filtro = 'todas'; R.W = null;
    pintarRecs();
    baixar().then(function (ok) { if (ok && R.view === 'lista') pintarRecs(); });
  }


  /* ----- calendário ----- */
  function abasRec(at) {
    return '<div class="ag-abas"><button class="' + (at === 'lista' ? 'on' : '') + '" data-a="aba" data-v="lista">📋 Lista</button><button class="' + (at === 'cal' ? 'on' : '') + '" data-a="aba" data-v="cal">📅 Calendário</button></div>';
  }
  function eventosDe(fid) {
    var ev = [];
    ST.recs.forEach(function (r) {
      if (r.fazenda_id !== fid) return;
      var d = dd(r), pend = talDe(r).filter(function (t) { return !feitoDe(r)[t]; });
      var dt = datasTal(r), gp = {};
      pend.forEach(function (t) { if (dt[t]) (gp[dt[t]] = gp[dt[t]] || []).push(t); });
      Object.keys(gp).forEach(function (dia) { ev.push({ d: dia, k: 'prev', r: r, tal: gp[dia], txt: r.operacao + ' prevista' }); });
      var g = {}; talDe(r).forEach(function (t) { if (feitoDe(r)[t]) (g[feitoDe(r)[t]] = g[feitoDe(r)[t]] || []).push(t); });
      Object.keys(g).forEach(function (dia) { ev.push({ d: dia, k: 'apl', r: r, tal: g[dia], txt: r.operacao + ' aplicada' }); });
      if (Number(d.rep) > 0 && (Number(d.num) || 1) < (Number(d.total) || 1)) {
        var gg = {}; talDe(r).forEach(function (t) { if (feitoDe(r)[t] && !proxDe(r)[t]) { var v = venc(r, t); (gg[v] = gg[v] || []).push(t); } });
        Object.keys(gg).forEach(function (dia) { var st = situ(dia, Number(d.aviso) || 0); ev.push({ d: dia, k: 'prox-' + st.k, r: r, tal: gg[dia], sit: st, txt: ordTxt(r.operacao, (Number(d.num) || 1) + 1) }); });
      }
    });
    return ev;
  }
  function corEv(e) { return e.k === 'prev' ? 'prev' : e.k === 'apl' ? 'apl' : (e.sit.k === 'venc' || e.sit.k === 'hoje') ? 'venc' : e.sit.k === 'perto' ? 'perto' : 'ok'; }
  function pintarCalendario() {
    var f = fazDe(R.faz), ev = eventosDe(R.faz), h = abasRec('cal');
    if (!R.cy) { var t0 = new Date(); R.cy = t0.getFullYear(); R.cm = t0.getMonth(); R.sel = hoje(); }
    var ini = new Date(Date.UTC(R.cy, R.cm, 1)).getUTCDay(), nd = new Date(Date.UTC(R.cy, R.cm + 1, 0)).getUTCDate(), g = '';
    ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].forEach(function (x) { g += '<div class="ag-dow">' + x + '</div>'; });
    for (var i = 0; i < ini; i++) g += '<div></div>';
    for (var d = 1; d <= nd; d++) {
      var iso = R.cy + '-' + p2(R.cm + 1) + '-' + p2(d), es = ev.filter(function (e) { return e.d === iso; });
      g += '<button class="ag-dia' + (iso === hoje() ? ' hoje' : '') + (iso === R.sel ? ' sel' : '') + '" data-a="calsel" data-v="' + iso + '"><span>' + d + '</span><i>' +
        es.slice(0, 4).map(function (e) { return '<u class="c-' + corEv(e) + '"></u>'; }).join('') + '</i></button>';
    }
    h += campoProd(R) + '<div class="campo"><label>Fazenda</label><select data-c="faz">' + opcoesFaz(R.faz, R.prod) + '</select></div>' +
      '<div class="ag-calhead"><button data-a="calmes" data-v="-1">‹</button><b>' + MESES[R.cm].charAt(0).toUpperCase() + MESES[R.cm].slice(1) + ' de ' + R.cy + '</b><button data-a="calmes" data-v="1">›</button></div>' +
      '<div class="ag-grade">' + g + '</div>' +
      '<div class="ag-leg"><span><u class="c-prev"></u>prevista</span><span><u class="c-apl"></u>aplicada</span><span><u class="c-perto"></u>próxima (perto)</span><span><u class="c-venc"></u>vencida</span><span><u class="c-ok"></u>próxima</span></div>';
    var ds = ev.filter(function (e) { return e.d === R.sel; });
    h += '<h2>' + dataBR(R.sel) + (R.sel === hoje() ? ' (hoje)' : '') + '</h2>' + (ds.length ? ds.map(function (e) {
      return '<div class="ag-alerta c-' + corEv(e) + '" data-a="abrirrec" data-v="' + esc(e.r.id) + '"><div class="ag-ac"><b>' + esc(e.txt) + '</b>' + (e.sit ? ' <span class="badge">' + esc(e.sit.t) + '</span>' : '') +
        '<span>' + esc(e.tal.join(', ')) + ' · ' + fmt(haDe(f, e.tal, dd(e.r).parte)) + ' ha</span></div>' +
        (e.k.indexOf('prox-') === 0 ? '<button class="ag-peq" data-a="prog" data-v="' + esc(e.r.id) + '|' + e.d + '">Programar</button>' : '') + '</div>';
    }).join('') : '<div class="ag-dica">Nada neste dia.</div>');
    pintar(tR, 'Calendário', f ? f.nome : '—', '', h);
  }

  /* ----- ordem de campo ----- */
  function pintarOrdem() {
    var r = recDe(R.id); if (!r) { R.view = 'lista'; return pintarRecs(); }
    var f = fazDe(r.fazenda_id), d = dd(r), ha = haDe(f, talDe(r), d.parte), pf = haDe(f, talDe(r).filter(function (t) { return feitoDe(r)[t]; }), d.parte), pc = ha ? Math.round(pf / ha * 100) : 0;
    var prods = prodsDe(r), liq = prods.some(function (p) { return liquido(p[2]); }), hat = d.calda ? d.tanque / d.calda : 0;
    var tl = talhoesDe(f), h = '<div class="ag-capa"><small>' + esc(f ? f.nome : '') + ' · prevista ' + faixaDatas(r) + '</small><h3>' +
      esc(Number(d.rep) > 0 ? ordTxt(r.operacao, Number(d.num) || 1) : r.operacao) + '</h3><div class="ag-barra b"><i style="width:' + pc + '%"></i></div><small>' + fmt(pf) + ' de ' + fmt(ha) + ' ha · ' + pc + '%</small></div>';
    if (d.obs) h += '<div class="ag-nota aviso-obs">⚠️ ' + esc(d.obs) + '</div>';
    if (d.resp) h += '<div class="ag-nota">Quem aplica: <b>' + esc(d.resp) + '</b></div>';
    h += '<div class="ag-sec"><b>Ordem de mistura</b>' + prods.map(function (p, i) {
      return '<div class="ag-mix"><b class="ag-ord">' + (i + 1) + '</b><span>' + esc(p[0]) + '</span><em>' + doseTxt(p[1]) + ' ' + esc(p[2]) + '</em></div>'; }).join('') + '</div>';
    if (liq && hat) h += '<div class="ag-sec azul"><b>💧 Por tanque de ' + fmt(d.tanque, 0) + ' L (' + fmt(hat, 0) + ' ha)</b><small>Calda ' + fmt(d.calda, 0) + ' L/ha · ' + tanques(ha, hat, d.calda) + '</small>' +
      prods.filter(function (p) { return p[0]; }).map(function (p) {
        return '<div class="ag-mix"><span>' + esc(p[0]) + '</span><em>' + fmt(p[1] * hat, p[1] * hat < 10 ? 2 : 1) + ' ' + esc(unid(p[2])) + '</em></div>'; }).join('') + '</div>';
    h += '<h2>Talhões</h2>';
    var pend = 0;
    talDe(r).forEach(function (nome) {
      var t = tl.filter(function (x) { return x.nome === nome; })[0] || { ha: 0 }, ok = feitoDe(r)[nome], hu = haUsada(t.ha, d.parte && d.parte[nome]); if (!ok) pend++;
      h += '<div class="ag-talc' + (ok ? ' ok' : '') + '"><div class="ag-tt"><b>' + esc(nome) + '</b><span>' + fmt(hu) + (hu < t.ha ? ' de ' + fmt(t.ha) : '') + ' ha' +
        (!ok && Number(d.dae) > 0 && datasTal(r)[nome] ? ' · 📅 ' + curta(datasTal(r)[nome]) : '') + '</span></div><div class="ag-tp">' +
        prods.map(function (p) { return '<div><span>' + esc(p[0]) + '</span><b>' + volTotal(p[1] * hu, p[2]) + '</b></div>'; }).join('') + '</div>' +
        (ok ? '<div class="ag-feito">✔ Aplicado em ' + curta(ok) + (d.feitoPor && d.feitoPor[nome] ? ' por ' + esc(d.feitoPor[nome]) : '') + regTalhao(d, nome) + (venc(r, nome) && (Number(d.num) || 1) < (Number(d.total) || 1) ? ' · 📅 próxima ' + curta(venc(r, nome)) : '') +
          ' <button class="ag-link" data-a="desfazer" data-v="' + esc(nome) + '">desfazer</button></div>'
          : parcTxt(d, nome, hu) + '<button class="btn" data-a="aplicar" data-v="' + esc(nome) + '">Marcar como aplicado</button>') + '</div>';
    });
    if (pend > 1) h += '<button class="btn secundario" data-a="aplicar" data-v="*">Marcar todos os pendentes como aplicados</button>';
    h += '<h2>Volume total</h2><div class="ag-sec"><small>' + fmt(ha) + ' ha · ' + talDe(r).length + ' talhão(ões)</small>' +
      prods.map(function (p) { return '<div class="ag-mix"><span>' + esc(p[0]) + '</span><em>' + volTotal(p[1] * ha, p[2]) + '</em></div>'; }).join('') +
      (liq && hat ? '<div class="ag-mix"><span>💧 Calda total (' + fmt(d.calda, 0) + ' L/ha)</span><em>' + fmt(ha * d.calda, 0) + ' L</em></div><small>' + tanques(ha, hat, d.calda) + '</small>' : '') + '</div>';
    var prox = alertasDe(r.fazenda_id).filter(function (e) { return e.r.id === r.id; });
    prox.forEach(function (e) {
      h += '<button class="btn secundario" data-a="prog" data-v="' + esc(r.id) + '|' + e.d + '">+ Programar ' + esc(ordTxt(r.operacao, (Number(d.num) || 1) + 1)) + ' (' + curta(e.d) + ' · ' + esc(e.tal.join(', ')) + ')</button>';
    });
    h += '<label class="ag-sw"><input type="checkbox" data-a="mostrar"' + (r.mostrar ? ' checked' : '') + '> Mostrar no relatório do cliente</label>' +
      '<button class="btn secundario" data-a="editarrec">Editar recomendação</button><button class="btn perigo" data-a="excluirrec">Excluir recomendação</button>';
    pintar(tR, 'Ordem de campo', f ? f.nome : '', '', h);
  }

  function salvarRecLocal(r) {
    var i = ST.recs.findIndex(function (x) { return x.id === r.id; });
    if (i >= 0) ST.recs[i] = r; else ST.recs.unshift(r);
    gravar();
    enfileirar('/api/agro/rec', { id: r.id, fazenda_id: r.fazenda_id, safra: r.safra, operacao: r.operacao, data_prevista: r.data_prevista, mostrar: r.mostrar, dados: r.dados });
  }

  // registro de campo do operador (portal) para um talhão: horário, clima, observação e fotos
  // aplicação parcial lançada pelo operador no portal (d.parcial[talhão] = [{d, ha, por}])
  function parcDe(d, nome) { var l = d.parcial && d.parcial[nome]; return Array.isArray(l) ? l.filter(function (x) { return x && Number(x.ha) > 0; }) : []; }
  function haFeitaDe(d, nome, hu) { return d.feito && d.feito[nome] ? hu : Math.min(hu, parcDe(d, nome).reduce(function (s, x) { return s + Number(x.ha); }, 0)); }
  function parcTxt(d, nome, hu) {
    var l = parcDe(d, nome); if (!l.length) return '';
    var f = haFeitaDe(d, nome, hu);
    return '<div class="ag-feito" style="color:#9A6400">◐ Parcial: ' + fmt(f) + ' de ' + fmt(hu) + ' ha · faltam ' + fmt(Math.max(0, hu - f)) + ' ha<br>' +
      l.map(function (x) { return curta(x.d) + ' · ' + fmt(x.ha) + ' ha' + (x.por ? ' por ' + esc(x.por) : ''); }).join('<br>') + '</div>';
  }
  function regTalhao(d, nome) {
    var g = (d.aplicReg || []).filter(function (x) { return (x.talhoes || []).indexOf(nome) >= 0; }).pop();
    if (!g) return '';
    var n1 = function (v) { return String(Math.round(Number(v) * 10) / 10).replace('.', ','); };
    var l = [g.inicio ? g.inicio + (g.fim ? '–' + g.fim : '') : '', g.vento != null ? 'vento ' + n1(g.vento) + ' km/h' : '', g.temp != null ? n1(g.temp) + ' °C' : '', g.umid != null ? n1(g.umid) + '% umid.' : ''].filter(Boolean);
    return '<div class="ag-reg">' + (l.length ? esc(l.join(' · ')) : '') + (g.obs ? '<br>“' + esc(g.obs) + '”' : '') +
      ((g.fotos || []).length ? '<div class="ag-regf">' + g.fotos.map(function (k) { var u = '/img/' + encodeURIComponent(k); return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" loading="lazy" alt=""></a>'; }).join('') + '</div>' : '') + '</div>';
  }
  function modalAplicar(alvo) {
    var r = recDe(R.id), ov = document.createElement('div'); ov.className = 'ag-ov';
    ov.innerHTML = '<div class="ag-mod"><h3>Marcar como aplicado</h3><p class="ag-dica">' + esc(r.operacao) + ' · ' + (alvo === '*' ? 'todos os talhões pendentes' : esc(alvo)) + '</p>' +
      '<div class="campo"><label>Data da aplicação</label><input type="date" id="agDataApl" value="' + hoje() + '"></div>' +
      '<button class="btn" data-m="ok">Confirmar</button><button class="btn secundario" data-m="no">Cancelar</button></div>';
    document.body.appendChild(ov);
    ov.onclick = function (ev) {
      var m = ev.target.dataset && ev.target.dataset.m;
      if (m === 'no' || ev.target === ov) { ov.remove(); return; }
      if (m !== 'ok') return;
      var data = $('#agDataApl', ov).value; if (!data) { toast('Informe a data'); return; }
      var d = dd(r); d.feito = d.feito || {};
      (alvo === '*' ? talDe(r).filter(function (t) { return !d.feito[t]; }) : [alvo]).forEach(function (t) {
        d.feito[t] = data;
        if (d.feitoPor) delete d.feitoPor[t];        // marcado pelo consultor
        if (d.feitoPorId) delete d.feitoPorId[t];
      });
      ov.remove(); salvarRecLocal(r); pintarOrdem();
      toast('✔ Aplicação registrada · ' + stRec(r));
    };
  }

  /* ----- assistente (Onde · O quê · Quando) ----- */
  function novoW(fid) {
    return { passo: 1, id: null, faz: fid, safra: safraPadrao(), tal: [], op: '', prods: [], calda: 100, tanque: 3000, data: hoje(), resp: '', obs: '', mostrar: true,
      rep: 0, total: 1, aviso: 3, repMan: false, num: 1, origem: null, feito: {}, prox: {}, modelo: '', parte: {} };
  }
  function wDeRec(r) {
    var d = dd(r);
    return { passo: 1, id: r.id, faz: r.fazenda_id, safra: r.safra || '', tal: talDe(r).slice(), op: r.operacao, prods: cp(prodsDe(r)), calda: d.calda || 100, tanque: d.tanque || 3000, dae: d.dae || 0,
      data: r.data_prevista || hoje(), resp: d.resp || '', obs: d.obs || '', mostrar: !!r.mostrar, rep: Number(d.rep) || 0, total: Number(d.total) || 1, aviso: d.aviso == null ? 3 : Number(d.aviso),
      repMan: true, num: Number(d.num) || 1, origem: null, feito: cp(feitoDe(r)), prox: cp(proxDe(r)), modelo: '', parte: cp(d.parte || {}) };
  }
  function prodCat(nome) { return ST.produtos.filter(function (p) { return p.nome === nome; })[0]; }

  /* ---------------- zoom nos mapas de seleção: botões + / −, pinça e arrastar ---------------- */
  var ZW = 1000, MZ = { k: 1, x: 0, y: 0, id: '' }, zFeito = false, zGest = null, zSupr = 0;
  function zoomDe(id) { if (MZ.id !== id) MZ = { k: 1, x: 0, y: 0, id: id }; return MZ; }
  function zAplica(svg) {
    var z = MZ, H = Number(svg.getAttribute('data-h')) || 600, vw = ZW / z.k, vh = H / z.k;
    z.x = Math.max(0, Math.min(ZW - vw, z.x)); z.y = Math.max(0, Math.min(H - vh, z.y));
    svg.setAttribute('viewBox', z.x.toFixed(1) + ' ' + z.y.toFixed(1) + ' ' + vw.toFixed(1) + ' ' + vh.toFixed(1));
    svg.style.setProperty('--zk', z.k.toFixed(2));
    svg.style.touchAction = z.k > 1 ? 'none' : 'pan-y';
  }
  // posição de um ponto da tela dentro da área visível do mapa (0 a 1) e escala em px por unidade
  function zPonto(svg, cx, cy) {
    var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, s = Math.min(r.width / vb.width, r.height / vb.height) || 1;
    var ox = (r.width - vb.width * s) / 2, oy = (r.height - vb.height * s) / 2;
    return { fx: Math.max(0, Math.min(1, ((cx - r.left - ox) / s) / vb.width)), fy: Math.max(0, Math.min(1, ((cy - r.top - oy) / s) / vb.height)), s: s };
  }
  function zZoom(svg, k2, fx, fy) {
    var z = MZ, H = Number(svg.getAttribute('data-h')) || 600, vw = ZW / z.k, vh = H / z.k;
    k2 = Math.max(1, Math.min(10, k2));
    var px = z.x + vw * fx, py = z.y + vh * fy;
    z.k = k2; z.x = px - (ZW / k2) * fx; z.y = py - (H / k2) * fy;
    zAplica(svg);
  }
  function zoomIniciar() {
    if (zFeito) return; zFeito = true;
    var st = document.createElement('style');
    st.textContent = '.ag-zw{position:relative}.ag-zb{position:absolute;right:6px;top:6px;display:flex;flex-direction:column;gap:6px}' +
      '.ag-zb button{width:40px;height:40px;border-radius:10px;border:1px solid #cfd8d2;background:rgba(255,255,255,.96);font-size:21px;font-weight:700;line-height:1;color:#146034;box-shadow:0 1px 4px rgba(0,0,0,.18);padding:0;cursor:pointer}' +
      '.ag-mapa svg{touch-action:pan-y;user-select:none;-webkit-user-select:none}.ag-mapa .ag-poly{stroke-width:calc(3px / var(--zk,1))}.ag-mapa .ag-poly.on{stroke-width:calc(4px / var(--zk,1))}' +
      '.ag-mapa text{font-size:calc(24px * (0.6 + 0.4 * var(--zk,1)) / var(--zk,1));stroke-width:calc(4px / var(--zk,1))}';
    document.head.appendChild(st);
    var svgDe = function (n) { return n && n.closest ? n.closest('.ag-zw') && n.closest('.ag-zw').querySelector('svg') : null; };
    document.addEventListener('click', function (ev) {
      if (Date.now() - zSupr < 450 && ev.target.closest && ev.target.closest('.ag-zw')) { ev.stopPropagation(); ev.preventDefault(); return; }
      var b = ev.target.closest ? ev.target.closest('[data-z]') : null; if (!b) return;
      var svg = svgDe(b); if (!svg) return; ev.stopPropagation(); ev.preventDefault();
      var a = b.getAttribute('data-z');
      if (a === 'reset') zZoom(svg, 1, 0.5, 0.5); else zZoom(svg, MZ.k * (a === 'in' ? 1.7 : 1 / 1.7), 0.5, 0.5);
    }, true);
    var dist = function (t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); };
    document.addEventListener('touchstart', function (ev) {
      var svg = ev.target.closest ? ev.target.closest('.ag-zw svg') : null; if (!svg) { zGest = null; return; }
      var t = ev.touches;
      if (t.length === 2) {
        var m = zPonto(svg, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2), H = Number(svg.getAttribute('data-h')) || 600;
        zGest = { svg: svg, tipo: 'pinca', d0: dist(t), k0: MZ.k, px: MZ.x + (ZW / MZ.k) * m.fx, py: MZ.y + (H / MZ.k) * m.fy, mov: true };
      } else if (t.length === 1) {
        zGest = { svg: svg, tipo: 'arrasta', sx: t[0].clientX, sy: t[0].clientY, x0: MZ.x, y0: MZ.y, mov: false };
      }
    }, { passive: true });
    document.addEventListener('touchmove', function (ev) {
      var g = zGest; if (!g) return; var t = ev.touches, H = Number(g.svg.getAttribute('data-h')) || 600;
      if (g.tipo === 'pinca' && t.length === 2) {
        ev.preventDefault();
        var m = zPonto(g.svg, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
        var k2 = Math.max(1, Math.min(10, g.k0 * dist(t) / (g.d0 || 1)));
        MZ.k = k2; MZ.x = g.px - (ZW / k2) * m.fx; MZ.y = g.py - (H / k2) * m.fy; zAplica(g.svg);
      } else if (g.tipo === 'arrasta' && t.length === 1) {
        var dx = t[0].clientX - g.sx, dy = t[0].clientY - g.sy;
        if (Math.abs(dx) + Math.abs(dy) > 8) g.mov = true;
        if (MZ.k > 1 && g.mov) {
          ev.preventDefault();
          var s = zPonto(g.svg, 0, 0).s;
          MZ.x = g.x0 - dx / s; MZ.y = g.y0 - dy / s; zAplica(g.svg);
        }
      }
    }, { passive: false });
    var fim = function (ev) { if (zGest && zGest.mov && MZ.k > 1) zSupr = Date.now(); if (!ev.touches || !ev.touches.length) zGest = null; };
    document.addEventListener('touchend', fim, { passive: true }); document.addEventListener('touchcancel', fim, { passive: true });
    // computador: roda do mouse amplia, arrastar move
    document.addEventListener('wheel', function (ev) {
      var svg = ev.target.closest ? ev.target.closest('.ag-zw svg') : null; if (!svg) return;
      ev.preventDefault(); var m = zPonto(svg, ev.clientX, ev.clientY); zZoom(svg, MZ.k * (ev.deltaY < 0 ? 1.25 : 0.8), m.fx, m.fy);
    }, { passive: false });
    var mouse = null;
    document.addEventListener('mousedown', function (ev) {
      var svg = ev.target.closest ? ev.target.closest('.ag-zw svg') : null; if (!svg || MZ.k <= 1) return;
      mouse = { svg: svg, sx: ev.clientX, sy: ev.clientY, x0: MZ.x, y0: MZ.y, mov: false };
    });
    document.addEventListener('mousemove', function (ev) {
      if (!mouse) return; var dx = ev.clientX - mouse.sx, dy = ev.clientY - mouse.sy;
      if (Math.abs(dx) + Math.abs(dy) > 5) mouse.mov = true;
      if (mouse.mov) { var s = zPonto(mouse.svg, 0, 0).s; MZ.x = mouse.x0 - dx / s; MZ.y = mouse.y0 - dy / s; zAplica(mouse.svg); }
    });
    document.addEventListener('mouseup', function () { if (mouse && mouse.mov) zSupr = Date.now(); mouse = null; });
  }

  function mapaSVG(f, sel, act, feitos) {
    var feats = (f && f.talhoes && f.talhoes.features) || [], minX = 180, minY = 90, maxX = -180, maxY = -90;
    var each = function (ft, cb) { var g = ft.geometry; if (!g) return; (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(cb); };
    feats.forEach(function (ft) { each(ft, function (rings) { rings.forEach(function (rg) { rg.forEach(function (p) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }); }); }); });
    if (maxX < minX) return '';
    var dx = (maxX - minX) || 0.001, dy = (maxY - minY) || 0.001; minX -= dx * 0.03; maxX += dx * 0.03; minY -= dy * 0.03; maxY += dy * 0.03;
    var Wd = 1000, H = Math.max(300, Math.round(Wd * ((maxY - minY) / (maxX - minX)) * Math.cos((minY + maxY) / 2 * Math.PI / 180)));
    var px = function (l) { return (l - minX) / (maxX - minX) * Wd; }, py = function (l) { return H - (l - minY) / (maxY - minY) * H; };
    var z = zoomDe((f && f.id) || ''), zvw = Wd / z.k, zvh = H / z.k;
    z.x = Math.max(0, Math.min(Wd - zvw, z.x)); z.y = Math.max(0, Math.min(H - zvh, z.y));
    var s = '<div class="ag-zw"><svg viewBox="' + z.x.toFixed(1) + ' ' + z.y.toFixed(1) + ' ' + zvw.toFixed(1) + ' ' + zvh.toFixed(1) + '" data-h="' + H + '" style="--zk:' + z.k.toFixed(2) + (z.k > 1 ? ';touch-action:none' : '') + '"><rect width="' + Wd + '" height="' + H + '" fill="#F1F4F2"/>', txt = '';
    feats.forEach(function (ft) {
      var nome = (ft.properties && ft.properties.nome) || '', on = sel.indexOf(nome) >= 0, d = '', cx = 0, cy = 0, n = 0;
      each(ft, function (rings) {
        d += rings.map(function (rg, ri) { if (ri === 0) rg.forEach(function (q) { cx += px(q[0]); cy += py(q[1]); n++; }); return 'M' + rg.map(function (q) { return px(q[0]).toFixed(1) + ',' + py(q[1]).toFixed(1); }).join('L') + 'Z'; }).join(' ');
      });
      s += '<path class="ag-poly' + (on ? ' on' : '') + (feitos && feitos.indexOf(nome) >= 0 ? ' feito' : '') + '" data-a="' + (act || 'wtog') + '" data-v="' + esc(nome) + '" d="' + d + '"/>';
      if (n) txt += '<text x="' + (cx / n).toFixed(0) + '" y="' + (cy / n).toFixed(0) + '" text-anchor="middle">' + (on ? '✔ ' : '') + esc(nome) + '</text>';
    });
    return s + txt + '</svg><div class="ag-zb"><button type="button" data-z="in" title="Ampliar">+</button><button type="button" data-z="out" title="Reduzir">−</button><button type="button" data-z="reset" title="Mapa inteiro">⤢</button></div></div>';
  }

  // outras recomendações (mesma fazenda e safra) que pegam só uma parte deste talhão
  function outrasParte(W, n) {
    return ST.recs.filter(function (r) { return r.id !== W.id && r.fazenda_id === W.faz && (r.safra || '') === (W.safra || '') && talDe(r).indexOf(n) >= 0 && dd(r).parte && dd(r).parte[n]; })
      .map(function (r) { return { op: r.operacao, ha: Number(dd(r).parte[n]) || 0 }; });
  }
  function parteLimpa(W) { var o = {}; (W.tal || []).forEach(function (n) { if (W.parte && W.parte[n]) o[n] = W.parte[n]; }); return o; }
  function blocoParte(W, f) {
    if (!W.tal.length) return '';
    var tl = talhoesDe(f);
    return '<div class="ag-sec"><b>Área em cada talhão</b><small>Deixe em branco para o talhão inteiro. Se a aplicação for só em parte, digite os ha; depois faça outra recomendação para o restante.</small>' +
      W.tal.map(function (n) {
        var t = tl.filter(function (x) { return x.nome === n; })[0] || { ha: 0 }, outras = outrasParte(W, n);
        var resta = Math.round((t.ha - outras.reduce(function (s, o) { return s + o.ha; }, 0)) * 10) / 10;
        return '<div class="linha2" style="align-items:end;margin-top:8px"><div class="campo"><label>' + esc(n) + ' · ' + fmt(t.ha) + ' ha</label><input inputmode="decimal" data-w="parte" data-t="' + esc(n) +
          '" placeholder="' + fmt(t.ha) + '" value="' + (W.parte && W.parte[n] ? String(W.parte[n]).replace('.', ',') : '') + '"></div>' +
          (outras.length && resta > 0 && resta < t.ha ? '<button class="ag-chip" data-a="wresto" data-v="' + esc(n) + '">Usar o restante (' + fmt(resta) + ' ha)</button>' : '') + '</div>' +
          outras.map(function (o) { return '<small>Já em outra recomendação: ' + esc(o.op) + ' · ' + fmt(o.ha) + ' ha</small>'; }).join('');
      }).join('') + '</div>';
  }

  function pintarWiz() {
    var W = R.W, f = fazDe(W.faz), ha = haDe(f, W.tal, W.parte), h = '';
    var passos = ['Onde', 'O quê', 'Quando'].map(function (n, i) { return '<div class="ag-passo' + (W.passo === i + 1 ? ' on' : '') + (W.passo > i + 1 ? ' ok' : '') + '"><b>' + (W.passo > i + 1 ? '✔' : i + 1) + '</b>' + n + '</div>'; }).join('');
    h += '<div class="ag-passos">' + passos + '</div>';
    if (W.passo === 1) {
      var culturas = {}; ST.plantio.forEach(function (r) { if (r.fazenda_id === W.faz && (r.safra || '') === (W.safra || '') && r.cultura) culturas[r.cultura] = 1; });
      h += '<div class="campo"><label>Fazenda</label><select data-w="faz">' + opcoesFaz(W.faz) + '</select></div>' +
        '<div class="ag-dica">👆 Toque nos talhões do mapa para marcar onde vai a aplicação.</div><div class="ag-mapa">' + mapaSVG(f, W.tal) + '</div>' +
        '<div class="ag-chips"><button class="ag-chip" data-a="wtodos">Todos</button>' + Object.keys(culturas).map(function (k) {
          return '<button class="ag-chip" data-a="wcult" data-v="' + k + '">Só ' + esc((NOME_CULT[k] || k).toLowerCase()) + '</button>'; }).join('') + '<button class="ag-chip" data-a="wlimpar">Limpar</button></div>' +
        '<div class="ag-resumo-ha"><b>' + W.tal.length + '</b> talhão(ões) · <b>' + fmt(ha) + '</b> ha</div>' + blocoParte(W, f);
    } else if (W.passo === 2) {
      if (W.origem) { var ro = recDe(W.origem.id); h += '<div class="ag-seq">🔁 <b>' + esc(ordTxt(W.op, W.num)) + '</b> em ' + esc(W.tal.join(', ')) + ', data prevista <b>' + curta(W.data) + '</b> (intervalo de ' + W.rep + ' dias). A anterior foi com <b>' + esc(prodsDe(ro).map(function (p) { return p[0]; }).join(' + ')) + '</b>. Escolha os produtos desta: podem ser outros, só a data segue o intervalo.</div>'; }
      if (!ST.produtos.length) h += '<div class="ag-sec"><b>Seu catálogo de produtos está vazio</b><small>Carregue uma lista inicial (herbicidas, fungicidas, adubos…) e ajuste depois.</small><button class="btn secundario" data-a="padrao">Carregar lista inicial</button></div>';
      h += '<label class="ag-l">Comece por um modelo pronto (você ajusta depois)</label><div class="ag-chips">' + Object.keys(MODELOS).map(function (m) {
        return '<button class="ag-chip' + (W.modelo === m ? ' on' : '') + '" data-a="wmodelo" data-v="' + esc(m) + '">' + esc(m) + '</button>'; }).join('') + '<button class="ag-chip" data-a="wbranco">Em branco</button></div>';
      h += W.prods.map(function (p, i) {
        var tem = ST.produtos.some(function (x) { return x.nome === p[0]; });
        var opts = TIPOS.map(function (tp) {
          var l = ST.produtos.filter(function (x) { return (x.tipo || 'Outro') === tp; }); if (!l.length) return '';
          return '<optgroup label="' + tp + '">' + l.map(function (x) { return '<option value="' + esc(x.nome) + '"' + (x.nome === p[0] ? ' selected' : '') + '>' + esc(x.nome) + '</option>'; }).join('') + '</optgroup>';
        }).join('') + (p[0] && !tem ? '<option value="' + esc(p[0]) + '" selected>' + esc(p[0]) + '</option>' : '');
        return '<div class="ag-prod"><div class="ag-pt"><b class="ag-ord">' + (i + 1) + '</b><select data-w="prod" data-i="' + i + '"><option value="">Escolher produto…</option>' + opts + '</select>' +
          '<div class="ag-mv"><button data-a="wmover" data-v="' + i + '|-1">↑</button><button data-a="wmover" data-v="' + i + '|1">↓</button><button data-a="wdel" data-v="' + i + '">✕</button></div></div>' +
          '<div class="ag-dose"><button data-a="wdose" data-v="' + i + '|-1">−</button><input inputmode="decimal" data-w="dose" data-i="' + i + '" value="' + String(p[1]).replace('.', ',') + '">' +
          '<select data-w="un" data-i="' + i + '">' + UNIDADES.map(function (u) { return '<option' + (u === p[2] ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select>' +
          '<button data-a="wdose" data-v="' + i + '|1">+</button><div class="ag-tot">' + (ha ? 'total <b>' + volTotal(p[1] * ha, p[2]) + '</b>' : '—') + '</div></div></div>';
      }).join('');
      h += '<div class="ag-duas"><button class="btn secundario" data-a="waddprod">+ Adicionar produto</button><button class="btn secundario" data-a="novoprod">Cadastrar produto novo</button></div>';
      if (W.prods.some(function (p) { return liquido(p[2]); })) {
        var hat = W.tanque / (W.calda || 1);
        h += '<div class="ag-sec azul"><b>💧 Calda</b><div class="linha2" style="margin-top:6px"><div class="campo"><label>Vazão (L/ha)</label><input inputmode="numeric" data-w="calda" value="' + W.calda + '"></div>' +
          '<div class="campo"><label>Tanque do pulverizador (L)</label><input inputmode="numeric" data-w="tanque" value="' + W.tanque + '"></div></div>' +
          '<div class="ag-chips">' + [2000, 3000, 4000].map(function (v) { return '<button class="ag-chip' + (W.tanque === v ? ' on' : '') + '" data-a="wtanque" data-v="' + v + '">Jacto ' + v.toLocaleString('pt-BR') + ' L</button>'; }).join('') + '</div>' +
          '<small>Cada tanque cobre <b>' + fmt(hat, 0) + ' ha</b>' + (ha ? ' · ' + tanques(ha, hat, W.calda) : '') + '. Por tanque cheio, na ordem de mistura:</small>' +
          W.prods.filter(function (p) { return p[0]; }).map(function (p, i) { return '<div class="ag-mix"><span>' + (i + 1) + '. ' + esc(p[0]) + '</span><em>' + fmt(p[1] * hat, p[1] * hat < 10 ? 2 : 1) + ' ' + esc(unid(p[2])) + '</em></div>'; }).join('') + '</div>';
      }
    } else {
      var livre = !!W.opLivre || (!!W.op && OPS.indexOf(W.op) < 0);
      var op = W.op || 'Dessecação', resps = (cad().responsaveis || []).map(function (x) { return x.nome; });
      if (W.resp && resps.indexOf(W.resp) < 0) resps.unshift(W.resp);
      h += '<div class="linha2"><div class="campo"><label>Operação</label><select data-w="op">' + OPS.map(function (o) { return '<option' + (!livre && o === op ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '<option value="__outra"' + (livre ? ' selected' : '') + '>✏️ Escrever outra…</option></select>' + (livre ? '<input data-w="oplivre" placeholder="Digite a operação (ex.: Dessecação pré-plantio)" value="' + esc(W.op) + '" style="margin-top:6px">' : '') + '</div>' +
        '<div class="campo"><label>Data prevista</label><input type="date" data-w="data" value="' + esc(W.data) + '"></div></div>' +
        '<div class="campo"><label>Ou programar por DAE (dias após a emergência)</label><input inputmode="numeric" data-w="dae" placeholder="Ex.: 25" value="' + (W.dae || '') + '"></div>' +
        '<div class="ag-chips">' + [15, 20, 25, 30, 35, 40, 45, 50].map(function (v) { return '<button class="ag-chip' + (W.dae === v ? ' on' : '') + '" data-a="wdae" data-v="' + v + '">DAE ' + v + '</button>'; }).join('') + '</div>' +
        (W.dae && W.daeMsg ? '<div class="ag-dica">📆 ' + esc(W.daeMsg) + '</div>' : '') +
        '<div class="linha2"><div class="campo"><label>Quem aplica</label><select data-w="resp"><option value="">—</option>' + resps.map(function (n) { return '<option' + (n === W.resp ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label>Safra</label><select data-w="safra">' + opcoesSafra(W.safra) + '</select></div></div>' +
        '<div class="ag-rep"><label class="ag-sw"><input type="checkbox" data-w="repon"' + (W.rep > 0 ? ' checked' : '') + '> 🔁 Faz parte de uma sequência (1º, 2º, 3º fungicida…)</label>' +
        (W.rep > 0 ? '<div class="ag-g3"><div class="campo"><label>Próxima em (dias)</label><input inputmode="numeric" data-w="rep" value="' + W.rep + '"></div><div class="campo"><label>Nº de aplicações</label><input inputmode="numeric" data-w="total" value="' + W.total + '"></div><div class="campo"><label>Avisar (dias antes)</label><input inputmode="numeric" data-w="aviso" value="' + W.aviso + '"></div></div>' +
          '<div class="ag-dica">⏱ A contagem começa quando você marcar “aplicada”. Ex.: aplicou em ' + curta(W.data) + ' → a próxima (podem ser outros produtos) vence em <b>' + curta(addDias(W.data, W.rep)) + '</b>, e o alerta aparece aqui e no relatório do cliente ' + W.aviso + ' dia(s) antes.</div>' : '') + '</div>' +
        '<div class="campo"><label>Observação para a aplicação</label><textarea rows="2" data-w="obs" placeholder="Ex.: aplicar com vento abaixo de 10 km/h">' + esc(W.obs) + '</textarea></div>' +
        '<label class="ag-sw"><input type="checkbox" data-w="mostrar"' + (W.mostrar ? ' checked' : '') + '> Mostrar no relatório do cliente</label>' +
        '<div class="ag-sec"><b>Resumo</b><small>' + esc(op) + ' · ' + esc(f ? f.nome : '') + '</small>' +
        (W.rep > 0 ? '<small>🔁 ' + esc(ordTxt(op, W.num)) + ' de ' + W.total + ' · próxima ' + W.rep + ' dias depois · avisa ' + W.aviso + ' dia(s) antes</small>' : '') +
        '<small>' + esc(W.tal.join(', ')) + ' · <b>' + fmt(ha) + ' ha</b></small>' +
        W.prods.filter(function (p) { return p[0]; }).map(function (p, i) { return '<small>' + (i + 1) + '. ' + esc(p[0]) + ' · ' + doseTxt(p[1]) + ' ' + esc(p[2]) + ' → <b>' + volTotal(p[1] * ha, p[2]) + '</b></small>'; }).join('') + '</div>';
    }
    h += '<div class="ag-rodape">' + (W.passo > 1 ? '<button class="btn secundario" data-a="wvoltar">← Voltar</button>' : '') +
      (W.passo < 3 ? '<button class="btn" data-a="wprox">Continuar →</button>' : '<button class="btn" data-a="wsalvar">' + (W.id ? 'Salvar alterações' : 'Salvar recomendação') + '</button>') + '</div>';
    pintar(tR, W.origem ? 'Programar ' + ordTxt(W.op, W.num) : (W.id ? 'Editar recomendação' : 'Nova recomendação'), 'Passo ' + W.passo + ' de 3', '', h);
  }

  function wProx() {
    var W = R.W;
    if (W.passo === 1 && !W.tal.length) { toast('Toque em pelo menos um talhão do mapa'); return; }
    if (W.passo === 2 && !W.prods.filter(function (p) { return p[0]; }).length) { toast('Escolha ao menos um produto'); return; }
    W.passo++;
    if (W.passo === 3 && !W.repMan) {
      var iv = 0; W.prods.forEach(function (p) { var c = prodCat(p[0]); if (c && Number(c.intervalo_dias) > iv) iv = Number(c.intervalo_dias); });
      W.rep = iv; W.total = iv ? 3 : 1;
    }
    pintarWiz(); topoRolagem();
  }

  function wSalvar() {
    var W = R.W;
    if (!W.tal.length) { toast('Escolha os talhões'); return; }
    var prods = W.prods.filter(function (p) { return p[0]; }).map(function (p) { return [p[0], p[1], p[2]]; });
    if (!prods.length) { toast('Escolha ao menos um produto'); return; }
    var antes = W.id ? recDe(W.id) : null;
    var r = {
      id: W.id || novoId('rc'), fazenda_id: W.faz, safra: W.safra || '', operacao: W.op || 'Dessecação', data_prevista: W.data, mostrar: !!W.mostrar,
      dados: { tal: W.tal.slice(), dae: W.dae || 0, prods: prods, calda: W.calda, tanque: W.tanque, resp: W.resp, obs: W.obs, rep: W.rep, num: W.num || 1, total: W.total, aviso: W.aviso,
        feito: antes ? cp(feitoDe(antes)) : {}, prox: antes ? cp(proxDe(antes)) : {}, parte: parteLimpa(W) }
    };
    if (antes) { Object.keys(r.dados.feito).forEach(function (t) { if (r.dados.tal.indexOf(t) < 0) delete r.dados.feito[t]; }); }
    if (W.origem) {
      var o = recDe(W.origem.id);
      if (o) { var od = dd(o); od.prox = od.prox || {}; W.origem.tal.forEach(function (t) { od.prox[t] = true; }); salvarRecLocal(o); }
    }
    if (r.dados.dae > 0) { r.dados.datas = datasTal(r); } else delete r.dados.datas;
    salvarRecLocal(r);
    ST.ult.safra = r.safra; gravar();
    R.W = null; R.id = r.id; R.view = 'det'; pintarRecs(); topoRolagem();
    toast('Recomendação salva');
  }

  function aplicaDae(n) {
    var W = R.W;
    if (!(n > 0)) { W.dae = 0; return; }
    W.dae = n;
    // uma data para cada talhão, pela emergência dele (ou plantio + 5 dias)
    var lista = W.tal.map(function (t) {
      var p = linhaPlantio(W.faz, W.safra, t), b = baseDae(W.faz, W.safra, t);
      return b ? { t: t, d: addDias(b, n), est: !(p && p.data_emerg) } : { t: t, d: '' };
    });
    var com = lista.filter(function (x) { return x.d; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    if (!com.length) { W.daeMsg = 'Nenhum talhão escolhido tem data de plantio ou emergência. Informe em 🌱 Plantio.'; pintarWiz(); return; }
    W.data = com[0].d;   // a primeira: ordena a lista e serve para talhão sem plantio
    var sem = lista.filter(function (x) { return !x.d; }).map(function (x) { return x.t; });
    W.daeMsg = 'DAE ' + n + ', uma data por talhão: ' + com.map(function (x) { return x.t + ' ' + curta(x.d) + (x.est ? '*' : ''); }).join(' · ') +
      (com.some(function (x) { return x.est; }) ? '. * sem emergência informada: plantio + ' + EMERG_APOS_PLANTIO + ' dias' : '') +
      (sem.length ? '. Sem plantio (fica ' + curta(W.data) + '): ' + sem.join(', ') : '') + '.';
    pintarWiz();
  }
  function entradaWiz(el) {
    var W = R.W, w = el.dataset.w, i = Number(el.dataset.i);
    if (w === 'faz') { W.faz = el.value; W.tal = []; ST.ult.faz = W.faz; gravar(); pintarWiz(); return; }
    if (w === 'prod') {
      var c = prodCat(el.value); W.prods[i][0] = el.value;
      if (c) { W.prods[i][1] = Number(c.dose) || 0; W.prods[i][2] = c.unidade || 'L/ha'; }
      pintarWiz(); return;
    }
    if (w === 'parte') {
      var tn = el.dataset.t, hv = numBR(el.value), tt = talhoesDe(fazDe(W.faz)).filter(function (x) { return x.nome === tn; })[0] || { ha: 0 };
      W.parte = W.parte || {};
      if (hv > 0 && hv < tt.ha) W.parte[tn] = Math.round(hv * 10) / 10; else delete W.parte[tn];
      pintarWiz(); return;
    }
    if (w === 'dose') { W.prods[i][1] = numBR(el.value); pintarWiz(); return; }
    if (w === 'un') { W.prods[i][2] = el.value; pintarWiz(); return; }
    if (w === 'calda') { W.calda = numBR(el.value) || 100; pintarWiz(); return; }
    if (w === 'tanque') { W.tanque = numBR(el.value) || 3000; pintarWiz(); return; }
    if (w === 'op') { if (el.value === '__outra') { W.opLivre = true; W.op = ''; pintarWiz(); var xo = document.querySelector('[data-w="oplivre"]'); if (xo) xo.focus(); return; } W.opLivre = false; W.op = el.value; return; }
    if (w === 'oplivre') { W.op = el.value; return; }
    if (w === 'dae') { aplicaDae(parseInt(el.value, 10)); return; }
    if (w === 'data') { var tinhaDae = W.dae; W.dae = 0; W.data = el.value; if (W.rep > 0 || tinhaDae) pintarWiz(); return; }
    if (w === 'resp') { W.resp = el.value; return; }
    if (w === 'safra') { W.safra = el.value; return; }
    if (w === 'obs') { W.obs = el.value; return; }
    if (w === 'mostrar') { W.mostrar = el.checked; return; }
    if (w === 'repon') { W.repMan = true; W.rep = el.checked ? (W.rep || 14) : 0; W.total = el.checked ? Math.max(W.total, 2) : 1; pintarWiz(); return; }
    if (w === 'rep' || w === 'total' || w === 'aviso') {
      W.repMan = true; var v = parseInt(el.value, 10) || 0;
      W[w] = Math.max(w === 'aviso' ? 0 : 1, v); if (w === 'total' && W.total < 2) W.total = 2; pintarWiz();
    }
  }

  function cliqueWiz(a, v) {
    var W = R.W, p;
    if (a === 'wtog') { var k = W.tal.indexOf(v); if (k >= 0) W.tal.splice(k, 1); else W.tal.push(v); pintarWiz(); return true; }
    if (a === 'wtodos') { W.tal = talhoesDe(fazDe(W.faz)).map(function (t) { return t.nome; }); pintarWiz(); return true; }
    if (a === 'wlimpar') { W.tal = []; pintarWiz(); return true; }
    if (a === 'wresto') {
      var tw = talhoesDe(fazDe(W.faz)).filter(function (x) { return x.nome === v; })[0] || { ha: 0 };
      var jaw = outrasParte(W, v).reduce(function (s, o) { return s + o.ha; }, 0), rw = Math.round((tw.ha - jaw) * 10) / 10;
      W.parte = W.parte || {}; if (rw > 0 && rw < tw.ha) W.parte[v] = rw; else delete W.parte[v];
      pintarWiz(); return true;
    }
    if (a === 'wcult') {
      var nomes = ST.plantio.filter(function (r) { return r.fazenda_id === W.faz && (r.safra || '') === (W.safra || '') && r.cultura === v; }).map(function (r) { return r.talhao; });
      W.tal = talhoesDe(fazDe(W.faz)).map(function (t) { return t.nome; }).filter(function (n) { return nomes.indexOf(n) >= 0; }); pintarWiz(); return true;
    }
    if (a === 'wdae') { aplicaDae(Number(v)); return true; }
    if (a === 'wmodelo') { var m = MODELOS[v]; W.modelo = v; W.opLivre = false; W.op = m[0]; W.prods = cp(m[1]); pintarWiz(); return true; }
    if (a === 'wbranco') { W.modelo = ''; W.prods = []; pintarWiz(); return true; }
    if (a === 'waddprod') { W.prods.push(['', 1, 'L/ha']); pintarWiz(); return true; }
    if (a === 'wdel') { W.prods.splice(Number(v), 1); pintarWiz(); return true; }
    if (a === 'wmover') { p = v.split('|'); var i = Number(p[0]), j = i + Number(p[1]); if (j >= 0 && j < W.prods.length) { var x = W.prods[i]; W.prods[i] = W.prods[j]; W.prods[j] = x; pintarWiz(); } return true; }
    if (a === 'wdose') {
      p = v.split('|'); var q = W.prods[Number(p[0])], passo = q[1] >= 50 ? 10 : q[1] >= 5 ? 0.5 : q[1] >= 1 ? 0.1 : 0.05;
      q[1] = Math.max(0, Math.round((q[1] + Number(p[1]) * passo) * 100) / 100); pintarWiz(); return true;
    }
    if (a === 'wtanque') { W.tanque = Number(v); pintarWiz(); return true; }
    if (a === 'wprox') { wProx(); return true; }
    if (a === 'wvoltar') { W.passo--; pintarWiz(); topoRolagem(); return true; }
    if (a === 'wsalvar') { wSalvar(); return true; }
    if (a === 'padrao') { carregarPadrao().then(pintarWiz); return true; }
    if (a === 'novoprod') { modalProduto(null, function (pr) { W.prods.push([pr.nome, Number(pr.dose) || 1, pr.unidade || 'L/ha']); pintarWiz(); }); return true; }
    return false;
  }

  /* ----- catálogo de produtos ----- */
  async function carregarPadrao() {
    var ja = {}; ST.produtos.forEach(function (p) { ja[p.nome] = 1; });
    PADRAO.forEach(function (x) {
      if (ja[x[0]]) return;
      var pr = { id: novoId('pr'), nome: x[0], tipo: x[1], ingrediente: x[2], dose: x[3], unidade: x[4], intervalo_dias: x[5] };
      ST.produtos.push(pr); ST.fila.push({ rota: '/api/agro/produto', corpo: pr });
    });
    gravar(); if (navigator.onLine) await descarregar();
    toast('Lista inicial carregada');
  }

  function pintarCatalogo() {
    var h = '<button class="btn" data-a="pnovo">+ Novo produto</button>';
    if (!ST.produtos.length) h += '<div class="aviso" style="margin-top:10px">Catálogo vazio.</div><button class="btn secundario" data-a="padrao">Carregar lista inicial</button>';
    TIPOS.forEach(function (tp) {
      var l = ST.produtos.filter(function (p) { return (p.tipo || 'Outro') === tp; }); if (!l.length) return;
      h += '<h2>' + tp + '</h2>' + l.map(function (p) {
        return '<div class="lista-item" data-a="pedit" data-v="' + esc(p.id) + '"><div class="txt"><b>' + esc(p.nome) + '</b><span>' + esc(p.ingrediente || '') + '</span></div>' +
          '<span class="badge">' + doseTxt(Number(p.dose) || 0) + ' ' + esc(p.unidade) + (Number(p.intervalo_dias) ? ' · ' + p.intervalo_dias + ' d' : '') + '</span></div>';
      }).join('');
    });
    pintar(tR, 'Produtos', ST.produtos.length + ' no catálogo', '', h);
  }

  function modalProduto(p, depois) {
    var novo = !p; p = p || { id: novoId('pr'), nome: '', tipo: 'Fungicida', ingrediente: '', dose: 1, unidade: 'L/ha', intervalo_dias: 0 };
    var ov = document.createElement('div'); ov.className = 'ag-ov';
    ov.innerHTML = '<div class="ag-mod"><h3>' + (novo ? 'Novo produto' : 'Editar produto') + '</h3>' +
      '<div class="campo"><label>Nome</label><input id="pdNome" value="' + esc(p.nome) + '" placeholder="Ex.: Fungicida duplo mix"></div>' +
      '<div class="linha2"><div class="campo"><label>Tipo</label><select id="pdTipo">' + TIPOS.map(function (t) { return '<option' + (t === p.tipo ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Unidade</label><select id="pdUn">' + UNIDADES.map(function (u) { return '<option' + (u === p.unidade ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="campo"><label>Ingrediente ativo</label><input id="pdIng" value="' + esc(p.ingrediente) + '"></div>' +
      '<div class="linha2"><div class="campo"><label>Dose padrão</label><input id="pdDose" inputmode="decimal" value="' + String(p.dose).replace('.', ',') + '"></div>' +
      '<div class="campo"><label>Intervalo (dias)</label><input id="pdInt" inputmode="numeric" value="' + (Number(p.intervalo_dias) || '') + '" placeholder="só p/ sequências"></div></div>' +
      '<button class="btn" data-m="ok">Salvar</button>' + (novo ? '' : '<button class="btn perigo" data-m="del">Excluir produto</button>') + '<button class="btn secundario" data-m="no">Cancelar</button></div>';
    document.body.appendChild(ov);
    ov.onclick = function (ev) {
      var m = ev.target.dataset && ev.target.dataset.m;
      if (m === 'no' || ev.target === ov) { ov.remove(); return; }
      if (m === 'del') {
        if (!confirm('Excluir este produto do catálogo?')) return;
        ST.produtos = ST.produtos.filter(function (x) { return x.id !== p.id; }); gravar(); enfileirar('/api/agro/produto/apagar', { id: p.id }); ov.remove(); pintarRecs(); return;
      }
      if (m !== 'ok') return;
      var nome = $('#pdNome', ov).value.trim(); if (!nome) { toast('Informe o nome'); return; }
      var pr = { id: p.id, nome: nome, tipo: $('#pdTipo', ov).value, ingrediente: $('#pdIng', ov).value.trim(), dose: numBR($('#pdDose', ov).value), unidade: $('#pdUn', ov).value, intervalo_dias: Math.round(numBR($('#pdInt', ov).value)) };
      var i = ST.produtos.findIndex(function (x) { return x.id === p.id; });
      if (i >= 0) ST.produtos[i] = pr; else ST.produtos.push(pr);
      gravar(); enfileirar('/api/agro/produto', pr); ov.remove();
      if (depois) depois(pr); else pintarRecs();
    };
  }

  /* ----- cliques das recomendações ----- */
  function cliqueRecs(a, v, alvo) {
    if (R.view === 'wiz' && cliqueWiz(a, v)) return;
    if (a === 'voltar') {
      if (R.view === 'wiz') {
        if (!confirm('Descartar esta recomendação?')) return;
        R.view = R.W && R.W.id ? 'det' : 'lista'; R.W = null; pintarRecs(); return;
      }
      if (R.view === 'det' || R.view === 'prods' || R.view === 'cal') { R.view = (R.view === 'det' && R.de === 'cal') ? 'cal' : 'lista'; R.de = ''; pintarRecs(); return; }
      return;
    }
    if (a === 'aba') { R.view = v; pintarRecs(); topoRolagem(); return; }
    if (a === 'calsel') { R.sel = v; pintarCalendario(); return; }
    if (a === 'calmes') { R.cm += Number(v); if (R.cm < 0) { R.cm = 11; R.cy--; } if (R.cm > 11) { R.cm = 0; R.cy++; } pintarCalendario(); return; }
    if (a === 'filtro') { R.filtro = v; pintarRecs(); return; }
    if (a === 'nova') { R.W = novoW(R.faz); R.view = 'wiz'; pintarRecs(); topoRolagem(); return; }
    if (a === 'abrirrec') { R.de = R.view; R.id = v; R.view = 'det'; pintarRecs(); topoRolagem(); return; }
    if (a === 'catalogo') { R.view = 'prods'; pintarRecs(); return; }
    if (a === 'padrao') { carregarPadrao().then(pintarRecs); return; }
    if (a === 'pnovo') { modalProduto(null, null); return; }
    if (a === 'pedit') { modalProduto(ST.produtos.filter(function (x) { return x.id === v; })[0], null); return; }
    if (a === 'aplicar') { modalAplicar(v); return; }
    if (a === 'desfazer') {
      // aplicado pelo operador (portal): guarda qual marca foi desfeita, senão ela voltaria do servidor
      var r = recDe(R.id), dx = dd(r);
      if (dx.feitoPorId && dx.feitoPorId[v]) { dx.desfeitos = (dx.desfeitos && !Array.isArray(dx.desfeitos)) ? dx.desfeitos : {}; dx.desfeitos[v] = dx.feitoPorId[v]; delete dx.feitoPorId[v]; }
      if (dx.feitoPor) delete dx.feitoPor[v];
      delete dx.feito[v]; salvarRecLocal(r); pintarOrdem(); return;
    }
    if (a === 'editarrec') { R.W = wDeRec(recDe(R.id)); R.view = 'wiz'; pintarRecs(); topoRolagem(); return; }
    if (a === 'excluirrec') {
      if (!confirm('Excluir esta recomendação? Isso também tira do relatório do cliente.')) return;
      var id = R.id; ST.recs = ST.recs.filter(function (x) { return x.id !== id; }); gravar(); enfileirar('/api/agro/rec/apagar', { id: id });
      R.view = 'lista'; pintarRecs(); return;
    }
    if (a === 'prog') {
      var pr = v.split('|'), o = recDe(pr[0]); if (!o) return;
      var od = dd(o), tl = talDe(o).filter(function (t) { return feitoDe(o)[t] && !proxDe(o)[t] && venc(o, t) === pr[1]; });
      var W = novoW(o.fazenda_id);
      W.safra = o.safra || W.safra; W.tal = tl.slice(); W.op = o.operacao; W.data = pr[1] < hoje() ? hoje() : pr[1]; W.rep = Number(od.rep) || 0; W.total = Number(od.total) || 1;
      W.aviso = od.aviso == null ? 3 : Number(od.aviso); W.repMan = true; W.num = (Number(od.num) || 1) + 1; W.calda = od.calda || 100; W.tanque = od.tanque || 3000;
      W.resp = od.resp || ''; W.mostrar = !!o.mostrar; W.origem = { id: o.id, tal: tl.slice() }; W.passo = 2;
      W.parte = {}; tl.forEach(function (n) { if (od.parte && od.parte[n]) W.parte[n] = od.parte[n]; });
      R.W = W; R.view = 'wiz'; pintarRecs(); topoRolagem();
    }
  }
  function mudancaRecs(el) {
    if (R.view === 'wiz' && el.dataset.w) { entradaWiz(el); return; }
    if (el.dataset.c === 'prod') { trocaProd(R, el.value); pintarRecs(); return; }
    if (el.dataset.c === 'faz') { R.faz = el.value; ST.ult.faz = R.faz; gravar(); pintarRecs(); return; }
    if (el.dataset.a === 'mostrar') { var r = recDe(R.id); r.mostrar = el.checked; salvarRecLocal(r); toast(el.checked ? 'Vai aparecer no relatório do cliente' : 'Escondida do relatório do cliente'); }
  }


  /* ---------------- aviso de novidade no painel ---------------- */
  function nvA() { var o = {}; try { o = JSON.parse(localStorage.getItem('agro_novo_adm') || '{}'); } catch (e) { o = {}; } return o; }
  function tagsNovo() {
    var o = nvA();
    [['abaPlantio', 'plantio'], ['abaRecs', 'recs'], ['abaModulos', 'modulos']].forEach(function (x) {
      var b = document.getElementById(x[0]); if (b) b.classList.toggle('ag-nova-aba', !o[x[1]]);
    });
  }
  function marcaNvA(k) { var o = nvA(); if (!o[k]) { o[k] = true; try { localStorage.setItem('agro_novo_adm', JSON.stringify(o)); } catch (e) { /* sem espaço */ } } tagsNovo(); }
  function avisoNovoAdm() {
    tagsNovo();
    var o = nvA(); if (o.aviso || document.getElementById('agNovo')) return;
    var d = document.createElement('div'); d.id = 'agNovo'; d.className = 'ag-novo';
    d.innerHTML = '<div class="ag-novo-card"><div class="ag-novo-ic">🌱</div><h3>Novidade no painel!</h3>' +
      '<p>Duas abas novas: <b>Plantio</b> (cultura, variedade, datas e sementes de cada talhão) e <b>Recomendações</b> (lista, calendário e catálogo de produtos).</p>' +
      '<p class="ag-novo-como">Em <b>Módulos</b> você escolhe quais contas enxergam cada uma. No app de campo elas aparecem em <b>🗺️ Mapa</b>.</p>' +
      '<button class="btn" id="agNovoOk">Entendi</button></div>';
    document.body.appendChild(d);
    document.getElementById('agNovoOk').onclick = function () { o.aviso = true; try { localStorage.setItem('agro_novo_adm', JSON.stringify(o)); } catch (e) { /* sem espaço */ } d.remove(); };
  }

  /* ---------------- custo × produção ----------------
     Gasto = produtos das recomendações marcadas como aplicadas (dose × área) × preço médio das entradas
     do estoque daquela fazenda. Produção = sacas/ha lançadas na colheita do app. */
  var CP = { safra: '', dados: null };
  var CP_CULT = { soja: 'Soja', milho: 'Milho', algodao: 'Algodão', feijao: 'Feijão', sorgo: 'Sorgo', trigo: 'Trigo', outra: 'Outra' };
  function cpBRL(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function cpN(v, d) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function cpPrecos() { try { return JSON.parse(localStorage.getItem('vsl-preco-saca') || '{}') || {}; } catch (e) { return {}; } }
  function cpNum(s) { var n = Number(String(s || '').replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
  async function agroCusto() {
    var box = document.getElementById('agCusto'); if (!box) return;
    try { CP.dados = await api('/api/agro/comparativo' + (CP.safra ? '?safra=' + encodeURIComponent(CP.safra) : '')); CP.safra = CP.dados.safra || ''; }
    catch (e) { box.innerHTML = '<div class="aviso">Não foi possível carregar: ' + esc(e.message) + '</div>'; return; }
    pintarCusto();
  }
  function pintarCusto() {
    var box = document.getElementById('agCusto'), D = CP.dados || { fazendas: [], safras: [] }, pr = cpPrecos();
    var culturas = {};
    D.fazendas.forEach(function (f) { f.talhoes.forEach(function (t) { if (t.cultura) culturas[t.cultura] = 1; }); });
    var h = '<div class="cp-topo"><div><label>Safra</label><select id="cpSafra">' + (D.safras.length ? D.safras : [CP.safra]).map(function (s) {
      return '<option' + (s === CP.safra ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>' +
      Object.keys(culturas).filter(function (c) { return c !== 'pastagem' && c !== 'pousio'; }).map(function (c) {
        return '<div><label>Preço da saca · ' + esc(CP_CULT[c] || c) + '</label><input data-preco="' + esc(c) + '" inputmode="decimal" placeholder="R$" value="' + (pr[c] ? String(pr[c]).replace('.', ',') : '') + '"></div>';
      }).join('') + '</div>' +
      '<p class="nota" style="margin:-4px 0 12px">Gasto = produtos das recomendações já aplicadas (dose × área) × preço médio das entradas do estoque de cada fazenda. ' +
      'Produção = média de sacas/ha lançada na colheita (app → Mapa → Plantio → Lançar colheita). Com o preço da saca, aparece o custo em sacas e o resultado.</p>';
    if (!D.fazendas.length) h += '<div class="aviso">Nada para comparar nesta safra ainda: marque recomendações como aplicadas, lance entradas no estoque e a colheita dos talhões.</div>';
    D.fazendas.forEach(function (f) {
      var tot = { ha: 0, custo: 0, sc: 0, haCol: 0, rec: 0, haRec: 0 };
      var maxCha = Math.max.apply(null, f.talhoes.map(function (t) { return t.custo_ha || 0; }).concat([1]));
      var linhas = f.talhoes.map(function (t) {
        var p = pr[t.cultura] || 0, cs = p && t.custo_ha ? t.custo_ha / p : 0, res = p && t.sc_ha ? t.sc_ha * p - t.custo_ha : null;
        tot.ha += t.ha; tot.custo += t.custo;
        if (t.sc_ha) { tot.sc += t.producao_sc; tot.haCol += t.ha; }
        if (res !== null) { tot.rec += t.producao_sc * p; tot.haRec += t.ha; }
        return '<tr><td><b>' + esc(t.nome) + '</b></td><td style="text-align:left">' + esc(CP_CULT[t.cultura] || t.cultura || '—') + '</td><td>' + cpN(t.ha, 1) + '</td>' +
          '<td>' + (t.aplicacoes || '—') + '</td><td>' + (t.custo ? cpBRL(t.custo) : '<span class="cp-sem">—</span>') + '</td>' +
          '<td>' + (t.custo_ha ? cpBRL(t.custo_ha) : '<span class="cp-sem">—</span>') + '</td>' +
          '<td><div class="cp-barra"><i style="width:' + Math.round((t.custo_ha || 0) / maxCha * 100) + '%"></i></div></td>' +
          '<td>' + (t.sc_ha ? cpN(t.sc_ha, 1) : '<span class="cp-sem">—</span>') + '</td><td>' + (t.sc_ha ? cpN(t.producao_sc) : '<span class="cp-sem">—</span>') + '</td>' +
          '<td>' + (cs ? cpN(cs, 1) + ' sc' : '<span class="cp-sem">—</span>') + '</td>' +
          '<td>' + (res === null ? '<span class="cp-sem">—</span>' : '<span class="' + (res >= 0 ? 'cp-pos' : 'cp-neg') + '">' + cpBRL(res) + '</span>') + '</td></tr>';
      }).join('');
      var chaMed = tot.ha ? tot.custo / tot.ha : 0, scMed = tot.haCol ? tot.sc / tot.haCol : 0;
      var custoColhido = 0; f.talhoes.forEach(function (t) { if (t.sc_ha && pr[t.cultura]) custoColhido += t.custo; });
      var resTot = tot.haRec ? tot.rec - custoColhido : null;
      h += '<div class="cp-faz"><h3>' + esc(f.nome) + '</h3><div class="sub">' + esc([f.produtor, f.conta].filter(Boolean).join(' · ')) + '</div>' +
        '<div class="cp-kpis"><div><b>' + cpBRL(tot.custo) + '</b><span>gasto em produtos</span></div><div><b>' + cpBRL(chaMed) + '</b><span>custo médio por ha</span></div>' +
        '<div><b>' + (scMed ? cpN(scMed, 1) + ' sc/ha' : '—') + '</b><span>produtividade média' + (tot.haCol ? ' (' + cpN(tot.haCol, 1) + ' ha colhidos)' : '') + '</span></div>' +
        '<div><b>' + (tot.sc ? cpN(tot.sc) + ' sc' : '—') + '</b><span>produção total</span></div>' +
        (resTot === null ? '' : '<div><b class="' + (resTot >= 0 ? 'cp-pos' : 'cp-neg') + '">' + cpBRL(resTot) + '</b><span>receita − gasto (talhões colhidos)</span></div>') + '</div>' +
        '<table><tr><th>Talhão</th><th style="text-align:left">Cultura</th><th>Área (ha)</th><th>Aplicações</th><th>Gasto</th><th>Gasto/ha</th><th></th><th>sc/ha</th><th>Produção (sc)</th><th>Custo em sc/ha</th><th>Resultado/ha</th></tr>' +
        linhas + '<tr class="tot"><td>Total</td><td></td><td>' + cpN(tot.ha, 1) + '</td><td></td><td>' + cpBRL(tot.custo) + '</td><td>' + cpBRL(chaMed) + '</td><td></td>' +
        '<td>' + (scMed ? cpN(scMed, 1) : '—') + '</td><td>' + (tot.sc ? cpN(tot.sc) : '—') + '</td><td></td><td></td></tr></table>' +
        (f.sem_preco.length ? '<div class="cp-aviso">Sem preço no estoque desta fazenda (o gasto deles não entrou): <b>' + esc(f.sem_preco.join(', ')) + '</b>. Lance uma entrada com valor no app (Recomendações → 📦 Estoque).</div>' : '') +
        '</div>';
    });
    box.innerHTML = h;
    var sel = document.getElementById('cpSafra'); if (sel) sel.onchange = function () { CP.safra = sel.value; agroCusto(); };
    box.querySelectorAll('[data-preco]').forEach(function (inp) {
      inp.onchange = function () { var o = cpPrecos(); var v = cpNum(inp.value); if (v) o[inp.dataset.preco] = v; else delete o[inp.dataset.preco]; try { localStorage.setItem('vsl-preco-saca', JSON.stringify(o)); } catch (e) {} pintarCusto(); };
    });
  }

  /* ---------------- acessos da fazenda e do operador (amvs.ia.br/portal) ---------------- */
  var ACS = [];
  var TIPO_AC = { fazenda: 'Fazenda (acompanha)', operador: 'Operador / encarregado' };
  async function agroAcessos() {
    var box = document.getElementById('agAcessos'); if (!box) return;
    try { ACS = (await api('/api/acessos')).acessos || []; } catch (e) { box.innerHTML = '<div class="aviso">' + esc(e.message) + '</div>'; return; }
    if (!CAD.fazendas.length) { try { await baixar(); } catch (e) {} }
    pintarAcessos();
  }
  function nomeFaz(id) { var f = CAD.fazendas.filter(function (x) { return x.id === id; })[0]; return f ? f.nome : '?'; }
  function linkPortal() { return location.origin + '/portal'; }
  function pintarAcessos() {
    var box = document.getElementById('agAcessos');
    var h = '<div class="ac-topo">Crie um login para a <b>fazenda</b> (o produtor ou gerente acompanha aplicações, mapas de área e variedade, evolução do plantio, estoque e custo por talhão) ' +
      'ou para o <b>operador do pulverizador / encarregado</b> (vê as aplicações e marca o que aplicou — aparece na hora no app como aplicado). ' +
      'Eles entram em <a href="' + esc(linkPortal()) + '" target="_blank">' + esc(linkPortal().replace(/^https?:\/\//, '')) + '</a>.</div>' +
      '<button class="btn" id="acNovo" style="max-width:260px">+ Novo acesso</button><div style="height:10px"></div>';
    if (!ACS.length) h += '<div class="aviso">Nenhum acesso criado ainda.</div>';
    else h += '<div class="ac-lista"><table><tr><th>Nome</th><th>Login</th><th>Tipo</th><th>Fazendas</th><th>Último acesso</th><th></th></tr>' + ACS.map(function (a) {
      return '<tr' + (a.ativo ? '' : ' style="opacity:.5"') + '><td><b>' + esc(a.nome || '—') + '</b>' + (a.ativo ? '' : '<br><span class="peq">desativado</span>') + '</td><td>' + esc(a.login) + '</td>' +
        '<td><span class="ac-tipo' + (a.papel === 'operador' ? ' op' : '') + '">' + esc(TIPO_AC[a.papel] || a.papel) + '</span></td>' +
        '<td>' + a.fazendas.map(function (id) { return esc(nomeFaz(id)); }).join('<br>') + '</td>' +
        '<td>' + (a.ultimo_acesso ? esc(new Date(a.ultimo_acesso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })) : '<span class="peq">nunca entrou</span>') + '</td>' +
        '<td style="white-space:nowrap"><button class="selo" data-acedit="' + esc(a.id) + '">editar</button> <button class="selo" data-aczap="' + esc(a.id) + '">WhatsApp</button></td></tr>';
    }).join('') + '</table></div>';
    box.innerHTML = h;
    document.getElementById('acNovo').onclick = function () { modalAcesso(null); };
    box.querySelectorAll('[data-acedit]').forEach(function (b) { b.onclick = function () { modalAcesso(ACS.filter(function (x) { return x.id === b.dataset.acedit; })[0]); }; });
    box.querySelectorAll('[data-aczap]').forEach(function (b) { b.onclick = function () { zapAcesso(ACS.filter(function (x) { return x.id === b.dataset.aczap; })[0], ''); }; });
  }
  function zapAcesso(a, senha) {
    var t = 'Olá' + (a.nome ? ', ' + a.nome : '') + '! Seu acesso ao AMVS ' + (a.papel === 'operador' ? 'para ver e marcar as aplicações' : 'para acompanhar a fazenda') + ':\n' +
      linkPortal() + '\nLogin: ' + a.login + (senha ? '\nSenha: ' + senha : '\n(senha: a que combinamos)') + '\n\nDica: no celular, adicione à tela de início para abrir como app.';
    window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
  }
  function modalAcesso(a) {
    var novo = !a; a = a || { nome: '', login: '', papel: 'fazenda', fazendas: [], ativo: true };
    var veu = document.createElement('div'); veu.className = 'veu';
    var cx = document.createElement('div'); cx.className = 'modal';
    var fz = CAD.fazendas.slice().sort(function (x, y) { return x.nome.localeCompare(y.nome, 'pt-BR'); });
    cx.innerHTML = '<h2 style="margin:0 0 12px">' + (novo ? 'Novo acesso' : 'Editar acesso') + '</h2>' +
      '<div class="campo"><label>Tipo</label><select id="acTipo"><option value="fazenda"' + (a.papel === 'fazenda' ? ' selected' : '') + '>Fazenda — acompanha (produtor / gerente)</option>' +
        '<option value="operador"' + (a.papel === 'operador' ? ' selected' : '') + '>Operador do pulverizador / encarregado — marca aplicações</option></select></div>' +
      '<div class="campo"><label>Nome</label><input id="acNome" value="' + esc(a.nome) + '" placeholder="ex.: João (operador) ou Fazenda Catarinense"></div>' +
      '<div class="campo"><label>Login</label><input id="acLogin" value="' + esc(a.login) + '" autocapitalize="none" placeholder="ex.: joao.catarinense"></div>' +
      '<div class="campo"><label>' + (novo ? 'Senha' : 'Nova senha (deixe em branco para manter)') + '</label><input id="acSenha" type="text" autocomplete="off" placeholder="mínimo 6 caracteres"></div>' +
      '<label class="marcar"><input type="checkbox" id="acGerar"> Gerar uma senha</label>' +
      '<div class="campo" style="margin-top:10px"><label>Fazendas liberadas</label></div><div class="ac-fz">' + (fz.length ? fz.map(function (f) {
        return '<label><input type="checkbox" value="' + esc(f.id) + '"' + (a.fazendas.indexOf(f.id) >= 0 ? ' checked' : '') + '> ' + esc(f.nome) + '</label>'; }).join('') : '<span class="peq">Nenhuma fazenda cadastrada.</span>') + '</div>' +
      (novo ? '' : '<label class="marcar"><input type="checkbox" id="acAtivo"' + (a.ativo ? ' checked' : '') + '> Acesso ativo</label>') +
      '<div id="acMsg" style="color:#C62828;font-size:13px;min-height:18px;margin:6px 0"></div>' +
      '<button class="btn" id="acOk">Salvar</button>' + (novo ? '' : '<button class="btn sec" id="acDel" style="color:#C62828;border-color:#C62828">Excluir acesso</button>') +
      '<button class="btn sec" id="acCancel">Cancelar</button>';
    veu.appendChild(cx); document.body.appendChild(veu);
    var sair = function () { veu.remove(); };
    veu.onclick = function (e) { if (e.target === veu) sair(); };
    cx.querySelector('#acCancel').onclick = sair;
    cx.querySelector('#acGerar').onchange = function () {
      if (!this.checked) return;
      var al = 'abcdefghjkmnpqrstuvwxyz23456789', s = '';
      for (var i = 0; i < 8; i++) s += al[Math.floor(Math.random() * al.length)];
      cx.querySelector('#acSenha').value = s;
    };
    if (!novo) cx.querySelector('#acDel').onclick = async function () {
      if (!confirm('Excluir o acesso ' + a.login + '? A pessoa não entra mais.')) return;
      try { await api('/api/acessos/apagar', { id: a.id }); sair(); agroAcessos(); } catch (e) { cx.querySelector('#acMsg').textContent = e.message; }
    };
    cx.querySelector('#acOk').onclick = async function () {
      var b = this, senha = cx.querySelector('#acSenha').value.trim();
      var corpo = { id: novo ? undefined : a.id, nome: cx.querySelector('#acNome').value.trim(), login: cx.querySelector('#acLogin').value.trim(),
        senha: senha, papel: cx.querySelector('#acTipo').value,
        fazendas: Array.prototype.slice.call(cx.querySelectorAll('.ac-fz input:checked')).map(function (i) { return i.value; }),
        ativo: novo ? true : cx.querySelector('#acAtivo').checked };
      b.disabled = true;
      try {
        await api('/api/acessos/salvar', corpo); sair(); await agroAcessos();
        if (senha && confirm('Acesso salvo. Enviar o link, o login e a senha pelo WhatsApp?')) zapAcesso(corpo, senha);
      } catch (e) { cx.querySelector('#acMsg').textContent = e.message; b.disabled = false; }
    };
  }

  var iniciado = false;
  window.agroIniciar = async function () {
    if (!iniciado) {
      iniciado = true;
      tP = document.getElementById('agPlantio'); tR = document.getElementById('agRecs');
      ligarTela(tP, cliquePlantio, mudancaPlantio); ligarTela(tR, cliqueRecs, mudancaRecs);
      tP.addEventListener('input', function (ev) { var n = ev.target; if (n.dataset && n.dataset.k && n.tagName === 'INPUT') entradaPlantio(n); });
      tR.addEventListener('input', function (ev) { var n = ev.target; if (R.W && n.dataset && n.dataset.w === 'obs') R.W.obs = n.value; if (R.W && n.dataset && n.dataset.w === 'oplivre') R.W.op = n.value; });
      var ap = document.getElementById('abaPlantio'), ar = document.getElementById('abaRecs');
      if (ap) ap.addEventListener('click', function () { marcaNvA('plantio'); abrirPlantio(); });
      var am = document.getElementById('abaModulos'); if (am) am.addEventListener('click', function () { marcaNvA('modulos'); });
      if (ar) ar.addEventListener('click', function () { marcaNvA('recs'); abrirRecs(); });
      var ac = document.getElementById('abaCusto'); if (ac) ac.addEventListener('click', function () { agroCusto(); });
      var aa = document.getElementById('abaAcessos'); if (aa) aa.addEventListener('click', function () { agroAcessos(); });
    }
    zoomIniciar();
    await atualizarModulos();
    if (ST.mod.plantio || ST.mod.recomendacoes) { avisoNovoAdm(); await baixar(); }
  };

  function ligarTela(el, clique, muda) {
    el.addEventListener('click', function (ev) {
      var n = ev.target.closest('[data-a]'); if (!n || !el.contains(n)) return;
      if (n.tagName === 'INPUT' || n.tagName === 'SELECT') return;
      clique(n.dataset.a, n.dataset.v, n);
    });
    el.addEventListener('change', function (ev) { var n = ev.target; if (n.tagName === 'INPUT' || n.tagName === 'SELECT' || n.tagName === 'TEXTAREA') muda(n); });
  }
})();
`;
