/* ============================================================
   portalpagina.js — a página amvs.ia.br/portal (login da fazenda e do operador)
   Uma página só: entra com login/senha e mostra a visão do papel do acesso.
   (O JavaScript abaixo fica dentro de um template literal: nada de crases nem dólar+chave.)
   ============================================================ */

import { AGRO_REL_CSS, AGRO_REL_JS } from './agrorel.js';
import { DPG_CSS, DPG_JS } from './graficodp.js';

export function paginaPortal() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1B7A43">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="AMVS Fazenda">
<link rel="apple-touch-icon" href="/api/icone/app.png">
<link rel="manifest" href="/portal.webmanifest">
<title>Acesso da fazenda · AMVS</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
:root{--verde:#1B7A43;--verde-escuro:#146034;--verde-claro:#E3F2E8;--linha:#E1E7E3;--fraco:#6B7B72;--texto:#1C2B23;--fundo:#F3F5F4;--erro:#C62828;--laranja:#E08A00}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--fundo);color:var(--texto);-webkit-text-size-adjust:100%;overflow-wrap:break-word}
.obs,.ap-sub,.tl .n,.caixa,.nota,.grupo-leg,.px{overflow-wrap:anywhere;min-width:0}
button{font:inherit;cursor:pointer}
.oculto{display:none!important}
.login{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:20px}
.login .card{background:#fff;border-radius:18px;padding:26px 22px;width:100%;max-width:380px;box-shadow:0 6px 24px rgba(0,0,0,.08)}
.login h1{margin:0 0 4px;font-size:22px;color:var(--verde-escuro)}.login p{margin:0 0 18px;color:var(--fraco);font-size:14px}
.campo{margin-bottom:12px}.campo label{display:block;font-size:12.5px;color:var(--fraco);margin-bottom:4px}
.campo input,.campo select{width:100%;font-size:16px;padding:11px 12px;border:1px solid #CFD8D3;border-radius:10px;background:#fff;color:var(--texto)}
.btn{display:block;width:100%;border:0;border-radius:12px;background:var(--verde);color:#fff;font-weight:700;font-size:16px;padding:13px}
.btn:disabled{opacity:.5}.btn.sec{background:#fff;color:var(--verde);border:1.5px solid var(--verde)}
.msg{font-size:13.5px;color:var(--erro);margin-top:10px;min-height:18px}
header.topo{background:var(--verde);color:#fff;padding:calc(12px + env(safe-area-inset-top,0px)) 16px 12px;position:sticky;top:0;z-index:1000;display:flex;align-items:center;gap:10px}
header.topo .info{flex:1;min-width:0}header.topo h1{margin:0;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
header.topo p{margin:2px 0 0;font-size:12.5px;opacity:.85}
header.topo button{background:rgba(255,255,255,.18);color:#fff;border:0;border-radius:10px;padding:8px 12px;font-size:13px;font-weight:600}
.corpo{max-width:900px;margin:0 auto;padding:12px 14px 60px}
.sel{display:flex;gap:10px;flex-wrap:wrap}.sel .campo{flex:1;min-width:150px;margin-bottom:8px}
.abas{display:flex;gap:4px;background:#E4EAE6;border-radius:12px;padding:3px;margin:4px 0 14px;overflow-x:auto}
.abas button{flex:1;white-space:nowrap;border:0;background:none;padding:9px 10px;border-radius:10px;font-size:14px;font-weight:600;color:var(--fraco)}
.abas button.on{background:#fff;color:var(--verde-escuro);box-shadow:0 1px 3px rgba(0,0,0,.12)}
h2.talhao{font-size:16px;color:var(--verde-escuro);margin:18px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--verde)}
h2.talhao small{float:right;font-weight:400;color:var(--fraco);font-size:12px;padding-top:3px}
.caixa{background:#fff;border:1px solid var(--linha);border-radius:12px;padding:12px;margin-bottom:12px}
.vazio{background:#fff;border:1px dashed #CFD8D3;border-radius:12px;padding:18px;text-align:center;color:var(--fraco);font-size:14px}
.kpis{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.kpis div{background:#fff;border:1px solid var(--linha);border-radius:12px;padding:10px 12px;flex:1;min-width:140px}
.kpis b{display:block;font-size:18px;color:var(--verde-escuro)}.kpis span{font-size:12px;color:var(--fraco)}
.tab{overflow-x:auto;background:#fff;border:1px solid var(--linha);border-radius:12px;margin-bottom:14px}
table{width:100%;border-collapse:collapse;font-size:13px;min-width:560px}
th{font-size:11.5px;color:var(--fraco);text-align:right;padding:8px;border-bottom:1px solid var(--linha);white-space:nowrap}
td{text-align:right;padding:8px;border-bottom:1px solid #EEF1EF;white-space:nowrap}
th:first-child,td:first-child{text-align:left}tr:last-child td{border-bottom:0}
.neg{color:var(--erro);font-weight:700}.sem{color:var(--fraco)}
.mapa-sat{height:420px;border-radius:12px;overflow:hidden;border:1px solid var(--linha);background:#DDE5DF}
.leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;margin:8px 2px 4px}.leg i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.tg{display:flex;gap:6px;margin-bottom:8px}.tg button{border:1px solid var(--linha);background:#fff;border-radius:16px;padding:6px 12px;font-size:13px}
.tg button.on{background:var(--verde);border-color:var(--verde);color:#fff}
.rot{background:none;border:0;box-shadow:none;color:#fff;font-weight:700;font-size:12px;text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap;text-align:center;line-height:1.15}
.rot small{display:block;font-size:11px;font-weight:600}
.fz-tit{margin-top:18px}
/* operador */
.chips{display:flex;gap:6px;margin-bottom:10px}.chips button{border:1px solid var(--linha);background:#fff;border-radius:16px;padding:7px 14px;font-size:14px}
.chips button.on{background:var(--verde);color:#fff;border-color:var(--verde)}
.ap{background:#fff;border:1px solid var(--linha);border-radius:14px;padding:12px;margin-bottom:12px;border-left:5px solid var(--laranja)}
.ap.aplicada{border-left-color:var(--verde)}.ap.atrasada{border-left-color:var(--erro)}
.ap-h{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.ap-h b{font-size:16.5px}
.selo{display:inline-block;font-size:11.5px;padding:3px 9px;border-radius:10px;background:#FFF3DC;color:#8A5A00;font-weight:700;white-space:nowrap}
.selo.ok{background:var(--verde-claro);color:var(--verde-escuro)}.selo.venc{background:#FDE4E4;color:var(--erro)}
.ap-sub{font-size:13px;color:var(--fraco);margin:3px 0 8px}
.pr{display:grid;grid-template-columns:1fr auto auto;gap:4px 12px;font-size:14px;padding:8px 10px;background:#F6F8F7;border-radius:10px;margin-bottom:8px}
.pr .h{font-size:11px;color:var(--fraco);text-transform:uppercase;letter-spacing:.3px}.pr .q{font-weight:700;color:var(--verde-escuro);text-align:right}.pr .d{text-align:right;color:var(--fraco)}
.pr.t4{grid-template-columns:1fr auto auto auto;gap:4px 10px}.pr .tq{font-weight:700;color:#1A4E85;text-align:right;background:#E6F0FA;border-radius:6px;padding:0 5px}
.pr .h.tq{background:none;color:#1A4E85}
.calda b{color:#0F3A66}
.campo-sel select{width:100%;font-size:15px;padding:10px;border:1px solid var(--linha);border-radius:10px;background:#fff;margin-bottom:8px}
.calda{font-size:13px;background:#E6F0FA;color:#1A4E85;border-radius:10px;padding:7px 10px;margin-bottom:8px}
.obs{font-size:13px;background:#FFFBEF;border-radius:10px;padding:7px 10px;margin-bottom:8px}
.tl{display:flex;align-items:center;gap:10px;padding:9px 4px;border-top:1px dashed var(--linha);font-size:14.5px}
.tl input{width:24px;height:24px;accent-color:var(--verde);flex:none}.tl .n{flex:1}.tl .n small{display:block;font-size:12px;color:var(--fraco)}
.tl .feito{color:var(--verde-escuro);font-size:12.5px;text-align:right}.tl .desf{border:0;background:none;color:var(--fraco);text-decoration:underline;font-size:12px}
.marcar{display:flex;gap:8px;align-items:flex-end;margin-top:10px;flex-wrap:wrap}.marcar .campo{margin:0;flex:0 0 150px}.marcar .btn{flex:1;min-width:160px}
.vermapa{border:0;background:none;color:var(--verde);font-weight:600;font-size:13px;padding:4px 0}
.mini{height:260px;border-radius:10px;overflow:hidden;margin-top:8px;border:1px solid var(--linha)}
.faixa{border-radius:12px;padding:9px 12px;font-size:13.5px;margin-bottom:10px;background:#E6F0FA;color:#1A4E85}
.faixa.am{background:#FFF3DC;color:#7A5200}
.push{display:flex;flex-direction:column;gap:8px;background:#EEF6F0;border:1px solid #CFE5D6;border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:14px}
.reg{font-size:12.5px;color:#1A4E85;margin-top:3px;overflow-wrap:anywhere}.reg img{width:56px;height:56px;object-fit:cover;border-radius:7px;margin:4px 4px 0 0}
.espera{color:#7A5200;font-size:12.5px}
.veu{position:fixed;inset:0;background:rgba(10,30,20,.5);z-index:2000;display:flex;align-items:flex-end;justify-content:center}
.folha{background:#fff;width:100%;max-width:560px;max-height:94dvh;overflow-y:auto;border-radius:18px 18px 0 0;padding:14px 16px calc(16px + env(safe-area-inset-bottom,0px))}
.folha h3{margin:0 0 2px;font-size:18px}.folha .q{font-size:13px;color:var(--fraco);margin-bottom:10px}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.g3 .campo{margin-bottom:8px;min-width:0}
.gdh{display:grid;grid-template-columns:1.45fr 1fr 1fr;gap:6px}.gdh .campo{margin-bottom:8px;min-width:0}
.folha .gdh .campo input{padding:7px 6px;height:40px;font-size:15px;-webkit-appearance:none;appearance:none;min-width:0;max-width:100%;text-align:left;background:#fff}
.folha .g3 .campo input{padding:8px;height:40px}
.seg{display:flex;gap:6px;margin:2px 0 8px}.seg button{flex:1;border:1px solid #CFD8D3;background:#fff;border-radius:10px;padding:9px 6px;font-size:14px;font-weight:600;color:var(--fraco)}
.seg button.on{background:var(--verde);border-color:var(--verde);color:#fff}
.seg.apmodo{margin:0 0 12px}
.parc{font-size:12.5px;color:#9A6400;margin-top:2px}.parc button{border:0;background:none;color:#C0392B;text-decoration:underline;font-size:12px;padding:0 4px}
.folha .campo input,.folha .campo textarea{width:100%;font-size:16px;padding:10px;border:1px solid #CFD8D3;border-radius:10px;font-family:inherit}
.folha .campo select{width:100%;font-size:16px;padding:10px;border:1px solid #CFD8D3;border-radius:10px;background:#fff;font-family:inherit}
.lanc{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--linha);border-radius:10px;padding:8px 10px;margin:6px 0;font-size:14px}
.lanc .t{flex:1;min-width:0}.lanc small{display:block;color:var(--fraco);font-size:12px}
.lanc button{border:0;background:none;color:#C0392B;font-size:13px;text-decoration:underline;padding:4px}
.barra{height:6px;background:#E4EAE6;border-radius:3px;overflow:hidden;margin-top:3px;min-width:60px}.barra i{display:block;height:100%;background:#2E7D32}
.folha label.l{display:block;font-size:12px;color:var(--fraco);margin-bottom:3px}
.alerta{background:#FFF3DC;color:#7A5200;border-radius:10px;padding:8px 10px;font-size:13px;margin-bottom:8px}
.fotos{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px}.fotos img{width:64px;height:64px;object-fit:cover;border-radius:8px}
.addfoto{border:1.5px dashed #9AA5A0;background:none;border-radius:10px;padding:10px;font-size:14px;width:100%;color:var(--texto)}
.folha .btn{margin-top:8px}
.cal-h{display:flex;align-items:center;justify-content:space-between;margin:4px 0 8px}.cal-h b{font-size:15px}
.cal-h button{border:1px solid var(--linha);background:#fff;border-radius:50%;width:34px;height:34px;font-size:16px}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.cal .dw{font-size:11px;color:var(--fraco);text-align:center;padding-bottom:2px}
.cal button{background:#fff;border:1px solid var(--linha);border-radius:9px;aspect-ratio:1/1.05;display:flex;flex-direction:column;align-items:center;padding:4px 0 0;gap:2px;font-size:13px;color:var(--texto)}
.cal button.hj{box-shadow:inset 0 0 0 1.5px var(--verde)}.cal button.sl{background:#E4F2E8;color:#14532D;font-weight:800;border:2.5px solid var(--verde);padding-top:2.5px}
.cal button i{display:flex;gap:1px;height:20px;align-items:center;font-style:normal}
.ico{width:19px;height:19px;display:block}
.ico.colh{width:30px;height:17px}.ico.pulv{width:32px;height:15px}.legc .ico.pulv{width:28px;height:13px}.ev .ico.pulv{width:40px;height:19px}
.cal button i{flex-direction:column;height:auto;min-height:16px}.cal button i .ico.colh{width:26px;height:15px}.legc .ico.colh{width:28px;height:16px}
.k-prev{color:#3B78C3}.k-apl{color:#2F9E5B}.k-venc{color:#C0392B}.k-colh{color:#9A5B12}

.legc{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--fraco);margin:8px 2px 12px}.legc span{display:inline-flex;align-items:center;gap:4px}
.ev{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid var(--linha);border-radius:12px;padding:9px 11px;margin-bottom:7px;font-size:13.5px}
.ev .ico{width:24px;height:24px;flex:none}.ev .ico.colh{width:42px;height:24px}.ev small{display:block;color:var(--fraco);font-size:12px}
.sems{display:flex;align-items:flex-end;gap:4px;height:110px;border-bottom:1px solid var(--linha);padding:0 2px}
.sems .c{flex:1;display:flex;flex-direction:column-reverse;gap:1px;min-width:0}.sems u{display:block;border-radius:2px}
.semr{display:flex;gap:4px;font-size:10.5px;color:var(--fraco);padding:3px 2px 0}.semr span{flex:1;text-align:center;min-width:0;overflow:hidden}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#222;color:#fff;padding:10px 16px;border-radius:12px;font-size:14px;z-index:3000;max-width:90%}
.rodape{text-align:center;color:var(--fraco);font-size:12px;margin-top:24px}.rodape a{color:var(--verde)}
${AGRO_REL_CSS}
${DPG_CSS}
.ini-ola{font-size:13px;color:var(--fraco);margin:2px 2px 10px}.ini-ola b{color:var(--texto);font-size:17px;display:block}
.ini-card{background:#fff;border:1px solid var(--linha);border-radius:16px;padding:13px;margin-bottom:12px}
.ini-ct{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}.ini-ct h3{margin:0;font-size:14.5px;color:var(--verde-escuro)}.ini-ct span{font-size:12px;color:var(--fraco)}
.ini-lk{border:0;background:none;color:var(--verde);font-size:12.5px;font-weight:600;padding:0;cursor:pointer}
.ini-vz{font-size:13px;color:var(--fraco);padding:4px 0}
.ini-pe{font-size:11px;color:var(--fraco);margin-top:8px;line-height:1.35}
.ini-card.clima{background:linear-gradient(160deg,#2F80C9,#1E5F9E);color:#fff;border:0}
.clima .ini-ct h3,.clima .ini-ct span,.clima .ini-vz,.clima .ini-pe{color:#fff}.clima .ini-ct span,.clima .ini-pe{opacity:.85}
.clima select{max-width:58%;border:0;border-radius:8px;padding:4px 6px;font-size:13px;background:rgba(255,255,255,.92);color:#1C2B23}
.ini-agora{display:flex;align-items:center;gap:12px}.ini-agora .ic{font-size:44px;line-height:1}.ini-agora .t{font-size:42px;font-weight:300;line-height:1}.ini-agora .d{font-size:13px;opacity:.92;line-height:1.5}
.ini-dias{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-top:12px;background:rgba(255,255,255,.13);border-radius:12px;padding:8px 2px}
.ini-dias div{text-align:center;font-size:11.5px;min-width:0}.ini-dias i{font-style:normal;display:block;font-size:19px;margin:3px 0}.ini-dias b{display:block;font-size:12.5px}.ini-dias small{display:block;opacity:.85}
.ini-dias u{display:inline-block;text-decoration:none;margin-top:3px;background:rgba(255,255,255,.22);border-radius:6px;padding:1px 3px;font-size:10px;white-space:nowrap}
.ini-jan{margin-top:10px;background:#fff;color:var(--texto);border-radius:12px;padding:9px 11px;font-size:13px;display:flex;gap:9px;align-items:center}
.ini-jan .tr{font-size:22px}.ini-jan .bar{flex:1;min-width:0}.ini-jan small{display:block;font-size:10.5px;color:var(--fraco);margin-top:3px}
.ini-jan .hrs{display:flex;gap:2px;margin-top:5px}.ini-jan .hrs u{flex:1;height:8px;border-radius:2px;background:#DCE2DE}.ini-jan .hrs u.ok{background:#2F9E5B}.ini-jan .hrs u.md{background:#F2C14E}
.ini-jan .hx{display:flex;justify-content:space-between;font-size:10px;color:var(--fraco);margin-top:2px}
.ini-mk{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ini-m{border:1px solid var(--linha);border-radius:12px;padding:9px 10px;min-width:0}
.ini-m:last-child:nth-child(odd){grid-column:1/-1}
.ini-m small{font-size:11.5px;color:var(--fraco);display:block}.ini-m small.ini-pr{font-size:11px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ini-m b{font-size:18px;display:block;margin:2px 0}.ini-m b span{font-size:12px;font-weight:400}
.ini-m em{font-style:normal;font-size:12px;font-weight:700;color:var(--fraco)}.ini-m em.up{color:#2F9E5B}.ini-m em.dn{color:#C62828}
.ini-m svg{display:block;width:100%;height:24px;margin-top:4px}
.ini-k2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.ini-k2 .ini-card{margin:0}
.ini-anel{display:flex;align-items:center;gap:10px}.ini-anel svg{flex:none}.ini-anel b{font-size:19px;display:block}.ini-anel span{font-size:12px;color:var(--fraco)}
.cal-ic{flex:none;width:46px;border-radius:9px;border:1px solid var(--linha);text-align:center;font-size:20px;font-weight:700;line-height:1.1;padding-bottom:3px;overflow:hidden}
.cal-ic small{display:block;background:#C77700;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 0;margin-bottom:2px}
.ini-mini{font-size:12px;color:var(--fraco);margin-top:8px}.ini-mini b{color:var(--texto)}
.ini-cont{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px}.ini-cont div{text-align:center;border-radius:10px;padding:7px 4px}
.ini-cont b{display:block;font-size:20px}.ini-cont span{font-size:11.5px}
.ini-cont .at{background:#FDE7E7;color:#C62828}.ini-cont .hj{background:#FFF1DB;color:#8A5300}.ini-cont .se{background:#E8F3EC;color:#146034}
.ini-ap{display:flex;gap:10px;align-items:center;padding:8px 0;border-top:1px dashed var(--linha);font-size:13.5px}
.ini-ap .sel{font-size:11.5px;font-weight:700;border-radius:10px;padding:3px 8px;flex:none;white-space:nowrap}
.ini-ap .sel.at{background:#FDE7E7;color:#C62828}.ini-ap .sel.hj{background:#FFF1DB;color:#8A5300}.ini-ap .sel.pr{background:#EEF2F0;color:var(--fraco)}
.ini-ap div{flex:1;min-width:0}.ini-ap small{display:block;color:var(--fraco);font-size:12px}
.ini-cust{display:flex;justify-content:space-between;align-items:flex-end;gap:8px}.ini-cust b{font-size:22px}.ini-cust .dir{text-align:right}.ini-cust .dir b{font-size:17px}.ini-cust span{font-size:12px;color:var(--fraco)}
.ini-fp>div{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:6px 0;border-top:1px dashed var(--linha);font-size:13.5px}.ini-fp>div:first-child{border-top:0}
.ini-fp>div span{color:var(--fraco);min-width:0}.ini-fp>div b{white-space:nowrap}.ini-fp em{font-style:normal;font-size:11.5px;background:#FFF1DB;color:#8A5300;border-radius:8px;padding:1px 6px}
.ini-fp .tot span{color:var(--texto);font-weight:600}.ini-fp .tot{border-top:1px solid var(--linha)}
.ini-fp .tot.fz{background:#E8F3EC;border:0;border-radius:10px;padding:9px 10px;margin-top:6px}.ini-fp .tot.fz b{font-size:19px;color:var(--verde-escuro)}
.ini-fed{display:block!important;background:#F6F8F7;border-radius:10px;padding:10px!important;border:0!important}
.ini-fed label{display:block;font-size:12.5px;color:var(--fraco);margin-bottom:8px}.ini-fed input,.ini-fed select{display:block;width:100%;margin-top:3px;border:1px solid #CFD8D3;border-radius:9px;padding:9px;font-size:15px;background:#fff}
.ini-fed .btn{padding:10px;font-size:14.5px;margin-bottom:6px}
.ini-fpc{font-size:13px;line-height:1.5;margin-top:10px;background:#F6F8F7;border-radius:10px;padding:8px 10px}.ini-fpc .dn{color:#C62828}.ini-fpc .up{color:#2F9E5B}
.chv-cab{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;padding:0;text-align:left;cursor:pointer;color:inherit;font:inherit;flex-wrap:wrap}
.chv-cab .t{font-size:14.5px;font-weight:700;color:var(--verde-escuro);flex:1 1 auto}.chv-cab .r{font-size:12.5px;color:#134A7C}.chv-cab i{font-style:normal;color:var(--verde);transition:transform .15s}
.chv.aberto .chv-cab{margin-bottom:10px}.chv.aberto .chv-cab i{transform:rotate(180deg)}
.chv-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.chv-chips span{font-size:12.5px;background:#E6F0FA;color:#134A7C;border-radius:12px;padding:4px 10px}
.chv-t{margin:14px 0 8px;font-size:14px;color:var(--verde-escuro)}
.chv-seg{display:flex;gap:4px;background:#EEF2F0;border-radius:10px;padding:3px;margin-bottom:8px}.chv-seg button{flex:1;border:0;background:none;font-size:12.5px;padding:7px 2px;border-radius:8px;color:var(--fraco);font-weight:600}
.chv-seg button.on{background:#fff;color:#134A7C;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.chv-mapa{position:relative;height:320px;border-radius:12px;overflow:hidden}.chv-cv{filter:blur(3px)}.chv-mapa #chvMapa{position:absolute;inset:0}
.chv-tit,.chv-dia{position:absolute;z-index:500;top:8px;background:rgba(10,40,25,.85);color:#fff;border-radius:8px;pointer-events:none}
.chv-tit{left:8px;font-size:11px;padding:4px 8px;line-height:1.3}.chv-dia{right:8px;font-weight:800;font-size:19px;padding:4px 10px}
.chv-esc{height:11px;border-radius:3px;margin-top:8px;background:linear-gradient(90deg,#BDBDBD,#9BE29B 8%,#2EAA3C 16%,#0B6B2B 24%,#1E3FD8 32%,#2E7BFF 40%,#8FD6FF 48%,#F7F3C2 56%,#FFB000 64%,#FF6A00 72%,#E31A1C 80%,#FFB3D9 88%,#8E5CFF)}
.chv-escx{display:flex;justify-content:space-between;font-size:10px;color:var(--fraco);margin-top:2px}
.chv-ctrl{display:flex;align-items:center;gap:10px;margin-top:8px}.chv-ctrl button{width:38px;height:38px;border-radius:50%;border:0;background:#134A7C;color:#fff;font-size:14px;flex:none}.chv-ctrl input{flex:1;accent-color:#134A7C}
.ini-al{display:flex;gap:9px;align-items:flex-start;font-size:13px;padding:7px 0;border-top:1px dashed var(--linha)}.ini-al:first-of-type{border-top:0}

.caixa.gr{padding:10px 12px 12px;margin-bottom:12px}
</style></head><body>

<div class="login" id="telaLogin">
  <div class="card">
    <h1>🌱 Acesso da fazenda</h1>
    <p>Entre com o login e a senha que o consultor passou para você.</p>
    <div class="campo"><label>Login</label><input id="lgLogin" autocomplete="username" autocapitalize="none" placeholder="ex.: fazenda.catarinense"></div>
    <div class="campo"><label>Senha</label><input id="lgSenha" type="password" autocomplete="current-password"></div>
    <button class="btn" id="lgEntrar">Entrar</button>
    <div class="msg" id="lgMsg"></div>
    <div class="rodape">AMVS Relatório · <a href="/termos">Termos de Uso</a></div>
  </div>
</div>

<div id="telaApp" class="oculto">
  <header class="topo"><div class="info"><h1 id="hNome">—</h1><p id="hSub">—</p></div><button id="btnSair">Sair</button></header>
  <div class="corpo">
    <div class="sel"><div class="campo" id="boxFaz"><label>Fazenda</label><select id="selFaz"></select></div>
      <div class="campo" id="boxSafra"><label>Safra</label><select id="selSafra"></select></div></div>
    <div id="faixa" class="faixa oculto"></div>
    <div id="conteudo"><div class="vazio">Carregando…</div></div>
    <div class="rodape">AMVS Relatório · <a href="/termos">Termos de Uso</a></div>
  </div>
</div>

<script>${AGRO_REL_JS}</script>
<script>${DPG_JS}</script>
<script>
(function () {
  var CH = 'amvs-portal', tok = '', eu = null, D = null, aba = 'inicio', filtro = 'fazer', mapas = [], modoMapa = 'var';
  var opAba = 'apl', opMapa = '*', selec = {}, apModo = 'ver';   // apModo: gerente vê a programação ou lança a aplicação
  var GR = { plantio: DPG.estado('p'), colh: DPG.estado('c') };   // gráficos da aba Plantio e da aba Colheita   // operador: aba, aplicação do mapa e talhões que ele marcou
  try { tok = localStorage.getItem(CH) || ''; } catch (e) {}
  var $ = function (s) { return document.querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function n(v, d) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function brl(v) { return 'R$ ' + n(v, 2); }
  function dataBR(i) { var p = String(i || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : '—'; }
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dif(a, b) { return Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 864e5); }
  function toast(m) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
  // total para o tanque: mL vira L e g vira kg (o operador mede em litro/quilo)
  function total(q, u) { var x = String(u || '').split('/')[0]; if (x === 'mL') return [q / 1000, 'L']; if (x === 'g') return [q / 1000, 'kg']; if (x === 't') return [q, 't']; return [q, x || 'L']; }

  var semRede = false;
  async function api(rota, corpo, extra) {
    var r;
    try {
      r = await fetch(rota, Object.assign({ method: corpo ? 'POST' : 'GET', headers: Object.assign({ Authorization: 'Bearer ' + tok }, corpo && !(corpo instanceof Blob) ? { 'Content-Type': 'application/json' } : {}, (extra && extra.headers) || {}),
        body: corpo ? (corpo instanceof Blob ? corpo : JSON.stringify(corpo)) : undefined }));
    } catch (e) { var er = new Error('Sem internet agora'); er.rede = true; throw er; }
    if (!corpo) semRede = r.headers.get('X-Portal-Cache') === '1';
    var j = null; try { j = await r.json(); } catch (e) {}
    if (r.status === 401 && rota !== '/api/portal/entrar') { sair(); throw new Error('Entre de novo'); }
    if (!r.ok) throw new Error((j && j.erro) || ('HTTP ' + r.status));
    return j;
  }
  function sair() {
    tok = ''; try { localStorage.removeItem(CH); } catch (e) {}
    try { caches.delete('amvs-portal-v1'); } catch (e) {}   // dados guardados para abrir sem internet
    $('#telaApp').classList.add('oculto'); $('#telaLogin').classList.remove('oculto');
  }

  $('#lgEntrar').onclick = async function () {
    var b = this; b.disabled = true; $('#lgMsg').textContent = '';
    try {
      var r = await api('/api/portal/entrar', { login: $('#lgLogin').value, senha: $('#lgSenha').value });
      tok = r.token; try { localStorage.setItem(CH, tok); } catch (e) {}
      $('#lgSenha').value = ''; await iniciar();
    } catch (e) { $('#lgMsg').textContent = e.message; }
    b.disabled = false;
  };
  $('#lgSenha').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#lgEntrar').click(); });
  $('#btnSair').onclick = async function () {
    var nf = (await filaTudo()).length;
    if (!confirm(nf ? 'Ainda há ' + nf + ' marcação(ões) esperando internet. Se sair, elas se perdem. Sair mesmo assim?' : 'Sair deste acesso?')) return;
    if (nf) await filaLimpar();
    sair();
  };

  async function iniciar() {
    eu = await api('/api/portal/eu');
    $('#telaLogin').classList.add('oculto'); $('#telaApp').classList.remove('oculto');
    $('#hSub').textContent = eu.papel_nome + ' · ' + eu.nome;
    var sf = $('#selFaz'), ult = ''; try { ult = localStorage.getItem(CH + ':faz') || ''; } catch (e) {}
    // produtor com mais de uma fazenda pode ver todas juntas
    var todas = eu.fazendas.length > 1;
    sf.innerHTML = (todas ? '<option value="*"' + (ult === '*' ? ' selected' : '') + '>Todas as fazendas</option>' : '') +
      eu.fazendas.map(function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === ult ? ' selected' : '') + '>' + esc(f.nome) + '</option>'; }).join('');
    $('#boxFaz').classList.toggle('oculto', eu.fazendas.length < 2);
    $('#boxSafra').classList.toggle('oculto', eu.papel === 'operador');
    if (!eu.fazendas.length) { $('#conteudo').innerHTML = '<div class="vazio">Nenhuma fazenda liberada para este acesso. Fale com o consultor.</div>'; return; }
    await carregar();
  }
  $('#selFaz').onchange = function () { try { localStorage.setItem(CH + ':faz', this.value); } catch (e) {} D = null; carregar(); };
  $('#selSafra').onchange = function () { carregar(this.value); };

  async function carregar(safra) {
    var fid = $('#selFaz').value;
    if (!D) $('#conteudo').innerHTML = '<div class="vazio">Carregando…</div>';
    DPG.limpar(GR.plantio); DPG.limpar(GR.colh);
    try { D = await api('/api/portal/fazenda?id=' + encodeURIComponent(fid) + (safra ? '&safra=' + encodeURIComponent(safra) : '')); }
    catch (e) { $('#conteudo').innerHTML = '<div class="vazio">' + esc(e.rede ? 'Sem internet e esta fazenda ainda não foi aberta neste celular. Abra uma vez com sinal para ela ficar guardada.' : e.message) + '</div>'; return; }
    await sobreporFila();
    $('#hNome').textContent = D.fazenda.nome;
    $('#selSafra').innerHTML = (D.safras.length ? D.safras : [D.safra]).map(function (s) { return '<option' + (s === D.safra ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
    pintar();
    faixa();
  }

  /* ---------- mapa (satélite + talhões) ---------- */
  var CORES = ['#2E7D32', '#F9A825', '#1565C0', '#C62828', '#6A1B9A', '#00838F', '#EF6C00', '#558B2F', '#AD1457', '#4E342E'];
  // etiqueta (opcional): o que vai escrito dentro do talhão; sem ela, só o nome
  function desenharMapa(el, estilo, rotulo, etiqueta) {
    if (!window.L || !D.mapa || !D.mapa.features || !D.mapa.features.length) { el.innerHTML = '<div class="vazio" style="border:0">Mapa da fazenda ainda não cadastrado (KML).</div>'; return null; }
    var m = L.map(el, { scrollWheelZoom: false });
    var esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
    L.tileLayer(esri + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, attribution: 'Imagens © Esri' }).addTo(m);
    var g = L.geoJSON(D.mapa);
    m.fitBounds(g.getBounds(), { padding: [16, 16], maxZoom: 17 });   // enquadra antes de desenhar
    L.geoJSON(D.mapa, {
      style: function (f) { return estilo((f.properties || {}).nome || ''); },
      onEachFeature: function (f, c) {
        var nm = (f.properties || {}).nome || '';
        c.bindPopup(rotulo(nm, f.properties || {}));
        var curto = D.todas ? nm.split(' · ').slice(1).join(' · ') || nm : nm;
        c.bindTooltip(etiqueta ? etiqueta(curto, f.properties || {}) : esc(curto), { permanent: true, direction: 'center', className: 'rot' });
      }
    }).addTo(m);
    mapas.push(m);
    return m;
  }
  function plantioDe(t) { return (D.plantio || []).filter(function (p) { return p.talhao === t; })[0] || null; }
  var NC = { soja: 'Soja', milho: 'Milho', algodao: 'Algodão', feijao: 'Feijão', sorgo: 'Sorgo', trigo: 'Trigo', pastagem: 'Pastagem', pousio: 'Pousio', outra: 'Outra' };

  function vistaMapas() {
    var vars = {}, haVar = {}, i = 0, areas = {};
    ((D.mapa && D.mapa.features) || []).forEach(function (f) { var q = f.properties || {}; if (q.nome) areas[q.nome] = Number(q.area_ha) || 0; });
    (D.plantio || []).forEach(function (p) {
      var pts = p.partes && p.partes.length ? p.partes.map(function (x) { return [x.variedade, x.ha]; }) : [[p.variedade || (p.cultura ? NC[p.cultura] || p.cultura : ''), areas[p.talhao] || 0]];
      pts.forEach(function (x) { var k = x[0]; if (!k) return; if (!vars[k]) vars[k] = CORES[i++ % CORES.length]; haVar[k] = (haVar[k] || 0) + x[1]; });
    });
    var h = '<div class="tg"><button data-mm="var" class="' + (modoMapa === 'var' ? 'on' : '') + '">Variedade</button><button data-mm="area" class="' + (modoMapa === 'area' ? 'on' : '') + '">Áreas</button></div>' +
      '<div class="mapa-sat" id="mapaFaz"></div>';
    if (modoMapa === 'var') h += '<div class="leg">' + (Object.keys(vars).length ? Object.keys(vars).map(function (k) { return '<span><i style="background:' + vars[k] + '"></i>' + esc(k) + (haVar[k] ? ' · ' + n(haVar[k], 1) + ' ha' : '') + '</span>'; }).join('') + '<span><i style="background:#9AA5A0"></i>sem plantio</span>' : '<span>Plantio ainda não informado.</span>') + '</div>';
    else {
      var tot = Object.keys(areas).reduce(function (s, k) { return s + areas[k]; }, 0);
      h += '<div class="leg"><span><b>Área total: ' + n(tot, 1) + ' ha</b> · ' + Object.keys(areas).length + ' talhões</span></div>';
    }
    $('#conteudo').innerHTML = abas() + h;
    document.querySelectorAll('[data-mm]').forEach(function (b) { b.onclick = function () { modoMapa = b.dataset.mm; pintar(); }; });
    var divididos = {}; (D.mapaPartes || []).forEach(function (x) { divididos[x.properties.talhao] = 1; });
    var mm = desenharMapa($('#mapaFaz'), function (nm) {
      if (modoMapa === 'area') return { color: '#FFFFFF', weight: 2, fillColor: '#2FA05A', fillOpacity: 0.22 };
      if (divididos[nm]) return { color: '#FFFFFF', weight: 2, fillOpacity: 0 };   // as partes coloridas vão por baixo
      var p = plantioDe(nm), k = p ? (p.variedade || NC[p.cultura] || p.cultura) : '';
      return { color: '#FFFFFF', weight: 2, fillColor: vars[k] || '#9AA5A0', fillOpacity: 0.55 };
    }, function (nm, q) {
      var p = plantioDe(nm);
      return '<b>' + esc(nm) + '</b>' + (q.area_ha ? '<br>' + n(q.area_ha, 1) + ' ha' : '') +
        (p ? '<br>' + esc(NC[p.cultura] || p.cultura || '') + (p.partes && p.partes.length ? '<br>' + p.partes.map(function (x) { return esc(x.variedade) + ' · ' + n(x.ha, 1) + ' ha'; }).join('<br>') : p.variedade ? ' · ' + esc(p.variedade) : '') + (p.data_plantio ? '<br>plantio ' + dataBR(p.data_plantio) : '') : '');
    }, modoMapa === 'area' ? function (nm, q) { return esc(nm) + (q.area_ha ? '<small>' + n(q.area_ha, 1) + ' ha</small>' : ''); } : null);
    // talhão com mais de uma variedade: cada parte na cor da variedade, na proporção da área
    if (mm && modoMapa === 'var' && (D.mapaPartes || []).length) {
      L.geoJSON({ type: 'FeatureCollection', features: D.mapaPartes }, { interactive: false,
        style: function (f) { return { color: '#FFFFFF', weight: 1, dashArray: '4 3', fillColor: vars[f.properties.variedade] || '#9AA5A0', fillOpacity: 0.55 }; }
      }).addTo(mm).bringToBack();
    }
  }

  /* ---------- Início: tempo na fazenda, mercado e resumo da safra (dono/gerente) ---------- */
  var INI = { chave: '', dados: null, carregando: false, erro: '', loc: '' };
  function iniChave() { var f = $('#selFaz').value; return f + '|' + (f === '*' ? INI.loc : ''); }
  function iniCarregar() {
    var k = iniChave();
    if (INI.carregando || INI.chave === k) return;
    INI.carregando = true; INI.erro = '';
    var f = $('#selFaz').value;
    api('/api/portal/inicio?id=' + encodeURIComponent(f) + (f === '*' && INI.loc ? '&loc=' + encodeURIComponent(INI.loc) : ''))
      .then(function (r) { INI.dados = r; INI.chave = k; })
      .catch(function (e) { INI.erro = e.message; INI.chave = k; INI.dados = null; })
      .then(function () { INI.carregando = false; if (D && (eu.papel === 'operador' ? opAba === 'apl' : aba === 'inicio')) pintar(); });
  }
  var DIAS_S = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  function diaSem(iso) { return DIAS_S[new Date(iso + 'T12:00:00Z').getUTCDay()]; }
  function linhaMini(l, cor) {
    if (!l || l.length < 2) return '';
    var mn = Math.min.apply(null, l), mx = Math.max.apply(null, l), rg = mx - mn || 1;
    return '<svg viewBox="0 0 100 26" preserveAspectRatio="none"><polyline fill="none" stroke="' + cor + '" stroke-width="2" vector-effect="non-scaling-stroke" points="' +
      l.map(function (v, i) { return (i / (l.length - 1) * 100).toFixed(1) + ',' + (23 - (v - mn) / rg * 20).toFixed(1); }).join(' ') + '"/></svg>';
  }
  function varTxt(v) { return v == null ? '' : '<em class="' + (v > 0 ? 'up' : v < 0 ? 'dn' : '') + '">' + (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '') + n(Math.abs(v), 1) + '%</em>'; }
  // cartão do tempo (Início e operador)
  function cartaoClima(compacto) {
    var I = INI.dados, c = I && I.clima;
    var sel = '';
    if (D && D.todas && eu.fazendas.length > 1) {
      sel = '<select id="iniLoc" aria-label="Fazenda do tempo">' + eu.fazendas.map(function (f) {
        return '<option value="' + esc(f.id) + '"' + (I && I.fazenda && I.fazenda.id === f.id ? ' selected' : '') + '>' + esc(f.nome) + '</option>'; }).join('') + '</select>';
    }
    var h = '<div class="ini-card clima"><div class="ini-ct"><h3>🌦️ Tempo ' + (I && I.fazenda && !sel ? 'na fazenda' : 'em') + '</h3>' + (sel || '<span>' + (c && c.agora ? 'agora ' + esc(c.agora.hora) : '') + '</span>') + '</div>';
    if (INI.carregando && !I) return h + '<div class="ini-vz">Carregando a previsão…</div></div>';
    if (!I || !I.local) return h + '<div class="ini-vz">' + (INI.erro ? esc(INI.erro) : 'Para ver o tempo, o consultor precisa cadastrar o mapa (KML) ou o município da fazenda.') + '</div></div>';
    if (!c || c.erro) return h + '<div class="ini-vz">' + esc((c && c.erro) || 'Previsão do tempo indisponível agora.') + '</div></div>';
    var a = c.agora;
    h += '<div class="ini-agora"><div class="ic">' + a.ic + '</div><div class="t">' + a.temp + '°</div><div class="d">' + esc(a.txt) + '<br>💧 ' + a.umid + '% · 🌬️ ' + a.vento + ' km/h' + (a.prob != null ? ' · ☔ ' + a.prob + '%' : '') + '</div></div>';
    h += '<div class="ini-dias">' + c.dias.map(function (d, i) {
      return '<div><span>' + (i === 0 ? 'hoje' : diaSem(d.d)) + '</span><i>' + d.ic + '</i><b>' + d.max + '°</b><small>' + d.min + '°</small><u>' + (d.mm >= 1 ? n(d.mm) + ' mm' : d.prob >= 40 ? d.prob + '%' : '0') + '</u></div>'; }).join('') + '</div>';
    var j = c.janela;
    if (j && j.horas.length) {
      h += '<div class="ini-jan"><span class="tr">🚜</span><div class="bar"><b>Pulverização ' + (j.hoje ? 'hoje' : 'amanhã') + ':</b> ' +
        (j.melhor ? 'boa das ' + ('0' + j.melhor.de).slice(-2) + 'h às ' + ('0' + j.melhor.ate).slice(-2) + 'h' : 'sem horário bom') +
        '<div class="hrs">' + j.horas.map(function (x) { return '<u class="' + x.st + '" title="' + x.h + 'h · vento ' + x.vento + ' km/h · ' + x.temp + '° · umid. ' + x.umid + '% · chuva ' + x.prob + '%"></u>'; }).join('') + '</div>' +
        '<div class="hx"><span>' + j.horas[0].h + 'h</span><span>' + j.horas[Math.floor(j.horas.length / 2)].h + 'h</span><span>' + j.horas[j.horas.length - 1].h + 'h</span></div>' +
        (compacto ? '' : '<small>verde = vento ' + c.limites.ventoMin + '–' + c.limites.vento + ' km/h, até ' + c.limites.temp + '°, umidade ' + c.limites.umid + '%+, sem chuva</small>') + '</div></div>';
    }
    if (I.local.fonte === 'municipio' && !compacto) h += '<div class="ini-pe">Local pelo município (' + esc(I.fazenda.municipio) + '). Com o mapa da fazenda fica mais preciso.</div>';
    return h + '</div>';
  }
  function cartaoMercado() {
    var m = INI.dados && INI.dados.mercado;
    var h = '<div class="ini-card"><div class="ini-ct"><h3>📈 Mercado</h3><span>' + (m && m.soja ? 'fechamento ' + dataBR(m.soja.em) : '') + '</span></div>';
    if (INI.carregando && !INI.dados) return h + '<div class="ini-vz">Carregando…</div></div>';
    if (!m) return h + '<div class="ini-vz">Cotações indisponíveis agora.</div></div>';
    function caixa(ic, tit, x, pre, suf, casas, sub) {
      if (!x) return '';
      var cor = x.var > 0 ? '#2F9E5B' : x.var < 0 ? '#C62828' : '#6B7B72';
      return '<div class="ini-m"><small>' + ic + ' ' + tit + '</small><b>' + pre + n(x.preco, casas) + (suf ? '<span>' + suf + '</span>' : '') + '</b>' + varTxt(x.var) +
        (sub ? '<small class="ini-pr">' + sub + '</small>' : '') + linhaMini(x.serie, cor) + '</div>';
    }
    h += '<div class="ini-mk">' + caixa('💵', 'Dólar', m.dolar, 'R$ ', '', 2) +
      caixa('🌱', 'Soja · sc 60 kg', m.soja, 'R$ ', '', 2, m.soja ? '📍 ' + esc(m.soja.praca) + (m.soja.km > 15 ? ' · ' + m.soja.km + ' km' : '') : '') +
      caixa('🌽', 'Milho · sc 60 kg', m.milho, 'R$ ', '', 2, m.milho ? '📍 ' + esc(m.milho.praca) + (m.milho.km > 15 ? ' · ' + m.milho.km + ' km' : '') : '') +
      caixa('🏛️', 'Soja Chicago', m.cbot_soja, 'US$ ', '/bu', 2) + caixa('🏛️', 'Milho Chicago', m.cbot_milho, 'US$ ', '/bu', 2) + '</div>';
    if (!m.soja && !m.milho) h += '<div class="ini-pe">Preço da praça aparece quando a fazenda tiver mapa (KML) ou município cadastrado.</div>';
    return h + '<div class="ini-pe">' + esc(m.fonte) + '. Praça mais perto da fazenda.</div></div>';
  }
  // formação do preço da soja: Chicago + prêmio do porto × dólar − frete = valor na fazenda
  var FRETE_ED = false;
  function cartaoFormacao() {
    var m = INI.dados && INI.dados.mercado, F = m && m.formacao;
    if (!F) return '';
    var sinal = function (v, c) { return (v >= 0 ? '+ ' : '− ') + n(Math.abs(v), c); };
    var h = '<div class="ini-card"><div class="ini-ct"><h3>🧮 Preço da soja: da bolsa à fazenda</h3><span>' + dataBR(F.porto.em) + '</span></div><div class="ini-fp">' +
      '<div><span>🏛️ Chicago</span><b>US$ ' + n(F.cbot, 2) + '/bu</b></div>' +
      '<div><span>⚓ Prêmio no porto (' + esc(F.porto.nome) + ')</span><b>' + sinal(F.premio, 2) + ' US$/bu</b></div>' +
      '<div><span>💵 Dólar</span><b>× R$ ' + n(F.dolar, 2) + '</b></div>' +
      '<div class="tot"><span>= Preço no porto de ' + esc(F.porto.nome) + '</span><b>R$ ' + n(F.porto.preco, 2) + '/sc</b></div>' +
      '<div><span>🚛 Frete até o porto · R$ ' + n(F.frete.rt) + '/t' + (F.frete.estimado ? ' <em>estimado ~' + n(F.frete.km) + ' km</em>' : '') +
        ' <button class="ini-lk" id="fpEd">' + (FRETE_ED ? 'fechar' : 'alterar') + '</button></span><b>− R$ ' + n(F.frete.sc, 2) + '/sc</b></div>';
    if (FRETE_ED) {
      h += '<div class="ini-fed"><label>Frete real (R$ por tonelada)<input id="fpRt" inputmode="decimal" placeholder="ex.: ' + n(F.frete.rt_estimado) + '" value="' + (F.frete.estimado ? '' : n(F.frete.rt, 2)) + '"></label>' +
        '<label>Porto<select id="fpPorto">' + F.portos.map(function (p) { return '<option' + (p === F.porto.nome ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select></label>' +
        '<button class="btn" id="fpSalva">Salvar frete</button>' + (F.frete.estimado ? '' : '<button class="ini-lk" id="fpEst">voltar ao estimado (R$ ' + n(F.frete.rt_estimado) + '/t)</button>') + '</div>';
    }
    h += '<div class="tot fz"><span>= Valor da soja na fazenda</span><b>R$ ' + n(F.fazenda, 2) + '/sc</b></div></div>';
    if (F.praca) {
      var d = F.praca.dif;
      h += '<div class="ini-fpc">📍 Na praça de <b>' + esc(F.praca.nome) + '</b> hoje: <b>R$ ' + n(F.praca.preco, 2) + '/sc</b> · ' +
        (Math.abs(d) < 0.5 ? 'igual ao valor calculado' : '<b class="' + (d < 0 ? 'dn' : 'up') + '">R$ ' + n(Math.abs(d), 2) + (d < 0 ? ' abaixo' : ' acima') + '</b> do valor calculado') +
        '<br>Base local: <b>' + sinal(F.praca.base, 2) + ' US$/bu</b> sobre Chicago</div>';
    }
    return h + '<div class="ini-pe">1 saca = 60 kg = 2,2046 bushels · 1 t = 16,67 sacas. O prêmio sai do preço do porto do dia. ' +
      (F.frete.estimado ? 'Frete estimado pela distância (~R$ 0,16 por t·km): toque em "alterar" e coloque o frete real.' : 'Frete informado' + (F.frete.por ? ' por ' + esc(F.frete.por) : '') + (F.frete.em ? ' em ' + dataBR(F.frete.em) : '') + '.') + '</div></div>';
  }
  function ligarFormacao() {
    var ed = document.getElementById('fpEd'); if (ed) ed.onclick = function () { FRETE_ED = !FRETE_ED; pintar(); };
    var sv = document.getElementById('fpSalva'), es = document.getElementById('fpEst');
    function salvar(rt) {
      var fid = INI.dados && INI.dados.fazenda && INI.dados.fazenda.id;
      api('/api/portal/frete', { id: fid, rt: rt, porto: document.getElementById('fpPorto').value })
        .then(function () { toast('Frete salvo'); FRETE_ED = false; INI.chave = ''; iniCarregar(); })
        .catch(function (e) { toast(e.message); });
    }
    if (sv) sv.onclick = function () { var v = document.getElementById('fpRt').value.trim(); if (!v) { toast('Informe o frete em R$ por tonelada'); return; } salvar(v); };
    if (es) es.onclick = function () { salvar(''); };
  }

  /* ---------- chuva dos próximos 30 dias + mapa da chuva (dono/gerente; atualiza no domingo à noite) ---------- */
  var CHV = { chave: '', dados: null, carregando: false, aberto: false, modo: 'dia', dia: 0, play: null, mapa: null, canvas: null };
  function chvCarregar() {
    var k = iniChave();
    if (CHV.carregando || CHV.chave === k) return;
    CHV.carregando = true;
    var f = $('#selFaz').value;
    api('/api/portal/chuva?id=' + encodeURIComponent(f) + (f === '*' && INI.loc ? '&loc=' + encodeURIComponent(INI.loc) : ''))
      .then(function (r) { CHV.dados = r; }).catch(function () { CHV.dados = null; })
      .then(function () { CHV.chave = k; CHV.carregando = false; if (D && aba === 'inicio') pintar(); });
  }
  var ESC_CHUVA = [[1, [189, 189, 189]], [5, [155, 226, 155]], [10, [46, 170, 60]], [13, [11, 107, 43]], [17, [30, 63, 216]], [20, [46, 123, 255]], [30, [143, 214, 255]],
    [40, [247, 243, 194]], [50, [255, 176, 0]], [70, [255, 106, 0]], [120, [227, 26, 28]], [180, [255, 179, 217]], [270, [142, 92, 255]]];
  function corChuva(v) {
    if (v < 1) return null;
    for (var i = 1; i < ESC_CHUVA.length; i++) if (v <= ESC_CHUVA[i][0]) {
      var t = (v - ESC_CHUVA[i - 1][0]) / (ESC_CHUVA[i][0] - ESC_CHUVA[i - 1][0]);
      return ESC_CHUVA[i - 1][1].map(function (c, j) { return Math.round(c + (ESC_CHUVA[i][1][j] - c) * t); });
    }
    return ESC_CHUVA[ESC_CHUVA.length - 1][1];
  }
  function cartaoChuva() {
    chvCarregar();
    var C = CHV.dados, P = C && C.ponto;
    if (!C || C.erro === 'sem local') return '';
    if (!P) return CHV.carregando ? '<div class="ini-card"><div class="ini-ct"><h3>🌧️ Chuva nos próximos 30 dias</h3></div><div class="ini-vz">Carregando…</div></div>' : '';
    var prov = P.dias.filter(function (x) { return x.p1 >= 70; }).length, prox = P.dias.filter(function (x) { return x.p5 >= 50; })[0];
    var h = '<div class="ini-card chv' + (CHV.aberto ? ' aberto' : '') + '"><button class="chv-cab" id="chvAbre" aria-expanded="' + CHV.aberto + '"><span class="t">🌧️ Chuva nos próximos 30 dias</span>' +
      '<span class="r"><b>~' + n(P.acc[1]) + ' mm</b> · ' + prov + ' dias de chuva provável</span><i>▾</i></button>';
    if (!CHV.aberto) return h + '</div>';
    h += '<div class="chv-chips"><span>Acumulado 30 dias: <b>~' + n(P.acc[1]) + ' mm</b> (' + n(P.acc[0]) + ' a ' + n(P.acc[2]) + ')</span><span>' + prov + ' dias com chuva provável</span>' +
      (prox ? '<span>1ª chuva ≥ 5 mm: <b>' + dataBR(prox.d) + '</b> (' + prox.p5 + '%)</span>' : '<span>sem chuva ≥ 5 mm provável</span>') + '</div>';
    var M = C.mapa;
    if (M && M.v && M.v.length) {
      h += '<h4 class="chv-t">🗺️ Mapa da chuva</h4><div class="chv-seg">' + [['dia', 'Dia a dia'], ['a7', '7 dias'], ['a15', '15 dias']].map(function (x) {
        return '<button data-chvm="' + x[0] + '" class="' + (CHV.modo === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
        '<div class="chv-mapa"><div id="chvMapa"></div><div class="chv-tit" id="chvTit"></div><div class="chv-dia" id="chvDia"></div></div>' +
        '<div class="chv-esc"></div><div class="chv-escx"><span>&lt;1</span><span>5</span><span>10</span><span>20</span><span>40</span><span>70</span><span>120</span><span>180</span><span>270+ mm</span></div>' +
        '<div class="chv-ctrl' + (CHV.modo === 'dia' ? '' : ' oculto') + '" id="chvCtrl"><button id="chvPlay" aria-label="Animar">▶</button><input type="range" id="chvSl" min="0" max="' + (M.v.length - 1) + '" value="' + CHV.dia + '"></div>';
    }
    var em = new Date(P.gerado_em);
    return h + '<div class="ini-pe">Atualizado ' + em.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · próxima atualização domingo ' + dataBR(C.proxima) + ' à noite.</div></div>';
  }
  // camada da chuva: canvas no mapa (projeção do mapa), bordas que somem, textura de nuvem que anda com o tempo
  var CanvasCamada = window.L && L.ImageOverlay.extend({
    _initImage: function () {
      var el = this._image = this._url;
      L.DomUtil.addClass(el, 'leaflet-image-layer');
      if (this._zoomAnimated) L.DomUtil.addClass(el, 'leaflet-zoom-animated');
      el.onselectstart = L.Util.falseFn; el.onmousemove = L.Util.falseFn;
    }
  });
  var RUIDO = (function () { var a = [], s = 7; for (var i = 0; i < 64 * 64; i++) { s = (s * 16807) % 2147483647; a.push(s / 2147483647); } return a; })();
  function ruido(x, y) {
    var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    function r(i, j) { return RUIDO[((j & 63) * 64) + (i & 63)]; }
    return r(x0, y0) * (1 - fx) * (1 - fy) + r(x0 + 1, y0) * fx * (1 - fy) + r(x0, y0 + 1) * (1 - fx) * fy + r(x0 + 1, y0 + 1) * fx * fy;
  }
  function merc(la) { var r = la * Math.PI / 180; return Math.log(Math.tan(Math.PI / 4 + r / 2)); }
  function chvDesenhar(t) {
    var M = CHV.dados && CHV.dados.mapa, cv = CHV.canvas; if (!M || !cv) return;
    var np = M.nlat * M.nlon, G = new Array(np), i, d;
    if (CHV.modo === 'dia') {
      var d0 = Math.floor(t), d1 = Math.min(M.v.length - 1, d0 + 1), f = t - d0;
      for (i = 0; i < np; i++) G[i] = (M.v[d0][i] || 0) * (1 - f) + (M.v[d1][i] || 0) * f;
    } else {
      var nd = Math.min(M.v.length, CHV.modo === 'a7' ? 7 : 15);
      for (i = 0; i < np; i++) { var s = 0; for (d = 0; d < nd; d++) s += M.v[d][i] || 0; G[i] = s; }
    }
    var cw = cv.width, ch = cv.height, cx = cv.getContext('2d'), im = cx.createImageData(cw, ch);
    var m1 = merc(M.la1), m0 = merc(M.la0), dx = CHV.modo === 'dia' ? t * 2.2 : 0, dy = CHV.modo === 'dia' ? -t * 1.3 : 0;
    function g(a, b) { a = a < 0 ? 0 : a > M.nlat - 1 ? M.nlat - 1 : a; b = b < 0 ? 0 : b > M.nlon - 1 ? M.nlon - 1 : b; return G[a * M.nlon + b]; }
    for (var y = 0; y < ch; y++) {
      var la = Math.atan(Math.sinh(m1 - (y + 0.5) / ch * (m1 - m0))) * 180 / Math.PI;   // linha da tela → latitude (Mercator)
      var fa = (M.la1 - la) / M.passo, a0 = Math.floor(fa), ta = fa - a0;
      var ey = Math.min(y, ch - 1 - y) / (ch * 0.12);
      for (var x = 0; x < cw; x++) {
        var fb = (x + 0.5) / cw * (M.nlon - 1), b0 = Math.floor(fb), tb = fb - b0;
        var v = g(a0, b0) * (1 - ta) * (1 - tb) + g(a0 + 1, b0) * ta * (1 - tb) + g(a0, b0 + 1) * (1 - ta) * tb + g(a0 + 1, b0 + 1) * ta * tb;
        if (v < 1) continue;
        var nz = 0.65 * ruido(x / 9 + dx, y / 9 + dy) + 0.35 * ruido(x / 4 - dx * 1.6, y / 4 + dy * 1.4);   // nuvem: duas escalas
        var vv = v * (CHV.modo === 'dia' ? 0.7 + 0.6 * nz : 0.94 + 0.12 * nz), c = corChuva(vv);   // no acumulado a textura quase não mexe no valor
        if (!c) continue;
        var ex = Math.min(x, cw - 1 - x) / (cw * 0.12), borda = Math.min(1, ex, ey);   // bordas somem aos poucos
        var al = Math.min(1, (vv - 1) / 7) * (0.55 + 0.45 * nz) * borda * borda * 215;
        var o = (y * cw + x) * 4; im.data[o] = c[0]; im.data[o + 1] = c[1]; im.data[o + 2] = c[2]; im.data[o + 3] = al;
      }
    }
    cx.putImageData(im, 0, 0);
    var di = Math.min(M.v.length - 1, Math.round(t)), nd2 = Math.min(M.v.length, CHV.modo === 'a7' ? 7 : 15);
    $('#chvTit').innerHTML = CHV.modo === 'dia' ? 'Chuva prevista<br>no dia (mm)' : 'Acumulado<br>' + dataBR(M.datas[0]) + ' a ' + dataBR(M.datas[nd2 - 1]);
    $('#chvDia').textContent = CHV.modo === 'dia' ? dataBR(M.datas[di]) : (CHV.modo === 'a7' ? '7 dias' : '15 dias');
  }
  function chvParar() { if (CHV.play) { cancelAnimationFrame(CHV.play); CHV.play = null; } var pl = document.getElementById('chvPlay'); if (pl) pl.textContent = '▶'; }
  function ligarChuva() {
    var ab = document.getElementById('chvAbre');
    if (ab) ab.onclick = function () { CHV.aberto = !CHV.aberto; chvParar(); pintar(); };
    chvParar();
    CHV.mapa = null; CHV.canvas = null;
    var el = document.getElementById('chvMapa');
    if (!el || !window.L || !CanvasCamada) return;
    var P = CHV.dados.ponto, M = CHV.dados.mapa;
    CHV.mapa = L.map(el, { zoomControl: false, attributionControl: false, scrollWheelZoom: false }).setView([P.lat || -14, P.lon || -54], 4);
    mapas.push(CHV.mapa);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 10 }).addTo(CHV.mapa);
    CHV.canvas = document.createElement('canvas'); CHV.canvas.width = 220; CHV.canvas.height = 240; CHV.canvas.className = 'chv-cv';
    new CanvasCamada(CHV.canvas, [[M.la0, M.lo0], [M.la1, M.lo1]], { interactive: false }).addTo(CHV.mapa);
    if (P.lat) L.circleMarker([P.lat, P.lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#C62828', fillOpacity: 1 }).addTo(CHV.mapa).bindTooltip(esc(CHV.dados.fazenda.nome));
    chvDesenhar(CHV.dia);
    document.querySelectorAll('[data-chvm]').forEach(function (b) { b.onclick = function () {
      CHV.modo = b.dataset.chvm; chvParar();
      document.querySelectorAll('[data-chvm]').forEach(function (x) { x.classList.toggle('on', x === b); });
      $('#chvCtrl').classList.toggle('oculto', CHV.modo !== 'dia');
      chvDesenhar(CHV.dia);
    }; });
    var sl = document.getElementById('chvSl'), pl = document.getElementById('chvPlay');
    if (sl) sl.oninput = function () { chvParar(); CHV.dia = Number(sl.value); chvDesenhar(CHV.dia); };
    // ▶: um dia vira o outro aos poucos (~1,4 s por dia), como a chuva andando
    if (pl) pl.onclick = function () {
      if (CHV.play) { chvParar(); return; }
      pl.textContent = '❚❚';
      var ult = 0, n = M.v.length;
      function passo(ts) {
        if (!document.getElementById('chvSl')) { CHV.play = null; return; }
        if (ts - ult > 50) {
          CHV.dia = ult ? CHV.dia + (ts - ult) / 1400 : CHV.dia; ult = ts;
          if (CHV.dia > n - 1) CHV.dia = 0;
          sl.value = Math.floor(CHV.dia); chvDesenhar(CHV.dia);
        }
        CHV.play = requestAnimationFrame(passo);
      }
      CHV.play = requestAnimationFrame(passo);
    };
  }

  function resumoAplic() {
    var hj = hoje(), sem = somaDias(hj, 7), l = [];
    (D.aplicacoes || []).forEach(function (a) {
      if (a.status === 'aplicada') return;
      l.push({ a: a, d: a.data || '', pend: a.tal.filter(function (t) { return !t.feito; }) });
    });
    l.sort(function (x, y) { return (x.d || '9') < (y.d || '9') ? -1 : 1; });
    var at = l.filter(function (x) { return x.d && x.d < hj; }).length, ho = l.filter(function (x) { return x.d === hj; }).length,
      se = l.filter(function (x) { return x.d > hj && x.d <= sem; }).length;
    var feitos = 0, haF = 0, ini7 = somaDias(hj, -6);
    (D.aplicacoes || []).forEach(function (a) { a.tal.forEach(function (t) { if (t.feito && t.feito >= ini7 && t.feito <= hj) { feitos++; haF += t.ha; } }); });
    return { lista: l, at: at, ho: ho, se: se, feitos: feitos, haF: haF };
  }
  function chuvaNo(d) {
    var c = INI.dados && INI.dados.clima, x = c && c.dias ? c.dias.filter(function (y) { return y.d === d; })[0] : null;
    return x && (x.mm >= 5 || x.prob >= 60) ? x : null;
  }
  function vistaInicio() {
    iniCarregar();
    var g = D.graf || {}, hj = hoje();
    var pl = (g.linha || []).reduce(function (s, x) { return s + x.ha; }, 0), pc = g.total_ha ? pl / g.total_ha * 100 : 0;
    var plHoje = (g.linha || []).filter(function (x) { return x.d === hj; }).reduce(function (s, x) { return s + x.ha; }, 0);
    var nd = (g.linha || []).length;
    var nome = D.todas ? 'Todas as fazendas' : D.fazenda.nome;
    var hr = new Date().getHours(), sau = hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
    var dt = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    var h = abas() + '<div class="ini-ola"><b>' + sau + ' 👋</b>' + esc(nome) + ' · ' + esc(dt) + ' · safra ' + esc(D.safra || '') + '</div>';
    h += cartaoClima(false) + cartaoChuva() + cartaoMercado() + cartaoFormacao();
    // plantio e colheita
    var pv = (g.prev || []), prox = pv.filter(function (x) { return !x.col && x.d >= hj; }).map(function (x) { return x.d; }).sort()[0];
    var semanas = {}; pv.forEach(function (x) { var dd = new Date(x.d + 'T12:00:00Z'); dd.setUTCDate(dd.getUTCDate() - ((dd.getUTCDay() + 6) % 7)); var k = dd.toISOString().slice(0, 10); semanas[k] = (semanas[k] || 0) + x.ha; });
    var pico = Object.keys(semanas).sort(function (a, b) { return semanas[b] - semanas[a]; })[0];
    var totPv = pv.reduce(function (s, x) { return s + x.ha; }, 0);
    h += '<div class="ini-k2"><div class="ini-card"><div class="ini-ct"><h3>🌱 Plantio</h3></div>' +
      (g.total_ha ? '<div class="ini-anel"><svg width="58" height="58" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9" fill="none" stroke="#E1E7E3" stroke-width="4"/>' +
        '<circle cx="18" cy="18" r="15.9" fill="none" stroke="#1B7A43" stroke-width="4" stroke-dasharray="' + Math.min(100, pc).toFixed(1) + ' 100" stroke-linecap="round" transform="rotate(-90 18 18)"/>' +
        '<text x="18" y="21" text-anchor="middle" font-size="8.5" font-weight="700" fill="#146034">' + Math.round(pc) + '%</text></svg><div><b>' + n(pl) + ' ha</b><span>de ' + n(g.total_ha) + ' ha</span></div></div>' +
        '<div class="ini-mini">' + (plHoje ? 'hoje <b>+' + n(plHoje, 1) + ' ha</b> · ' : '') + (nd ? 'média <b>' + n(pl / nd) + ' ha/dia</b>' : 'sem plantio lançado') + '</div>'
        : '<div class="ini-vz">Sem área cadastrada.</div>') + '</div>' +
      '<div class="ini-card"><div class="ini-ct"><h3>🚜 Colheita</h3></div>' +
      (prox ? '<div class="ini-anel"><div class="cal-ic"><small>' + MESES[Number(prox.slice(5, 7)) - 1].slice(0, 3) + '</small>' + Number(prox.slice(8, 10)) + '</div><div><b>' + dataBR(prox) + '</b><span>' +
        (dif(prox, hj) === 0 ? 'hoje' : 'em ' + dif(prox, hj) + ' dias') + '</span></div></div><div class="ini-mini">' + (pico ? 'pico <b>' + dataBR(pico) + '–' + dataBR(somaDias(pico, 6)) + '</b> · ' : '') + n(totPv) + ' ha previstos</div>'
        : '<div class="ini-vz">' + (pv.length ? 'Colheita prevista já passou.' : 'Aparece quando houver plantio lançado.') + '</div>') + '</div></div>';
    // aplicações
    var R = resumoAplic();
    h += '<div class="ini-card"><div class="ini-ct"><h3>💧 Aplicações</h3><button class="ini-lk" data-ir="apl">ver todas ›</button></div>' +
      '<div class="ini-cont"><div class="at"><b>' + R.at + '</b><span>atrasadas</span></div><div class="hj"><b>' + R.ho + '</b><span>hoje</span></div><div class="se"><b>' + R.se + '</b><span>próx. 7 dias</span></div></div>' +
      (R.lista.length ? R.lista.slice(0, 3).map(function (x) {
        var d = x.d, cls = !d ? 'pr' : d < hj ? 'at' : d === hj ? 'hj' : 'pr', tx = !d ? 'sem data' : d < hj ? 'atrasada ' + dif(hj, d) + ' d' : d === hj ? 'hoje' : diaSem(d) + ' ' + dataBR(d);
        var ha = x.pend.reduce(function (s, t) { return s + Math.max(0, t.ha - (t.feitoHa || 0)); }, 0), ch = d && d >= hj ? chuvaNo(d) : null;
        return '<div class="ini-ap"><span class="sel ' + cls + '">' + tx + '</span><div><b>' + esc(x.a.titulo) + '</b><small>' + (D.todas && x.a.fazenda ? esc(x.a.fazenda) + ' · ' : '') +
          esc(x.pend.slice(0, 4).map(function (t) { return t.nome; }).join(', ') + (x.pend.length > 4 ? '…' : '')) + ' · ' + n(ha) + ' ha' + (ch ? ' · ⚠️ chuva ' + (ch.mm >= 1 ? n(ch.mm) + ' mm' : ch.prob + '%') : '') + '</small></div></div>';
      }).join('') : '<div class="ini-vz">Nenhuma aplicação pendente. 👍</div>') +
      '<div class="ini-mini">Últimos 7 dias: <b>' + R.feitos + (R.feitos === 1 ? ' talhão' : ' talhões') + '</b> aplicados · <b>' + n(R.haF) + ' ha</b></div></div>';
    // custo
    var ct = D.custo && D.custo.talhoes ? D.custo.talhoes : [], cT = 0, cHa = 0;
    ct.forEach(function (t) { if (t.custo) { cT += t.custo; cHa += t.ha; } });
    var soja = INI.dados && INI.dados.mercado && INI.dados.mercado.soja;
    if (cT) {
      h += '<div class="ini-card"><div class="ini-ct"><h3>💰 Custo da safra</h3><button class="ini-lk" data-ir="est">detalhes ›</button></div>' +
        '<div class="ini-cust"><div><b>R$ ' + n(cT / (cHa || 1)) + '</b><span> /ha</span><br><span>R$ ' + (cT >= 1e6 ? n(cT / 1e6, 2) + ' mi' : n(cT)) + ' em produtos aplicados</span></div>' +
        (soja ? '<div class="dir"><b>' + n(cT / (cHa || 1) / soja.preco, 1) + ' sc/ha</b><br><span>em sacas de soja (' + esc(soja.praca.split('/')[0]) + ')</span></div>' : '') + '</div>' +
        (D.custo.sem_preco && D.custo.sem_preco.length ? '<div class="ini-pe">Sem preço no estoque: ' + esc(D.custo.sem_preco.slice(0, 4).join(', ')) + (D.custo.sem_preco.length > 4 ? '…' : '') + '</div>' : '') + '</div>';
    }
    // atenção
    var al = [];
    (D.estoque || []).filter(function (e) { return e.sobra < 0 && e.a_aplicar > 0; }).sort(function (a, b) { return a.sobra - b.sobra; }).slice(0, 3).forEach(function (e) {
      al.push('📦<div><b>' + esc(e.produto) + '</b>: faltam ' + n(-e.sobra, -e.sobra < 10 ? 1 : 0) + ' ' + esc(e.unidade) + ' no estoque para as aplicações programadas</div>'); });
    R.lista.forEach(function (x) { var ch = x.d && x.d >= hj && x.d <= somaDias(hj, 3) ? chuvaNo(x.d) : null; if (ch && ch.mm >= 10 && al.length < 6) al.push('🌧️<div><b>' + (ch.mm >= 1 ? n(ch.mm) + ' mm' : ch.prob + '% de chuva') + ' ' + (x.d === hj ? 'hoje' : diaSem(x.d) + ' ' + dataBR(x.d)) + '</b>: confira a ' + esc(x.a.titulo) + ' marcada para esse dia</div>'); });
    if (R.at) al.push('⏰<div><b>' + R.at + (R.at === 1 ? ' aplicação atrasada' : ' aplicações atrasadas') + '</b>: veja na aba Aplicações</div>');
    if (al.length) h += '<div class="ini-card"><div class="ini-ct"><h3>🔔 Atenção</h3></div>' + al.map(function (x) { return '<div class="ini-al">' + x + '</div>'; }).join('') + '</div>';
    $('#conteudo').innerHTML = h;
    document.querySelectorAll('[data-ir]').forEach(function (b) { b.onclick = function () { aba = b.dataset.ir; pintar(); window.scrollTo(0, 0); }; });
    var sl = document.getElementById('iniLoc'); if (sl) sl.onchange = function () { INI.loc = sl.value; iniCarregar(); };
    ligarFormacao();
    ligarChuva();
  }

  /* ---------- visão da fazenda ---------- */
  function abas() {
    if (eu.papel === 'operador') return '';
    return '<div class="abas">' + [['inicio', 'Início'], ['apl', 'Aplicações'], ['mapa', 'Mapas'], ['plantio', 'Plantio'], ['colh', 'Colheita'], ['est', 'Estoque e custos']].map(function (x) {
      return '<button data-aba="' + x[0] + '" class="' + (aba === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }
  function ligarAbas() { document.querySelectorAll('[data-aba]').forEach(function (b) { b.onclick = function () { aba = b.dataset.aba; pintar(); window.scrollTo(0, 0); }; }); }

  function pintar() {
    mapas.forEach(function (m) { try { m.remove(); } catch (e) {} }); mapas = [];
    if (eu.papel === 'operador') return vistaOperador();
    if (aba === 'inicio') vistaInicio();
    else if (aba === 'mapa') vistaMapas();
    else if (aba === 'plantio') vistaPlantio();
    else if (aba === 'est') vistaEstoque();
    else if (aba === 'colh') vistaColheita();
    else {
      var seg = '<div class="seg apmodo"><button data-apm="ver" class="' + (apModo === 'ver' ? 'on' : '') + '">📋 Programação</button>' +
        '<button data-apm="lancar" class="' + (apModo === 'lancar' ? 'on' : '') + '">✔ Lançar aplicação</button></div>';
      if (apModo === 'lancar') listaAplic(abas() + seg);
      else $('#conteudo').innerHTML = abas() + seg + ((D.blocos.proximas || '') + (D.blocos.aplicacoes || '') || '<div class="vazio">Nenhuma aplicação nesta safra ainda.</div>');
      document.querySelectorAll('[data-apm]').forEach(function (b) { b.onclick = function () { apModo = b.dataset.apm; pintar(); }; });
    }
    ligarAbas();
  }

  function vistaEstoque() {
    var e = D.estoque || [], val = 0, gasto = 0;
    e.forEach(function (x) { val += x.valor_saldo; gasto += x.gasto; });
    var h = abas() + '<div class="kpis"><div><b>' + brl(val) + '</b><span>valor em estoque</span></div><div><b>' + brl(gasto) + '</b><span>gasto em produtos aplicados</span></div></div>';
    h += '<h2 class="talhao">Estoque de produtos</h2>' + (e.length ? '<div class="tab"><table><tr><th>Produto</th><th>Entradas</th><th>Aplicado</th><th>A aplicar</th><th>Saldo</th><th>Sobra após recomendações</th><th>Preço médio</th></tr>' +
      e.map(function (x) { var u = x.unidade; return '<tr><td><b>' + esc(x.produto) + '</b></td><td>' + n(x.entradas, 1) + ' ' + u + '</td><td>' + n(x.aplicado, 1) + ' ' + u + '</td><td>' + n(x.a_aplicar, 1) + ' ' + u + '</td>' +
        '<td' + (x.saldo < 0 ? ' class="neg"' : '') + '>' + n(x.saldo, 1) + ' ' + u + '</td><td' + (x.sobra < 0 ? ' class="neg"' : '') + '>' + (x.sobra < 0 ? 'faltam ' + n(-x.sobra, 1) : n(x.sobra, 1)) + ' ' + u + '</td>' +
        '<td>' + (x.custo_unit ? brl(x.custo_unit) + '/' + u : '<span class="sem">—</span>') + '</td></tr>'; }).join('') + '</table></div>' : '<div class="vazio">Nenhum produto lançado no estoque desta fazenda.</div>');
    var c = D.custo, col = {}; (D.colheita || []).forEach(function (x) { col[x.talhao] = x.sc_ha; });
    h += '<h2 class="talhao">Custo por talhão<small>produtos aplicados × preço médio</small></h2>';
    if (c && c.talhoes && c.talhoes.length) {
      var tot = { ha: 0, g: 0 };
      h += '<div class="tab"><table><tr><th>Talhão</th><th>Área (ha)</th><th>Aplicações</th><th>Gasto</th><th>Gasto/ha</th><th>Colheita (sc/ha)</th></tr>' + c.talhoes.map(function (t) {
        tot.ha += t.ha; tot.g += t.custo;
        return '<tr><td><b>' + esc(t.nome) + '</b></td><td>' + n(t.ha, 1) + '</td><td>' + (t.aplicacoes || '—') + '</td><td>' + (t.custo ? brl(t.custo) : '<span class="sem">—</span>') + '</td><td>' + (t.custo_ha ? brl(t.custo_ha) : '<span class="sem">—</span>') + '</td><td>' + (t.sc_ha ? n(t.sc_ha, 1) : '<span class="sem">—</span>') + '</td></tr>';
      }).join('') + '<tr><td><b>Total</b></td><td><b>' + n(tot.ha, 1) + '</b></td><td></td><td><b>' + brl(tot.g) + '</b></td><td><b>' + (tot.ha ? brl(tot.g / tot.ha) : '—') + '</b></td><td></td></tr></table></div>' +
        (c.sem_preco && c.sem_preco.length ? '<div class="obs">Sem preço no estoque (fora do gasto): ' + esc(c.sem_preco.join(', ')) + '</div>' : '');
    } else h += '<div class="vazio">O custo por talhão aparece quando houver aplicações marcadas como feitas.</div>';
    $('#conteudo').innerHTML = h;
  }


  /* ---------- colheita: previsão = plantio + ciclo do material (± 5 dias) ---------- */
  var CICLO_PADRAO = { soja: 115, milho: 135, algodao: 180, feijao: 90, sorgo: 120, outra: 120 };
  var ICO_PULV = '<svg class="ico pulv" viewBox="0 0 64 30" aria-hidden="true"><g fill="#38B6E8"><path d="M3.5 16 l-1.6 4.2 h3.2z M9.5 16 l-1.6 4.2 h3.2z M15.5 16 l-1.6 4.2 h3.2z M21 16 l-1.6 4.2 h3.2z M43 16 l-1.6 4.2 h3.2z M48.5 16 l-1.6 4.2 h3.2z M54.5 16 l-1.6 4.2 h3.2z M60.5 16 l-1.6 4.2 h3.2z"/></g><g stroke="currentColor" stroke-linecap="round" fill="none"><path d="M1.5 11.2 H24 M40 11.2 H62.5" stroke-width="1.6"/><path d="M2 15 H24 M40 15 H62" stroke-width="1.8"/><path d="M2 15 L5 11.2 L8 15 L11 11.2 L14 15 L17 11.2 L20 15 L23 11.2 M41 11.2 L44 15 L47 11.2 L50 15 L53 11.2 L56 15 L59 11.2 L62 15" stroke-width="1"/></g><g fill="#1F2A22"><rect x="2.8" y="15" width="1.4" height="1.4"/><rect x="8.8" y="15" width="1.4" height="1.4"/><rect x="14.8" y="15" width="1.4" height="1.4"/><rect x="20.3" y="15" width="1.4" height="1.4"/><rect x="42.3" y="15" width="1.4" height="1.4"/><rect x="47.8" y="15" width="1.4" height="1.4"/><rect x="53.8" y="15" width="1.4" height="1.4"/><rect x="59.8" y="15" width="1.4" height="1.4"/></g><rect x="23.2" y="15.5" width="4.4" height="13" rx="1.6" fill="#222"/><rect x="36.4" y="15.5" width="4.4" height="13" rx="1.6" fill="#222"/><rect x="25" y="14" width="14" height="4.2" rx="1" fill="currentColor"/><path d="M24.5 6.2 Q24.5 3.4 27.3 3.4 H36.7 Q39.5 3.4 39.5 6.2 V15 H24.5 Z" fill="currentColor"/><rect x="26.6" y="6" width="10.8" height="5.6" rx="1" fill="#24312A"/><path d="M27.6 7 h3 l-1.8 3.6 h-1.2z" fill="#fff" opacity=".35"/><rect x="30.8" y="1.6" width="2.4" height="1.8" rx=".6" fill="#F5B400"/><rect x="22.4" y="7.2" width="1.6" height="2.6" rx=".5" fill="#1F2A22"/><rect x="40" y="7.2" width="1.6" height="2.6" rx=".5" fill="#1F2A22"/></svg>';
  var ICO_COLH = '<svg class="ico colh" viewBox="0 0 72 40" aria-hidden="true"><g stroke="#B8962E" stroke-width="1.2" stroke-linecap="round"><path d="M60.5 38.5 v-1.8 M63.5 38.5 v-1.5 M66.5 38.5 v-1.9 M69.5 38.5 v-1.4"/></g><path d="M44 11.2 L66 9.6 L66 12.2 L44 13.6 Z" fill="#1E8E3E"/><path d="M65.3 9.2 h3.2 l1.6 5.4 h-2.4 Z" fill="#222"/><path d="M33 15 L30.5 8.5 H50 L47.5 15 Z" fill="#167030"/><path d="M30 14.5 H57 Q60.5 14.5 61 18 L61.5 28.5 H30 Z" fill="#1E8E3E"/><path d="M33 23.5 Q45 20.6 61 20 L61.1 21.6 Q45 22.2 33 24.9 Z" fill="#F2C400"/><rect x="42" y="27.5" width="12" height="4.5" rx="1" fill="#167030"/><path d="M19.5 9 H31 V10.8 H19.5 Z" fill="#1E8E3E"/><rect x="24.3" y="6.6" width="1.8" height="2.4" rx=".6" fill="#F5A623"/><path d="M21 10.8 H30 V21 H22.6 Z" fill="#A9D3DC" stroke="#1F2A22" stroke-width=".9" stroke-linejoin="round"/><path d="M26.3 10.8 V21" stroke="#1F2A22" stroke-width=".8"/><rect x="20.5" y="21" width="10" height="3" fill="#1E8E3E"/><path d="M30 21 L30 28.5 L18 33.5 L16 29 Z" fill="#17803A"/><g stroke="#4F7F22" stroke-width="1.3" stroke-linecap="round" fill="none"><path d="M3 38.5 V24 M3 33 L0.8 30.5 M3 29 L5.4 26.6 M3 26 L1.2 23.8"/><path d="M8.2 38.5 V22.5 M8.2 31.5 L10.6 29.2 M8.2 27.5 L6 25.2 M8.2 25 L10.2 22.8"/></g><g fill="#7DAF3A"><ellipse cx="0.9" cy="30" rx="1.6" ry="1"/><ellipse cx="5.7" cy="26.2" rx="1.6" ry="1"/><ellipse cx="1.1" cy="23.3" rx="1.5" ry="1"/><ellipse cx="10.8" cy="28.8" rx="1.6" ry="1"/><ellipse cx="5.8" cy="24.8" rx="1.5" ry="1"/><ellipse cx="10.4" cy="22.3" rx="1.5" ry="1"/></g><g fill="#C9A227"><ellipse cx="3" cy="23.3" rx="1" ry="1.5"/><ellipse cx="4.1" cy="30.6" rx=".7" ry="1.2"/><ellipse cx="1.9" cy="27.4" rx=".7" ry="1.2"/><ellipse cx="8.2" cy="21.7" rx="1" ry="1.5"/><ellipse cx="9.3" cy="26.6" rx=".7" ry="1.2"/><ellipse cx="7.1" cy="29.8" rx=".7" ry="1.2"/></g><path d="M6.5 35 L9.5 30.5 H22 L24 33.5 L22 37 H8.5 Z" fill="#1E8E3E"/><path d="M8 35.5 L10.6 32.3 H19 L18.2 33.3 H11.4 L9.4 35.5 Z" fill="#F2C400"/><g stroke="#222" stroke-linecap="round"><circle cx="14.5" cy="26" r="5.8" fill="none" stroke-width="1.5"/><path d="M14.5 20.2 V31.8 M9.5 23.1 L19.5 28.9 M9.5 28.9 L19.5 23.1" stroke-width="1"/><path d="M14.5 20.2 l-1.6 -0.6 M19.5 23.1 l0.2 -1.7 M19.5 28.9 l1.4 1 M14.5 31.8 l1.6 .6 M9.5 28.9 l-.2 1.7 M9.5 23.1 l-1.4 -1" stroke-width=".9"/></g><circle cx="14.5" cy="26" r="1.4" fill="#1E8E3E"/><path d="M28.6 24 V35 M30.4 24 V35 M28.6 27 H30.4 M28.6 30 H30.4 M28.6 33 H30.4" stroke="#2DB24F" stroke-width=".6"/><circle cx="37" cy="30.5" r="8.3" fill="#222"/><circle cx="37" cy="30.5" r="4.3" fill="#F2C400"/><circle cx="37" cy="30.5" r="1.2" fill="#B89200"/><circle cx="56" cy="32.6" r="6.2" fill="#222"/><circle cx="56" cy="32.6" r="3.2" fill="#F2C400"/><circle cx="56" cy="32.6" r="0.9" fill="#B89200"/></svg>';
  function chave(x) { return String(x || '').trim().replace(/\\s+/g, ' ').toLowerCase(); }
  function somaDias(iso, k) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); }
  // de onde veio o ciclo: informado pelo consultor ou calculado pelo grupo de maturação (GMR) da cultivar
  function rotCiclo(c) {
    if (!c || !c.dias) return 'estimado';
    var g = String(Number(c.gmr || 0).toFixed(1)).replace('.', ',');
    return c.fonte === 'gmr' ? 'GMR ' + g : c.fonte === 'faixa' ? 'GMR ~' + g : 'informado';
  }
  function previsoes() {
    var areas = {}, col = {};
    ((D.mapa && D.mapa.features) || []).forEach(function (f) { var q = f.properties || {}; if (q.nome) areas[q.nome] = Number(q.area_ha) || 0; });
    (D.colheita || []).forEach(function (c) { if (c.sc_ha) col[c.talhao] = c; });
    var lista = [];
    (D.plantio || []).filter(function (p) { return p.cultura && p.cultura !== 'pastagem' && p.cultura !== 'pousio'; }).forEach(function (p) {
      // talhão em partes (mais de uma variedade): uma previsão para cada parte
      var pts = p.partes && p.partes.length ? p.partes.map(function (x) { return { v: x.variedade, ha: x.ha, d: x.data_plantio || p.data_plantio }; })
        : [{ v: p.variedade, ha: areas[p.talhao] || 0, d: p.data_plantio }];
      pts.forEach(function (x) {
        if (!x.d) return;
        var c = (D.ciclos || []).filter(function (y) { return x.v && chave(y.variedade) === chave(x.v); })[0];
        var dias = c && c.dias ? Number(c.dias) : CICLO_PADRAO[p.cultura]; if (!dias) return;
        lista.push({ talhao: p.talhao, mat: x.v || NC[p.cultura] || p.cultura, cultura: p.cultura, ha: x.ha, plantio: x.d,
          dias: dias, est: !(c && c.dias), lab: rotCiclo(c), data: somaDias(x.d, dias), colhido: col[p.talhao] || null });
      });
    });
    return lista.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : String(a.talhao).localeCompare(b.talhao, 'pt-BR', { numeric: true }); });
  }
  // eventos do calendário: aplicações (pulverizador) e colheita prevista (colheitadeira)
  function eventosCal(pv) {
    var ev = [];
    (D.aplicacoes || []).forEach(function (a) {
      var g = {};
      a.tal.forEach(function (t) {
        var d = t.feito || t.data; if (!d) return;
        var k = (t.feito ? 'apl' : (t.data < hoje() ? 'venc' : 'prev')) + '|' + d;
        (g[k] = g[k] || []).push(t.nome);
      });
      Object.keys(g).forEach(function (k) { var p = k.split('|'); ev.push({ d: p[1], k: p[0], txt: (D.todas && a.fazenda ? a.fazenda + ' · ' : '') + a.titulo + (p[0] === 'apl' ? ' aplicada' : ' prevista'), tal: g[k] }); });
    });
    var gc = {};
    pv.forEach(function (x) { if (x.colhido) return; var k = x.data + '|' + x.mat; (gc[k] = gc[k] || { d: x.data, k: 'colh', txt: 'Colheita prevista · ' + x.mat, tal: [], est: x.est }).tal.push(x.talhao); });
    Object.keys(gc).forEach(function (k) { ev.push(gc[k]); });
    return ev;
  }
  var CAL = { y: 0, m: 0, sel: '' };
  // grade do mês com ícones e a lista do dia escolhido
  function calendario(ev, comColh) {
    var ini = new Date(Date.UTC(CAL.y, CAL.m, 1)).getUTCDay(), nd = new Date(Date.UTC(CAL.y, CAL.m + 1, 0)).getUTCDate(), g = '';
    ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].forEach(function (x) { g += '<div class="dw">' + x + '</div>'; });
    for (var i = 0; i < ini; i++) g += '<div></div>';
    for (var d = 1; d <= nd; d++) {
      var iso = CAL.y + '-' + ('0' + (CAL.m + 1)).slice(-2) + '-' + ('0' + d).slice(-2), es = ev.filter(function (e) { return e.d === iso; });
      var ap = es.filter(function (e) { return e.k !== 'colh'; }), co = es.filter(function (e) { return e.k === 'colh'; });
      var cor = ap.some(function (e) { return e.k === 'venc'; }) ? 'venc' : ap.some(function (e) { return e.k === 'prev'; }) ? 'prev' : 'apl';
      g += '<button data-dia="' + iso + '" class="' + (iso === hoje() ? 'hj ' : '') + (iso === CAL.sel ? 'sl' : '') + '"><span>' + d + '</span><i>' +
        (ap.length ? '<span class="k-' + cor + '">' + ICO_PULV + '</span>' : '') + (co.length ? '<span class="k-colh">' + ICO_COLH + '</span>' : '') + '</i></button>';
    }
    var ds = ev.filter(function (e) { return e.d === CAL.sel; });
    return '<div class="cal-h"><button data-mes="-1" aria-label="mês anterior">‹</button><b>' + MESES[CAL.m].charAt(0).toUpperCase() + MESES[CAL.m].slice(1) + ' de ' + CAL.y + '</b><button data-mes="1" aria-label="próximo mês">›</button></div>' +
      '<div class="cal">' + g + '</div>' +
      '<div class="legc"><span class="k-prev">' + ICO_PULV + 'aplicação prevista</span><span class="k-apl">' + ICO_PULV + 'aplicada</span><span class="k-venc">' + ICO_PULV + 'atrasada</span>' + (comColh ? '<span class="k-colh">' + ICO_COLH + 'colheita prevista</span>' : '') + '</div>' +
      '<div style="font-weight:700;margin:4px 2px 6px">' + dataBR(CAL.sel) + (CAL.sel === hoje() ? ' (hoje)' : '') + '</div>' +
      (ds.length ? ds.map(function (e) {
        return '<div class="ev"><span class="k-' + (e.k === 'colh' ? 'colh' : e.k) + '">' + (e.k === 'colh' ? ICO_COLH : ICO_PULV) + '</span><div><b>' + esc(e.txt) + '</b>' + (e.est ? ' <span class="sem">(estimado)</span>' : '') +
          '<small>' + esc(e.tal.join(', ')) + (e.k === 'colh' ? ' · janela ' + dataBR(somaDias(e.d, -5)) + ' a ' + dataBR(somaDias(e.d, 5)) : '') + '</small></div></div>';
      }).join('') : '<div class="sem" style="margin:0 2px 10px">Nada neste dia.</div>');
  }
  function ligarCal() {
    document.querySelectorAll('[data-dia]').forEach(function (b) { b.onclick = function () { CAL.sel = b.dataset.dia; pintar(); }; });
    document.querySelectorAll('[data-mes]').forEach(function (b) { b.onclick = function () { CAL.m += Number(b.dataset.mes); if (CAL.m < 0) { CAL.m = 11; CAL.y--; } if (CAL.m > 11) { CAL.m = 0; CAL.y++; } pintar(); }; });
  }
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function vistaColheita() {
    var pv = previsoes(), ev = eventosCal(pv);
    if (!CAL.y) {   // abre no mês da próxima colheita prevista (ou no mês atual)
      var prox = pv.filter(function (x) { return !x.colhido && x.data >= hoje(); })[0], base = prox ? prox.data : hoje();
      CAL.y = Number(base.slice(0, 4)); CAL.m = Number(base.slice(5, 7)) - 1; CAL.sel = base;
    }
    var h = abas() + '<h2 class="talhao">Calendário<small>aplicações e colheita prevista</small></h2>' + calendario(ev, true) +
      (D.graf && D.graf.prev && D.graf.prev.length ? grafHtml(GR.colh, 'c') : '');

    if (!pv.length) {
      h += '<div class="vazio">A previsão de colheita aparece quando o consultor lançar a data de plantio dos talhões.</div>';
    } else {
      // resumo por material
      var mats = {}, cores = {}, ci = 0;
      pv.forEach(function (x) {
        var m = mats[x.mat] || (mats[x.mat] = { ha: 0, ini: x.data, fim: x.data, est: false, colhido: 0, lab: x.lab, dias: x.dias });
        m.ha += x.ha; if (x.data < m.ini) m.ini = x.data; if (x.data > m.fim) m.fim = x.data; if (x.est) m.est = true; if (x.colhido) m.colhido += x.ha;
        if (!cores[x.mat]) cores[x.mat] = CORES[ci++ % CORES.length];
      });
      h += '<h2 class="talhao">Previsão por material</h2><div class="tab"><table><tr><th>Material</th><th>Área</th><th>Colheita prevista</th><th>Ciclo</th></tr>' + Object.keys(mats).map(function (k) {
        var m = mats[k];
        return '<tr><td><b><i style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;background:' + cores[k] + '"></i>' + esc(k) + '</b></td><td>' + n(m.ha, 1) + ' ha' + (m.colhido ? '<br><span class="sem">' + n(m.colhido, 1) + ' ha colhidos</span>' : '') + '</td>' +
          '<td>' + dataBR(m.ini) + (m.fim !== m.ini ? ' a ' + dataBR(m.fim) : '') + '</td><td>' + m.dias + ' dias<br><span class="sem">' + esc(m.lab) + '</span></td></tr>';
      }).join('') + '</table></div>';
      // hectares prontos por semana (segunda-feira de cada semana), por material
      var sem = {}, mx = 0;
      pv.forEach(function (x) {
        if (x.colhido) return;
        var dt = new Date(x.data + 'T12:00:00Z'), seg = new Date(dt); seg.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
        var k = seg.toISOString().slice(0, 10), w = sem[k] || (sem[k] = { tot: 0, m: {} });
        w.tot += x.ha; w.m[x.mat] = (w.m[x.mat] || 0) + x.ha; if (w.tot > mx) mx = w.tot;
      });
      var ks = Object.keys(sem).sort();
      if (ks.length > 1) {
        var todas = [], cur = ks[0];
        while (cur <= ks[ks.length - 1] && todas.length < 40) { todas.push(cur); if (!sem[cur]) sem[cur] = { tot: 0, m: {} }; cur = somaDias(cur, 7); }
        ks = todas;
      }
      if (ks.length) {
        h += '<h2 class="talhao">Hectares prontos por semana</h2><div class="caixa"><div class="sems">' + ks.map(function (k) {
          return '<div class="c" title="' + n(sem[k].tot, 1) + ' ha">' + Object.keys(sem[k].m).map(function (m) { return '<u style="height:' + Math.max(2, sem[k].m[m] / mx * 100) + 'px;background:' + cores[m] + '"></u>'; }).join('') + '</div>';
        }).join('') + '</div><div class="semr">' + ks.map(function (k) { return '<span>' + dataBR(k) + '</span>'; }).join('') + '</div>' +
          '<div class="leg">' + Object.keys(mats).map(function (k) { return '<span><i style="background:' + cores[k] + '"></i>' + esc(k) + '</span>'; }).join('') + '</div></div>';
      }
      // tabela por talhão
      h += '<h2 class="talhao">Por talhão</h2><div class="tab"><table><tr><th>Talhão</th><th>Material</th><th>Área</th><th>Plantio</th><th>Ciclo</th><th>Previsão</th><th>Janela</th><th>Faltam</th></tr>' + pv.map(function (x) {
        var f = dif(x.data, hoje());
        return '<tr><td><b>' + esc(x.talhao) + '</b></td><td style="text-align:left">' + esc(x.mat) + '</td><td>' + n(x.ha, 1) + '</td><td>' + dataBR(x.plantio) + '</td>' +
          '<td>' + x.dias + ' d' + (x.est ? ' <span class="sem">(est.)</span>' : '') + '</td><td><b>' + dataBR(x.data) + '</b></td>' +
          '<td>' + dataBR(somaDias(x.data, -5)) + ' – ' + dataBR(somaDias(x.data, 5)) + '</td>' +
          '<td>' + (x.colhido ? '<span style="color:#2F9E5B;font-weight:700">colhido</span>' : f > 0 ? f + ' dias' : f === 0 ? 'hoje' : '<span class="neg">' + (-f) + ' dias atrás</span>') + '</td></tr>';
      }).join('') + '</table></div>' +
        '<div class="sem" style="font-size:12.5px;margin:0 2px">Previsão = data de plantio + ciclo do material, com janela de ± 5 dias (clima e chuva mexem na colheita). Na soja o ciclo sai do grupo de maturação (GMR) da cultivar; "estimado" = ciclo padrão da cultura.</div>';
    }
    $('#conteudo').innerHTML = h;
    DPG.ligar($('#conteudo'), GR.colh, pintar);
    ligarCal();
  }

  /* ---------- plantio: evolução, talhões e lançamento da área plantada no dia (gerente) ---------- */
  function areasMapa() { var o = {}; ((D.mapa && D.mapa.features) || []).forEach(function (f) { var q = f.properties || {}; if (q.nome) o[q.nome] = Number(q.area_ha) || 0; }); return o; }
  function porNome(a, b) { return String(a).localeCompare(String(b), 'pt-BR', { numeric: true }); }
  // gráfico com troca para o lado (plantio ⇄ previsão de colheita); st = estado da aba
  function grafHtml(st, so) { return D.graf ? '<div class="caixa gr">' + DPG.html(st, D.graf, { resumo: true, so: so }) + '</div>' : ''; }
  function vistaPlantio() {
    var areas = areasMapa(), pl = {}, lanc = [];
    (D.plantio || []).forEach(function (p) { pl[p.talhao] = p; (p.lanc || []).forEach(function (x) { lanc.push({ t: p.talhao, d: x.d, ha: x.ha, por: x.por }); }); });
    lanc.sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : porNome(a.t, b.t); });
    var nomes = Object.keys(areas).concat(Object.keys(pl).filter(function (t) { return !(t in areas); })).sort(porNome);
    var lin = nomes.map(function (t) {
      var p = pl[t] || {}, ar = areas[t] || 0, hp = Number(p.ha_plantada) || 0, pc = ar ? Math.min(100, hp / ar * 100) : 0;
      var dae = p.data_emerg ? dif(hoje(), p.data_emerg) : null;
      return '<tr><td><b>' + esc(t) + '</b></td><td style="text-align:left">' + esc(NC[p.cultura] || p.cultura || '—') + (p.partes && p.partes.length ? '<br><span class="sem">' + p.partes.map(function (x) { return esc(x.variedade) + ' ' + n(x.ha, 1) + ' ha'; }).join('<br>') + '</span>' : p.variedade ? '<br><span class="sem">' + esc(p.variedade) + '</span>' : '') + '</td>' +
        '<td style="white-space:nowrap">' + (hp ? n(hp, 1) + ' ha · ' + pc.toFixed(0) + '%<div class="barra"><i style="width:' + pc.toFixed(0) + '%"></i></div>' : '<span class="sem">' + n(ar, 1) + ' ha</span>') + '</td>' +
        '<td>' + dataBR(p.data_plantio) + '</td><td>' + (dae !== null && dae >= 0 ? dae : '—') + '</td></tr>';
    }).join('');
    var gerente = eu.papel !== 'operador';
    var h = abas() + (gerente && !D.todas ? '<button class="btn" id="btnLancPl">🌱 Lançar plantio do dia</button>' : '') +
      (gerente && D.todas ? '<div class="sem" style="margin:0 2px 10px">Para lançar o plantio do dia, escolha uma fazenda no topo.</div>' : '') +
      (D.graf && D.graf.linha && D.graf.linha.length ? grafHtml(GR.plantio, 'p') : D.blocos.evolucao || '<div class="vazio">A evolução do plantio aparece quando a área plantada for lançada.</div>') +
      (lin ? '<h2 class="talhao">Talhões</h2><div class="tab"><table><tr><th>Talhão</th><th style="text-align:left">Cultura / variedade</th><th>Plantado</th><th>Plantio</th><th>DAE</th></tr>' + lin + '</table></div>' : '');
    if (lanc.length) h += '<h2 class="talhao">Lançamentos por dia</h2>' + lanc.slice(0, 40).map(function (x) {
      return '<div class="lanc"><div class="t"><b>' + dataBR(x.d) + ' · ' + esc(x.t) + ' · ' + n(x.ha, 1) + ' ha</b><small>' + esc(x.por || 'lançado') + '</small></div>' +
        (gerente && !D.todas ? '<button data-apl="' + esc(x.t) + '|' + esc(x.d) + '">apagar</button>' : '') + '</div>';
    }).join('');
    $('#conteudo').innerHTML = h;
    DPG.ligar($('#conteudo'), GR.plantio, pintar);
    var bl = document.getElementById('btnLancPl'); if (bl) bl.onclick = function () { folhaPlantio(); };
    document.querySelectorAll('[data-apl]').forEach(function (b) { b.onclick = function () {
      var p = b.dataset.apl.split('|');
      if (!confirm('Apagar o lançamento de ' + dataBR(p[1]) + ' em ' + p[0] + '?')) return;
      enviarPlantio({ talhao: p[0], data: p[1], apagar: true }, 'Lançamento apagado');
    }; });
  }
  var CULT = null;
  function carregarCult() {
    if (CULT) return Promise.resolve(CULT);
    return api('/api/portal/cultivares').then(function (r) { CULT = r.catalogo || []; return CULT; }).catch(function () { return []; });
  }
  async function enviarPlantio(corpo, msg) {
    try {
      await api('/api/portal/plantio', Object.assign({ fazenda: $('#selFaz').value, safra: D.safra }, corpo));
      toast(msg); await carregar(D.safra); return true;
    } catch (e) { toast(e.message || 'Não foi possível salvar (sem internet?)'); return false; }
  }
  function folhaPlantio() {
    var areas = areasMapa(), pl = {}; (D.plantio || []).forEach(function (p) { pl[p.talhao] = p; });
    var nomes = Object.keys(areas).sort(porNome);
    var resta = function (t) { var p = pl[t] || {}; return Math.max(0, (areas[t] || 0) - (Number(p.ha_plantada) || 0)); };
    var v = document.createElement('div'); v.className = 'veu';
    v.innerHTML = '<div class="folha"><h3>Lançar plantio do dia</h3><div class="q">A área entra na evolução do plantio do relatório e no app do consultor.</div>' +
      '<div class="campo"><label class="l">Data *</label><input type="date" id="pData" value="' + hoje() + '" max="' + hoje() + '"></div>' +
      '<div class="campo"><label class="l">Talhão *</label><select id="pTal"><option value="">— escolher —</option>' + nomes.map(function (t) {
        var r = resta(t); return '<option value="' + esc(t) + '">' + esc(t) + ' · ' + (r > 0.05 ? 'faltam ' + n(r, 1) + ' ha' : 'completo') + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label class="l">Hectares plantados neste dia *</label><input id="pHa" inputmode="decimal" placeholder="ex.: 45,5"></div>' +
      '<div class="campo"><label class="l">Cultura</label><select id="pCult">' + ['soja', 'milho', 'algodao', 'feijao', 'sorgo', 'trigo', 'outra'].map(function (c) { return '<option value="' + c + '">' + NC[c] + '</option>'; }).join('') + '</select></div>' +
      '<div id="pVarBox"></div>' +
      '<button class="btn" id="pOk">✔ Salvar</button><button class="btn sec" id="pNao">Cancelar</button></div>';
    document.body.appendChild(v);
    var st = { emp: '', vari: '' };
    function pintarVar() {
      var t = v.querySelector('#pTal').value, p = pl[t] || {}, box = v.querySelector('#pVarBox');
      if (p.variedade) { box.innerHTML = '<div class="campo"><label class="l">Variedade</label><div class="sem" style="padding:6px 2px">' + esc(p.variedade) + ' (já lançada neste talhão)</div></div>'; return; }
      if (v.querySelector('#pCult').value !== 'soja' || !CULT || !CULT.length || st.emp === '*') {
        box.innerHTML = (CULT && CULT.length && v.querySelector('#pCult').value === 'soja' ? '<div class="campo"><label class="l">Variedade: empresa</label><select id="pEmp"><option value="">— escolher —</option>' + CULT.map(function (e) { return '<option>' + esc(e[0]) + '</option>'; }).join('') + '<option value="*" selected>Outra / digitar</option></select></div>' : '') +
          '<div class="campo"><label class="l">Variedade (opcional)</label><input id="pVarTxt" value="' + esc(st.vari) + '" placeholder="ex.: NEO 790 IPRO"></div>';
      } else {
        var it = st.emp ? ((CULT.filter(function (e) { return e[0] === st.emp; })[0] || [0, []])[1]).slice().sort(porNome) : [];
        box.innerHTML = '<div class="campo"><label class="l">Variedade: empresa</label><select id="pEmp"><option value="">— escolher —</option>' + CULT.map(function (e) {
          return '<option' + (e[0] === st.emp ? ' selected' : '') + '>' + esc(e[0]) + '</option>'; }).join('') + '<option value="*">Outra / digitar</option></select></div>' +
          (st.emp ? '<div class="campo"><label class="l">Variedade</label><select id="pVar"><option value="">— escolher —</option>' + it.map(function (x) {
            return '<option' + (x === st.vari ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>' : '');
      }
      var e = box.querySelector('#pEmp'); if (e) e.onchange = function () { st.emp = e.value; st.vari = ''; pintarVar(); };
      var s2 = box.querySelector('#pVar'); if (s2) s2.onchange = function () { st.vari = s2.value; };
      var tx = box.querySelector('#pVarTxt'); if (tx) tx.oninput = function () { st.vari = tx.value; };
    }
    v.querySelector('#pTal').onchange = function () {
      var t = this.value, p = pl[t] || {}, r = resta(t);
      if (p.cultura) v.querySelector('#pCult').value = p.cultura;
      if (r > 0.05) v.querySelector('#pHa').placeholder = 'até ' + n(r, 1) + ' ha';
      pintarVar();
    };
    v.querySelector('#pCult').onchange = pintarVar;
    pintarVar(); carregarCult().then(pintarVar);
    v.querySelector('#pNao').onclick = function () { v.remove(); };
    v.querySelector('#pOk').onclick = async function () {
      var t = v.querySelector('#pTal').value, d = v.querySelector('#pData').value, ha = Number(String(v.querySelector('#pHa').value || '').replace(',', '.'));
      if (!d) { toast('Informe a data'); return; }
      if (!t) { toast('Escolha o talhão'); return; }
      if (!(ha > 0)) { toast('Informe os hectares plantados'); return; }
      this.disabled = true;
      var ok = await enviarPlantio({ talhao: t, data: d, ha: ha, cultura: v.querySelector('#pCult').value, variedade: st.vari }, '✔ Plantio lançado: ' + t + ' · ' + n(ha, 1) + ' ha');
      if (ok) v.remove(); else this.disabled = false;
    };
  }

  /* ---------- visão do operador / encarregado ---------- */
  var aberto = {};
  function vistaOperador() {
    if (opAba === 'mapa') return mapaOperador();
    if (opAba === 'cal') return calOperador();
    iniCarregar();
    listaAplic(abasOp() + cartaoPush() + cartaoClima(true));
  }
  // lista das aplicações com os talhões para marcar (operador e gerente da fazenda)
  function listaAplic(topo) {
    var l = (D.aplicacoes || []).filter(function (a) { return filtro === 'fazer' ? a.status !== 'aplicada' : a.tal.some(function (t) { return t.feito; }); });
    l.sort(function (a, b) { return filtro === 'fazer' ? (a.data < b.data ? -1 : 1) : (a.data > b.data ? -1 : 1); });
    var nFazer = (D.aplicacoes || []).filter(function (a) { return a.status !== 'aplicada'; }).length;
    var h = topo + '<div class="chips"><button data-f="fazer" class="' + (filtro === 'fazer' ? 'on' : '') + '">A fazer (' + nFazer + ')</button><button data-f="feitas" class="' + (filtro === 'feitas' ? 'on' : '') + '">Aplicadas</button></div>';
    if (!l.length) h += '<div class="vazio">' + (filtro === 'fazer' ? 'Nenhuma aplicação pendente. 👍' : 'Nenhuma aplicação marcada ainda.') + '</div>';
    h += l.map(cartao).join('');
    $('#conteudo').innerHTML = h;
    document.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { filtro = b.dataset.f; pintar(); }; });
    document.querySelectorAll('[data-marcar]').forEach(function (b) { b.onclick = function () { abrirFolha(b.dataset.marcar); }; });
    document.querySelectorAll('[data-cancela]').forEach(function (b) { b.onclick = function () { cancelarFila(b.dataset.cancela); }; });
    var bp = document.getElementById('btnPush'); if (bp) bp.onclick = ativarAvisos;
    document.querySelectorAll('[data-desp]').forEach(function (b) { b.onclick = function (ev) {
      ev.preventDefault(); ev.stopPropagation(); var p = b.dataset.desp.split('|');
      if (!confirm('Desfazer esta parte lançada em ' + p.slice(2).join('|') + '?')) return;
      api('/api/portal/aplicar', { rec_id: p[0], talhoes: [p.slice(2).join('|')], desfazer: true, parc_id: p[1] }).then(function () { toast('Desfeito'); return carregar(); }).catch(function (e) { toast(e.message); });
    }; });
    document.querySelectorAll('[data-desf]').forEach(function (b) { b.onclick = function () { var p = b.dataset.desf.split('|'); desfazer(p[0], p.slice(1).join('|')); }; });
    document.querySelectorAll('[data-vm]').forEach(function (b) { b.onclick = function () { aberto[b.dataset.vm] = !aberto[b.dataset.vm]; pintar(); }; });
    ligarAbasOp();
    document.querySelectorAll('.ap input[type=checkbox]').forEach(function (c) { c.onchange = function () { selec[c.dataset.rec] = marcados(c.dataset.rec); contar(c.dataset.rec); }; });
    l.forEach(function (a) { contar(a.id); if (aberto[a.id]) miniMapa(a); });
  }
  function quando(a) {
    if (a.status === 'aplicada') return '<span class="selo ok">Aplicada</span>';
    if (!a.data) return '<span class="selo">Pendente</span>';
    var d = dif(a.data, hoje());
    return d < 0 ? '<span class="selo venc">Atrasada ' + (-d) + (d === -1 ? ' dia' : ' dias') + '</span>' : d === 0 ? '<span class="selo venc">Hoje</span>' : d === 1 ? '<span class="selo">Amanhã</span>' : '<span class="selo">' + dataBR(a.data) + '</span>';
  }
  function cartao(a) {
    var pend = a.tal.filter(function (t) { return !t.feito; }), haP = pend.reduce(function (s, t) { return s + Math.max(0, t.ha - (t.feitoHa || 0)); }, 0);
    var haT = a.tal.reduce(function (s, t) { return s + t.ha; }, 0), base = haP || haT;
    var cls = a.status === 'aplicada' ? 'aplicada' : a.atrasada ? 'atrasada' : '';
    var h = '<div class="ap ' + cls + '"><div class="ap-h"><b>' + esc(a.titulo) + '</b>' + quando(a) + '</div>' +
      '<div class="ap-sub">' + (D.todas && a.fazenda ? '<b>🌾 ' + esc(a.fazenda) + '</b> · ' : '') + a.tal.length + ' talhão(ões) · ' + n(haT, 1) + ' ha' + (a.resp ? ' · resp.: ' + esc(a.resp) : '') + '</div>';
    // quanto de cada produto vai em um tanque cheio: dose × hectares que um tanque cobre (tanque ÷ calda)
    var haTq = a.calda && a.tanque ? a.tanque / a.calda : 0;
    if (a.prods.length) h += '<div class="pr' + (haTq ? ' t4' : '') + '"><span class="h">Produto</span><span class="h d">Dose</span>' + (haTq ? '<span class="h tq">Por tanque</span>' : '') + '<span class="h q">Total ' + (haP ? 'a aplicar' : '') + '</span>' +
      a.prods.map(function (p) {
        var t = total(p.dose * base, p.unidade), k = haTq ? total(p.dose * haTq, p.unidade) : null;
        return '<span>' + esc(p.nome) + '</span><span class="d">' + n(p.dose, p.dose < 1 ? 2 : 1) + ' ' + esc(p.unidade) + '</span>' +
          (k ? '<span class="tq">' + qtd(k) + '</span>' : '') + '<span class="q">' + n(t[0], t[0] < 10 ? 1 : 0) + ' ' + esc(t[1]) + '</span>';
      }).join('') + '</div>';
    if (a.calda) h += '<div class="calda">' + caldaTxt(a, base, haTq) + '</div>';
    if (a.obs) h += '<div class="obs">📝 ' + esc(a.obs) + '</div>';
    h += a.tal.map(function (t) {
      if (t.feito) return '<div class="tl"><span style="width:24px;text-align:center">' + (t.fila ? '⏳' : '✅') + '</span><div class="n"><b>' + esc(t.nome) + '</b><small>' + n(t.ha, 1) + ' ha</small>' + regDe(a, t.nome) + '</div>' +
        '<div class="feito">aplicado ' + dataBR(t.feito) + (t.fila ? '<br><span class="espera">esperando internet</span><br><button class="desf" data-cancela="' + esc(t.fila) + '">cancelar</button>'
          : (t.por ? '<br>' + esc(t.por) : '') + (t.meu ? '<br><button class="desf" data-desf="' + esc(a.id) + '|' + esc(t.nome) + '">desfazer</button>' : '')) + '</div></div>';
      var pa = (t.parc || []).length ? '<div class="parc">◐ parcial: ' + n(t.feitoHa, 1) + ' de ' + n(t.ha, 1) + ' ha · faltam ' + n(Math.max(0, t.ha - t.feitoHa), 1) + ' ha' +
        t.parc.map(function (x) { return '<br>' + dataBR(x.d) + ' · ' + n(x.ha, 1) + ' ha' + (x.fila ? ' ⏳' : (x.por ? ' · ' + esc(x.por) : '') + (x.meu ? '<button data-desp="' + esc(a.id) + '|' + esc(x.id) + '|' + esc(t.nome) + '">desfazer</button>' : '')); }).join('') + '</div>' : '';
      return '<label class="tl"><input type="checkbox" data-rec="' + esc(a.id) + '" value="' + esc(t.nome) + '"' + ((selec[a.id] || []).indexOf(t.nome) >= 0 ? ' checked' : '') + '><div class="n"><b>' + esc(t.nome) + '</b><small>' + n(t.ha, 1) + ' ha' + (t.data ? ' · prevista ' + dataBR(t.data) : '') + '</small>' + pa + '</div></label>';
    }).join('');
    if (pend.length) h += '<div class="marcar"><button class="btn" data-marcar="' + esc(a.id) + '" id="bt_' + esc(a.id) + '">✔ Marcar aplicado</button></div>';
    h += '<button class="vermapa" data-vm="' + esc(a.id) + '">' + (aberto[a.id] ? '▴ Esconder mapa' : '🗺️ Ver no mapa') + '</button>' + (aberto[a.id] ? '<div class="mini" id="mm_' + esc(a.id) + '"></div>' : '') + '</div>';
    return h;
  }
  function qtd(t) { return n(t[0], t[0] < 1 ? 2 : t[0] < 10 ? 1 : 0) + ' ' + esc(t[1]); }
  // calda e tanques: quantos tanques cheios e quanto vai no último (quando sobra área)
  function caldaTxt(a, base, haTq) {
    var s = 'Calda ' + n(a.calda) + ' L/ha';
    if (!haTq) return s;
    s += ' · tanque de ' + n(a.tanque) + ' L = <b>' + n(haTq, 1) + ' ha por tanque</b>';
    if (!base) return s;
    var cheios = Math.floor(base / haTq + 1e-6), resto = base - cheios * haTq;
    if (resto < 0.05) return s + ' · ' + cheios + (cheios === 1 ? ' tanque' : ' tanques');
    return s + ' · ' + cheios + (cheios === 1 ? ' tanque cheio' : ' tanques cheios') + ' + 1 último de <b>' + n(resto * a.calda) + ' L</b> (' + n(resto, 1) + ' ha): ' +
      a.prods.map(function (p) { return esc(p.nome) + ' ' + qtd(total(p.dose * resto, p.unidade)); }).join(' · ');
  }
  function marcados(id) { return Array.prototype.slice.call(document.querySelectorAll('input[data-rec="' + id + '"]:checked')).map(function (c) { return c.value; }); }
  function contar(id) { var b = document.getElementById('bt_' + id); if (!b) return; var k = marcados(id).length; b.disabled = !k; b.textContent = k ? '✔ Marcar aplicado (' + k + (k > 1 ? ' talhões' : ' talhão') + ')' : 'Toque no talhão que você aplicou'; }
  async function desfazer(id, t) {
    if (!confirm('Desfazer a aplicação marcada em ' + t + '?')) return;
    try { await api('/api/portal/aplicar', { rec_id: id, talhoes: [t], desfazer: true }); toast('Desfeito'); await carregar(); }
    catch (e) { toast(e.message); }
  }
  /* ---------- operador: aba Mapa (onde já foi aplicado) ---------- */
  function abasOp() {
    return '<div class="abas">' + [['apl', 'Aplicações'], ['mapa', 'Mapa'], ['cal', 'Calendário']].map(function (x) {
      return '<button data-opa="' + x[0] + '" class="' + (opAba === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }
  // o calendário do operador sempre abre no dia de hoje
  function calHoje() { var h = hoje(); CAL.y = Number(h.slice(0, 4)); CAL.m = Number(h.slice(5, 7)) - 1; CAL.sel = h; }
  function ligarAbasOp() { document.querySelectorAll('[data-opa]').forEach(function (b) { b.onclick = function () { opAba = b.dataset.opa; if (opAba === 'cal') calHoje(); pintar(); window.scrollTo(0, 0); }; }); }
  function calOperador() {
    var ev = eventosCal([]);
    if (!CAL.y) calHoje();
    $('#conteudo').innerHTML = abasOp() + '<h2 class="talhao">Calendário<small>aplicações a fazer e feitas</small></h2>' + calendario(ev, false);
    ligarAbasOp(); ligarCal();
  }
  var COR_ST = { ok: '#2E7D32', pend: '#E08A00', atr: '#C62828' };
  function stTal(a, t) { return t.feito ? 'ok' : (t.data && t.data < hoje()) ? 'atr' : 'pend'; }
  function mapaOperador() {
    var ap = (D.aplicacoes || []).slice().sort(function (x, y) { return (x.status === 'aplicada') - (y.status === 'aplicada') || (x.data < y.data ? -1 : 1); });
    if (opMapa !== '*' && !ap.some(function (x) { return x.id === opMapa; })) opMapa = '*';
    var areas = {}; ((D.mapa && D.mapa.features) || []).forEach(function (f) { var q = f.properties || {}; if (q.nome) areas[q.nome] = Number(q.area_ha) || 0; });
    // situação de cada talhão: numa aplicação escolhida, ou somando todas (pior situação vence)
    var st = {}, det = {}, peso = { atr: 3, pend: 2, ok: 1 };
    ap.forEach(function (x) {
      if (opMapa !== '*' && x.id !== opMapa) return;
      x.tal.forEach(function (t) {
        var s = stTal(x, t);
        var k = t.chave || t.nome;   // em "Todas as fazendas" o talhão leva o nome da fazenda
        if (!st[k] || peso[s] > peso[st[k]]) st[k] = s;
        (det[k] = det[k] || []).push(esc(x.titulo) + ': ' + (s === 'ok' ? 'aplicado ' + dataBR(t.feito) : s === 'atr' ? 'atrasado (prevista ' + dataBR(t.data) + ')' : 'a aplicar' + (t.data ? ' · prevista ' + dataBR(t.data) : '')));
      });
    });
    var ha = { ok: 0, pend: 0, atr: 0 }; Object.keys(st).forEach(function (k) { ha[st[k]] += areas[k] || 0; });
    var h = abasOp() + '<div class="campo-sel"><select id="selOpMapa"><option value="*">Todas as aplicações</option>' + ap.map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (x.id === opMapa ? ' selected' : '') + '>' + esc(x.titulo) + (x.status === 'aplicada' ? ' (aplicada)' : x.data ? ' · ' + dataBR(x.data) : '') + '</option>'; }).join('') + '</select></div>' +
      '<div class="mapa-sat" id="mapaOp"></div>' +
      '<div class="leg"><span><i style="background:' + COR_ST.ok + '"></i>Aplicado · ' + n(ha.ok, 1) + ' ha</span><span><i style="background:' + COR_ST.pend + '"></i>A aplicar · ' + n(ha.pend, 1) + ' ha</span>' +
      '<span><i style="background:' + COR_ST.atr + '"></i>Atrasado · ' + n(ha.atr, 1) + ' ha</span><span><i style="background:#9AA5A0"></i>' + (opMapa === '*' ? 'sem aplicação' : 'fora desta aplicação') + '</span></div>' +
      '<div class="sem" style="font-size:12.5px;margin:4px 2px">' + (opMapa === '*' ? 'Com todas as aplicações, o talhão mostra a situação mais urgente. ' : '') + 'Toque no talhão para ver o detalhe.</div>';
    $('#conteudo').innerHTML = h;
    ligarAbasOp();
    $('#selOpMapa').onchange = function () { opMapa = this.value; pintar(); };
    desenharMapa($('#mapaOp'), function (nm) {
      return st[nm] ? { color: '#FFFFFF', weight: 2, fillColor: COR_ST[st[nm]], fillOpacity: 0.6 } : { color: '#FFFFFF', weight: 1, fillColor: '#9AA5A0', fillOpacity: 0.15 };
    }, function (nm, q) { return '<b>' + esc(nm) + '</b>' + (q.area_ha ? ' · ' + n(q.area_ha, 1) + ' ha' : '') + (det[nm] ? '<br>' + det[nm].join('<br>') : '<br>sem aplicação'); });
  }
  function miniMapa(a) {
    var el = document.getElementById('mm_' + a.id); if (!el) return;
    var st = {}; a.tal.forEach(function (t) { st[t.chave || t.nome] = t.feito ? 'ok' : 'pend'; });
    desenharMapa(el, function (nm) {
      return st[nm] === 'pend' ? { color: '#FFFFFF', weight: 2, fillColor: '#E08A00', fillOpacity: 0.6 }
        : st[nm] === 'ok' ? { color: '#FFFFFF', weight: 2, fillColor: '#2E7D32', fillOpacity: 0.55 }
        : { color: '#FFFFFF', weight: 1, fillColor: '#9AA5A0', fillOpacity: 0.15 };
    }, function (nm, q) { return '<b>' + esc(nm) + '</b>' + (q.area_ha ? '<br>' + n(q.area_ha, 1) + ' ha' : '') + (st[nm] ? '<br>' + (st[nm] === 'ok' ? 'aplicado' : 'a aplicar') : ''); });
  }

  /* ---------- registro mostrado no cartão ---------- */
  function n1(v) { return String(Math.round(Number(v) * 10) / 10).replace('.', ','); }
  function regDe(a, nome) {
    var g = (a.registros || []).filter(function (x) { return (x.talhoes || []).indexOf(nome) >= 0; }).pop();
    if (!g) return '';
    var l = [g.inicio ? g.inicio + (g.fim ? '–' + g.fim : '') : '', g.vento != null ? 'vento ' + n1(g.vento) + ' km/h' : '', g.temp != null ? n1(g.temp) + ' °C' : '', g.umid != null ? n1(g.umid) + '% umid.' : ''].filter(Boolean);
    return '<div class="reg">' + esc(l.join(' · ')) + (g.obs ? (l.length ? '<br>' : '') + '“' + esc(g.obs) + '”' : '') +
      ((g.fotos || []).length ? '<div>' + g.fotos.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt=""></a>'; }).join('') + '</div>' : '') + '</div>';
  }

  /* ---------- folha "Marcar aplicado": só a data é obrigatória ---------- */
  var LIM = { vento: 10, temp: 30, umid: 55 };   // boas práticas de pulverização: só avisa, não impede
  function abrirFolha(id) {
    var a = (D.aplicacoes || []).filter(function (x) { return x.id === id; })[0], tal = marcados(id);
    if (!a || !tal.length) return;
    var sel = a.tal.filter(function (t) { return tal.indexOf(t.nome) >= 0; });
    var ha = sel.reduce(function (s, t) { return s + Math.max(0, t.ha - (t.feitoHa || 0)); }, 0);
    var fotos = [], modo = 'todo', um = sel.length === 1 ? sel[0] : null, falta1 = um ? Math.max(0, um.ha - (um.feitoHa || 0)) : 0;
    var parteHtml = um ? '<div class="seg"><button type="button" data-modo="todo" class="on">Talhão todo · ' + n(falta1, 1) + ' ha</button><button type="button" data-modo="parte">Só uma parte</button></div>' +
        '<div class="campo oculto" id="fParteBox"><label class="l">Hectares aplicados agora *</label><input id="fHa" inputmode="decimal" placeholder="até ' + n(falta1, 1) + ' ha"></div>'
      : '<div class="sem" style="font-size:12.5px;margin:-4px 0 8px">Para lançar só parte de um talhão, marque um talhão por vez.</div>';
    var v = document.createElement('div'); v.className = 'veu';
    v.innerHTML = '<div class="folha"><h3>Marcar aplicado</h3><div class="q">' + esc(a.titulo) + ' · ' + esc(tal.join(', ')) + ' · ' + n(ha, 1) + ' ha</div>' +
      parteHtml +
      '<div class="gdh"><div class="campo"><label class="l">Data *</label><input type="date" id="fData" value="' + hoje() + '" max="' + hoje() + '"></div>' +
      '<div class="campo"><label class="l">Início</label><input type="time" id="fIni"></div><div class="campo"><label class="l">Fim</label><input type="time" id="fFim"></div></div>' +
      '<div class="g3"><div class="campo"><label class="l">Vento (km/h)</label><input id="fVento" inputmode="decimal" placeholder="—"></div>' +
      '<div class="campo"><label class="l">Temp. (°C)</label><input id="fTemp" inputmode="decimal" placeholder="—"></div>' +
      '<div class="campo"><label class="l">Umidade (%)</label><input id="fUmid" inputmode="decimal" placeholder="—"></div></div>' +
      '<div id="fAlerta"></div>' +
      '<div class="fotos" id="fFotos"></div><button type="button" class="addfoto" id="fAdd">📷 Adicionar foto (opcional)</button>' +
      '<input type="file" id="fArq" accept="image/*" capture="environment" class="oculto">' +
      '<div class="campo" style="margin-top:10px"><label class="l">Observação (opcional)</label><textarea id="fObs" rows="2" placeholder="ex.: parei 20 min por garoa"></textarea></div>' +
      '<button class="btn" id="fOk">✔ Confirmar aplicação</button><button class="btn sec" id="fNao">Cancelar</button></div>';
    document.body.appendChild(v);
    v.querySelectorAll('[data-modo]').forEach(function (bt) { bt.onclick = function () {
      modo = bt.dataset.modo; v.querySelectorAll('[data-modo]').forEach(function (x) { x.classList.toggle('on', x === bt); });
      v.querySelector('#fParteBox').classList.toggle('oculto', modo !== 'parte'); if (modo === 'parte') v.querySelector('#fHa').focus();
    }; });
    var val = function (i) { var x = String(v.querySelector(i).value || '').replace(',', '.').trim(); return x === '' ? '' : Number(x); };
    var avisar = function () {
      var al = [], ve = val('#fVento'), te = val('#fTemp'), um = val('#fUmid');
      if (ve !== '' && ve > LIM.vento) al.push('vento acima de ' + LIM.vento + ' km/h');
      if (te !== '' && te > LIM.temp) al.push('temperatura acima de ' + LIM.temp + ' °C');
      if (um !== '' && um < LIM.umid) al.push('umidade abaixo de ' + LIM.umid + '%');
      v.querySelector('#fAlerta').innerHTML = al.length ? '<div class="alerta">⚠ Clima fora do ideal: ' + al.join(', ') + '. Pode registrar mesmo assim.</div>' : '';
    };
    ['#fVento', '#fTemp', '#fUmid'].forEach(function (i) { v.querySelector(i).addEventListener('input', avisar); });
    v.querySelector('#fAdd').onclick = function () { if (fotos.length >= 3) { toast('Até 3 fotos por aplicação'); return; } v.querySelector('#fArq').click(); };
    v.querySelector('#fArq').onchange = async function () {
      var f = this.files && this.files[0]; this.value = ''; if (!f) return;
      try { var b = await reduzir(f); fotos.push(b); v.querySelector('#fFotos').innerHTML = fotos.map(function (x) { return '<img src="' + URL.createObjectURL(x) + '" alt="">'; }).join(''); }
      catch (e) { toast('Não deu para usar essa foto'); }
    };
    v.querySelector('#fNao').onclick = function () { v.remove(); };
    v.querySelector('#fOk').onclick = async function () {
      var dt = v.querySelector('#fData').value;
      if (!dt) { toast('Informe a data da aplicação'); return; }
      if (dt > hoje()) { toast('A data não pode ser no futuro'); return; }
      var haParte = 0;
      if (modo === 'parte') {
        haParte = Number(String(v.querySelector('#fHa').value || '').replace(',', '.'));
        if (!(haParte > 0)) { toast('Informe quantos hectares aplicou'); return; }
        if (haParte > falta1 + 0.05) { toast('Passa do que falta no talhão (' + n(falta1, 1) + ' ha)'); return; }
      }
      var item = { ha: haParte || undefined, id: 'rg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), rec_id: id, talhoes: tal, data: dt, em: new Date().toISOString(),
        registro: { inicio: v.querySelector('#fIni').value, fim: v.querySelector('#fFim').value, vento: val('#fVento'), temp: val('#fTemp'), umid: val('#fUmid'), obs: v.querySelector('#fObs').value.trim() },
        fotos: fotos, fazenda: $('#selFaz').value };
      this.disabled = true;
      // o Safari do iPhone às vezes recusa guardar Blob: guarda os bytes da foto
      item.fotos = await Promise.all(fotos.map(function (b) { return b.arrayBuffer().then(function (buf) { return { buf: buf, tipo: b.type || 'image/jpeg' }; }); }));
      await filaPor(item);          // guarda primeiro: sem internet nada se perde
      selec[id] = [];
      v.remove();
      await sobreporFila(); pintar(); faixa();
      var ok = await enviarFila();
      toast(ok ? '✔ Aplicação registrada. O consultor já vê no app.' : '✔ Guardado no celular. Envia sozinho quando tiver internet.');
    };
  }
  // foto menor antes de guardar/enviar (até 1600 px, JPEG)
  function reduzir(arq) {
    return new Promise(function (ok, falha) {
      var u = URL.createObjectURL(arq), im = new Image();
      im.onload = function () {
        var e = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * e); c.height = Math.round(im.naturalHeight * e);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? ok(b) : falha(new Error('foto')); }, 'image/jpeg', 0.8);
      };
      im.onerror = function () { URL.revokeObjectURL(u); falha(new Error('foto')); };
      im.src = u;
    });
  }

  /* ---------- fila sem internet (IndexedDB: guarda também as fotos) ---------- */
  var dbP = null;
  function db() {
    if (!dbP) dbP = new Promise(function (ok, falha) {
      var r = indexedDB.open('amvs-portal', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('fila', { keyPath: 'id' }); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { falha(r.error); };
    });
    return dbP;
  }
  function loja(modo, fn) { return db().then(function (d) { return new Promise(function (ok, falha) { var t = d.transaction('fila', modo), s = t.objectStore('fila'), r = fn(s); t.oncomplete = function () { ok(r && r.result); }; t.onerror = function () { falha(t.error); }; }); }); }
  function filaPor(item) { return loja('readwrite', function (s) { return s.put(item); }); }
  function filaTudo() { return loja('readonly', function (s) { return s.getAll(); }).then(function (l) { return (l || []).sort(function (a, b) { return a.em < b.em ? -1 : 1; }); }).catch(function () { return []; }); }
  function filaTirar(id) { return loja('readwrite', function (s) { return s.delete(id); }); }
  function filaLimpar() { return loja('readwrite', function (s) { return s.clear(); }); }

  // o que está na fila aparece como aplicado (⏳) até subir
  async function sobreporFila() {
    if (!D || !D.aplicacoes) return;
    var f = await filaTudo();
    f.forEach(function (it) {
      var a = D.aplicacoes.filter(function (x) { return x.id === it.rec_id; })[0]; if (!a) return;
      a.tal.forEach(function (t) {
        if (it.talhoes.indexOf(t.nome) < 0 || t.feito) return;
        if (it.ha && (t.feitoHa || 0) + it.ha < t.ha - 0.05) { t.feitoHa = (t.feitoHa || 0) + it.ha; (t.parc = t.parc || []).push({ id: it.id, d: it.data, ha: it.ha, fila: it.id }); return; }
        t.feito = it.data; t.fila = it.id;
      });
      var pend = a.tal.filter(function (t) { return !t.feito; }).length;
      a.status = !pend ? 'aplicada' : pend < a.tal.length ? 'andamento' : 'pendente';
    });
  }
  var enviando = false;
  async function enviarFila() {
    if (enviando || !tok) return false;
    enviando = true;
    var tudoOk = true;
    try {
      var f = await filaTudo();
      for (var i = 0; i < f.length; i++) {
        var it = f[i], chaves = [];
        try {
          for (var k = 0; k < (it.fotos || []).length; k++) {
            var fo = it.fotos[k], blob = fo instanceof Blob ? fo : new Blob([fo.buf], { type: fo.tipo || 'image/jpeg' });
            var r = await api('/api/portal/foto', blob, { headers: { 'Content-Type': 'image/jpeg', 'X-Foto-Id': it.id + 'f' + k } });
            chaves.push(r.midia);
          }
          var reg = Object.assign({}, it.registro, { fotos: chaves });
          await api('/api/portal/aplicar', { rec_id: it.rec_id, talhoes: it.talhoes, data: it.data, reg_id: it.id, em: it.em, registro: reg, ha: it.ha || undefined });
          await filaTirar(it.id);
        } catch (e) {
          tudoOk = false;
          if (e.rede) break;                   // sem sinal: tenta de novo depois
          await filaTirar(it.id);              // recusado pelo servidor (ex.: já aplicado por outro): avisa e tira
          toast('Não foi possível registrar ' + it.talhoes.join(', ') + ': ' + e.message);
        }
      }
    } finally { enviando = false; }
    if (f && f.length && D) { await carregarQuieto(); }
    faixa();
    return tudoOk;
  }
  async function cancelarFila(id) {
    if (!confirm('Cancelar esta marcação que ainda não foi enviada?')) return;
    await filaTirar(id); await carregarQuieto();
  }
  async function carregarQuieto() { try { await carregar($('#selSafra').value || undefined); } catch (e) {} }
  async function faixa() {
    var el = $('#faixa'); if (!el) return;
    var nf = (await filaTudo()).length, sem = semRede || !navigator.onLine;
    var t = [];
    if (sem) t.push('📶 Sem internet · mostrando os dados guardados neste celular');
    if (nf) t.push('⏳ ' + nf + (nf > 1 ? ' marcações esperando' : ' marcação esperando') + ' internet para enviar');
    el.textContent = t.join(' · ');
    el.className = 'faixa' + (nf ? ' am' : '') + (t.length ? '' : ' oculto');
  }
  window.addEventListener('online', function () { enviarFila(); });
  window.addEventListener('offline', faixa);
  setInterval(function () { if (navigator.onLine) filaTudo().then(function (f) { if (f.length) enviarFila(); }); }, 30000);

  /* ---------- aviso no celular (5h00) ---------- */
  function pushPossivel() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function instalado() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function perguntado() { try { return !!localStorage.getItem(CH + ':push'); } catch (e) { return false; } }
  function cartaoPush() {
    if (!eu || eu.papel !== 'operador' || perguntado()) return '';
    if (pushPossivel() && Notification.permission !== 'default') return '';
    if (!pushPossivel()) {
      if (!/iPhone|iPad|iPod/.test(navigator.userAgent) || instalado()) return '';
      return '<div class="push">🔔 Para receber às 5h o aviso das aplicações do dia: no Safari toque em <b>Compartilhar → Adicionar à Tela de Início</b> e abra pelo ícone <b>AMVS Fazenda</b>.</div>';
    }
    return '<div class="push"><span>🔔 Receba às 5h da manhã, no celular, as aplicações do dia — mesmo com o portal fechado.</span><button class="btn" id="btnPush">Receber avisos</button></div>';
  }
  function chaveBytes(b) { var x = String(b).replace(/-/g, '+').replace(/_/g, '/'), bin = atob(x + '==='.slice((x.length + 3) % 4)), o = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; }
  async function assinarPush() {
    var reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (!sub) { var k = await api('/api/portal/push/chave'); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(k.chave) }); }
    await api('/api/portal/push/assinar', { assinatura: sub.toJSON() });
  }
  function ativarAvisos() {
    try { localStorage.setItem(CH + ':push', '1'); } catch (e) {}   // pergunta uma vez só
    Notification.requestPermission().then(async function (p) {
      if (p !== 'granted') { toast('Avisos bloqueados. Dá para liberar nos Ajustes do celular.'); pintar(); return; }
      try { await assinarPush(); toast('🔔 Pronto! Às 5h chegam as aplicações do dia.'); } catch (e) { toast('Não deu para ligar os avisos: ' + e.message); }
      pintar();
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/portal-sw.js', { scope: '/portal' }).catch(function () {});
    navigator.serviceWorker.addEventListener('message', function (ev) { if (ev.data && ev.data.abrir === 'fazer') { filtro = 'fazer'; if (D) pintar(); } });
  }
  if (/[?&]aba=fazer/.test(location.search)) { filtro = 'fazer'; try { history.replaceState(null, '', '/portal'); } catch (e) {} }
  // sessão guardada: abre mesmo sem internet (dados do aparelho); só sai se o servidor recusar o login
  if (tok) iniciar().then(function () {
    if (eu) enviarFila();   // o que ficou guardado sem internet (operador ou gerente)
    if (eu && eu.papel === 'operador') {
      if (pushPossivel() && Notification.permission === 'granted' && navigator.onLine) assinarPush().catch(function () {});
    }
  }).catch(function (e) {
    if (e && e.rede) { $('#telaLogin').classList.add('oculto'); $('#telaApp').classList.remove('oculto'); $('#conteudo').innerHTML = '<div class="vazio">Sem internet e o portal ainda não foi aberto neste celular com sinal. Abra uma vez com internet.</div>'; }
  });
})();
</script>
</body></html>`;
}
