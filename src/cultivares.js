/* ============================================================
   cultivares.js — catálogo de cultivares de soja por empresa (safra 2025/26 – 2026/27)
   Cada material: [nome, GMR, ciclo publicado (dias após a emergência no MT)] quando a empresa
   publica o grupo de maturação; ou [nome, 0, faixa ZARC] quando só consta na lista oficial do
   MAPA para Mato Grosso (faixa I = GMR < 7.9, II = 7.9 a 8.5, III = > 8.5 na macrorregião 4).
   Quando a empresa separa o GMR por região, vale o da macrorregião 4 (MT).
   Fontes (FONTES_CULT): sites e catálogos oficiais das empresas e a Portaria SPA/MAPA nº 372/2025.
   ============================================================ */

export const FONTES_CULT = {
  bmx: 'brasmaxgenetica.com.br/cultivares',
  tmg: 'tmg.agr.br/cultivares/soja',
  neo: 'Folders Neogen Cerrado e Sul 2026/27 e neogensementes.com.br',
  ns: 'Catálogos Nidera 2025 (Norte/Nordeste e Sul/Sudeste)',
  basf: 'Guia de variedades BASF Soytech 2026 Centro-Norte',
  bs: 'Fichas técnicas Boa Safra Sementes 2026/27',
  zarc: 'ZARC soja MT 2025/26 (Portaria SPA/MAPA nº 372)'
};

// faixa ZARC → GMR aproximado (meio da faixa para o MT), usado só enquanto o GMR exato não é informado
export const GMR_FAIXA = { I: 7.5, II: 8.2, III: 8.7 };

export const CATALOGO = [
  ["Brasmax", ["bmx"], [
    ["BMX Ataque I2X", 8.2, 116], ["BMX Batalha CE", 6.8], ["BMX Bonus IPRO", 7.9, 109], ["BMX Ápice I2X", 7.5],
    ["BMX Cártago I2X", 6.5], ["BMX Clássica IPRO", 6.1], ["BMX Fera I2X", 6.4], ["BMX Grafeno CE", 5.7],
    ["BMX Hera I2X", 8.0, 112], ["BMX Invicta I2X", 8.3], ["BMX Míssil I2X", 7.3, 103], ["BMX Olimpo IPRO", 8.0, 110],
    ["BMX Orion I2X", 5.5], ["BMX Imune I2X", 5.3], ["BMX Ciclone CE", 8.1, 111], ["BMX Cobre I2X", 7.7, 106],
    ["BMX Coliseu I2X", 6.3], ["BMX Compacta IPRO", 6.5], ["BMX Cromo IPRO", 5.6], ["BMX Cruzada CE", 7.8],
    ["BMX Desafio RR", 7.4, 103], ["BMX Domínio IPRO", 8.4], ["BMX Exata I2X", 6.5], ["BMX Extrema IPRO", 8.1, 112],
    ["BMX Fibra IPRO", 6.4], ["BMX Foco IPRO", 7.2, 98], ["BMX Fúria CE", 6.5], ["BMX Guepardo IPRO", 6.9, 98],
    ["BMX Ímpeto I2X", 9.0], ["BMX Lança IPRO", 5.8], ["BMX Lotus IPRO", 6.1], ["BMX Mítica CE", 7.7, 111],
    ["BMX Nexus I2X", 6.5], ["BMX Raça E", 6.3], ["BMX Raptor I2X", 7.1, 103], ["BMX Sparta I2X", 8.0, 114],
    ["BMX Supera I2X", 7.3], ["BMX Tanque I2X", 7.5, 102], ["BMX Titanium I2X", 5.8], ["BMX Tormenta CE", 7.6, 103],
    ["BMX Torpedo I2X", 6.2], ["BMX Torque I2X", 5.7], ["BMX Trovão I2X", 5.2], ["BMX Vênus CE", 5.7],
    ["BMX Zeus IPRO", 5.5]
  ]],
  ["Neogen", ["neo"], [
    ["NEO 550 I2X", 5.5], ["NEO 780 CE", 7.8, 110], ["NEO 791 CE", 7.9], ["NEO 811 I2X", 8.1],
    ["NEO 821 I2X", 8.2], ["NEO 700 I2X", 7.0, 101], ["NEO 771 I2X", 7.7, 106], ["NEO 801 CE", 8.1, 113],
    ["NEO 802 I2X", 8.1, 114], ["NEO 640 I2X", 6.4], ["NEO 690 I2X", 7.1, 97], ["NEO 800 I2X", 8.0, 114],
    ["NEO 680 IPRO", 6.8], ["NEO 720 I2X", 7.4, 101], ["NEO 740 IPRO", 7.7], ["NEO 760 CE", 7.6, 103], ["NEO 761 I2X", 7.6, 101],
    ["NEO 790 IPRO", 7.9, 109], ["NEO 810 I2X", 8.2, 116], ["NEO 820 IPRO", 8.2, 114], ["NEO 840 IPRO", 8.4, 116],
    ["NEO 600 I2X", 6.0], ["NEO 531 I2X", 5.3], ["NEO 581 E", 5.8], ["NEO 620 IPRO", 6.2],
    ["NEO 661 I2X", 6.6], ["NEO 510 IPRO", 5.1], ["NEO 560 IPRO", 5.6], ["NEO 580 IPRO", 5.9],
    ["NEO 590 I2X", 5.9], ["NEO 610 IPRO", 6.1]
  ]],
  ["TMG", ["tmg", "zarc"], [
    ["TMG Itaúba I2X", 7.9], ["TMG Sucupira E", 6.7], ["TMG Baru I2X", 7.5], ["TMG Castanheira I2X", 8.3],
    ["TMG Gurucaia I2X", 5.1], ["TMG Pitangueira I2X", 5.9], ["TMG Imbuia I2X", 6.1], ["TMG Cambuí I2X", 6.3],
    ["TMG Guapuruvu CE", 5.0], ["TMG Manacá XTD", 6.3], ["TMG Guanandi I2X", 6.6], ["TMG Ingá I2X", 6.9],
    ["TMG Canjerana I2X", 7.2], ["TMG Paineira I2X", 7.3], ["TMG Jenipapeiro I2X", 7.3], ["TMG Jacareúba E", 7.4],
    ["TMG Murici I2X", 7.6], ["TMG Bálsamo I2X", 7.6], ["TMG Jatobá I2X", 8.1], ["TMG Braúna I2X", 8.2],
    ["TMG Copaíba I2X", 8.4], ["TMG 6123 IPRO", 6.1], ["TMG 22X83 I2X", 8.3], ["TMG 22X77 I2X", 7.7],
    ["TMG 22X73 I2X", 7.3], ["TMG 22X65 I2X", 6.5], ["TMG 22X57 I2X", 5.7], ["TMG 22E70 CE", 7.0],
    ["TMG 2264 IPRO", 6.4], ["TMG 7362 IPRO", 6.8], ["TMG 2360 IPRO", 6.7], ["TMG 2165 IPRO", 6.5],
    ["TMG 2757 IPRO", 5.7], ["TMG 2370 IPRO", 7.0], ["TMG 2372 IPRO", 7.2], ["TMG 2374 IPRO", 7.4],
    ["TMG 2776 IPRO", 7.6], ["TMG 2376 IPRO", 7.6], ["TMG 2378 IPRO", 7.8], ["TMG 2379 IPRO", 7.9],
    ["TMG 2381 IPRO", 8.1], ["TMG 2383 IPRO", 8.3], ["TMG 2285 IPRO", 8.5], ["TMG 2286 IPRO", 8.6],
    ["TMG 7067 IPRO", 7.0], ["TMG 7061 IPRO", 6.1], ["TMG 7062 IPRO", 6.2], ["TMG 7063 IPRO", 7.0],
    ["TMG 7368 IPRO", 7.3], ["TMG 1155 RR", 5.5], ["TMG 7262 RR", 6.0], ["TMG 7363 RR", 6.3],
    ["TMG 1188 RR", 8.8], ["TMG 4182", 8.2], ["TMG 7260 IPRO", 0, "I"], ["TMG 2173 IPRO", 0, "I"],
    ["TMG 4377", 0, "I"], ["TMG 21X71 XTD", 0, "I"], ["TMG 2181 IPRO", 0, "II"]
  ]],
  ["Nidera", ["ns", "zarc"], [
    ["NS 8025 I2X", 8.0], ["NS 7224 I2X", 7.1], ["NS 7524 IPRO", 7.8], ["NS 8325 IPRO", 8.3],
    ["NS 7902 IPRO", 7.7], ["NS 6446 I2X", 7.0], ["NS 8080 IPRO", 8.0], ["NS 7676 IPRO", 7.7],
    ["NS 6595 I2X", 6.5], ["NS 5624 I2X", 5.6], ["NS 5922 IPRO", 5.9], ["NS 6601 IPRO", 6.6],
    ["NS 5252 I2X", 5.2], ["NS 7474 IPRO", 0, "I"], ["NA 5909 RG", 0, "I"], ["NS 7300 IPRO", 0, "I"],
    ["NS 7209 IPRO", 0, "I"], ["NS 7000 IPRO", 0, "I"], ["NS 7237 IPRO", 0, "I"], ["NS 7338 IPRO", 0, "I"],
    ["NS 7114", 0, "I"], ["NS 7670", 0, "I"], ["NS 7494", 0, "I"], ["NS 7011 IPRO", 0, "I"],
    ["NS 7497 RR", 0, "I"], ["NS 7225 IPRO", 0, "I"], ["NS 6906 IPRO", 0, "I"], ["NS 6828 IPRO", 0, "I"],
    ["NS 7447 IPRO", 0, "I"], ["NS 7667 IPRO", 0, "I"], ["NS 7505 IPRO", 0, "I"], ["NS 7202 IPRO", 0, "I"],
    ["NS 7780 IPRO", 0, "I"], ["NS 7007 IPRO", 0, "I"], ["NS 7709 IPRO", 0, "I"], ["NS 6990 IPRO", 0, "I"],
    ["NS 7700 IPRO", 0, "I"], ["NS 7399 IPRO", 0, "I"], ["NS 7790 IPRO", 0, "I"], ["NS 6909 IPRO", 0, "I"],
    ["NS 6220 IPRO", 0, "I"], ["NS 7654 IPRO", 0, "I"], ["NS 7555 IPRO", 0, "I"], ["NA 7337 RR", 0, "I"],
    ["NS 7227", 0, "I"], ["NS 7200", 0, "I"], ["NS 6299 IPRO", 0, "I"], ["NS 6700 IPRO", 0, "I"],
    ["NS 5933 IPRO", 0, "I"], ["NS 8525", 0, "II"], ["NS 8094 RR", 0, "II"], ["NS 8383 RR", 0, "II"],
    ["NS 8300 IPRO", 0, "II"], ["NS 8400 IPRO", 0, "II"], ["NS 8397 IPRO", 0, "II"], ["NS 8590 IPRO", 0, "II"],
    ["NS 8595 IPRO", 0, "II"], ["NS 8109 IPRO", 0, "II"], ["NS 7933 CE", 0, "II"], ["NS 8270", 0, "II"],
    ["NS 7901", 0, "II"], ["NS 8440 IPRO", 0, "II"], ["NS 8693", 0, "III"]
  ]],
  ["Monsoy", ["bs", "zarc"], [
    ["M 5710 I2X", 5.8], ["M 6202 I2X", 6.2], ["M 6330 I2X", 6.3], ["M 6410 IPRO", 6.4],
    ["M 6620 I2X", 6.6], ["M 7222 I2X", 7.2], ["M 7535 I2X", 7.5], ["M 7601 I2X", 7.6],
    ["M 8220 I2X", 8.2], ["M 8606 I2X", 8.6], ["M 7198 IPRO", 0, "I"], ["M 7110 IPRO", 0, "I"],
    ["M 7739 IPRO", 0, "I"], ["M 6210 IPRO", 0, "I"], ["M 6801 I2X", 0, "I"], ["M 6802 XTD", 0, "I"],
    ["M 6601 I2X", 0, "I"], ["M 7803 I2X", 0, "I"], ["M 6501 I2X", 0, "I"], ["M 7272 I2X", 0, "I"],
    ["M 7806 I2X", 0, "I"], ["M 6930 I2X", 0, "I"], ["M 8372 IPRO", 0, "II"], ["M 8349 IPRO", 0, "II"],
    ["M 8210 IPRO", 0, "II"], ["M 8001 I2X", 0, "II"], ["M 8301 XTD", 0, "II"], ["M 8104 I2X", 0, "II"],
    ["M 8202 I2X", 0, "II"], ["M 8303 I2X", 0, "II"], ["M 8504 I2X", 0, "II"], ["M 8105 I2X", 0, "II"],
    ["M 8401 I2X", 0, "II"], ["M 8808 IPRO", 0, "III"], ["M 8644 IPRO", 0, "III"], ["M-SOY 9350", 0, "III"],
    ["M 8603 I2X", 0, "III"], ["M 8605 XTD", 0, "III"]
  ]],
  ["Soytech (BASF)", ["basf", "bs", "zarc"], [
    ["ST 767 TF I2X", 7.6], ["ST 798 I2X", 7.9], ["ST 808 I2X", 8.0], ["ST 616 I2X", 6.1],
    ["ST 711 I2X", 7.1], ["ST 745 I2X", 7.4], ["ST 752 I2X", 7.5], ["ST 822 I2X", 8.2],
    ["ST 828 I2X", 8.2], ["ST 570 I2X", 5.7], ["ST 655 I2X", 6.5], ["ST 670 I2X", 6.7],
    ["ST 644 IPRO", 0, "I"], ["ST 783 IPRO", 0, "I"], ["ST 700 I2X", 0, "I"], ["ST 622 IPRO", 0, "I"],
    ["ST 621 I2X", 0, "I"], ["ST 722 XTD", 0, "I"], ["ST 641 I2X", 0, "I"], ["ST 804 IPRO", 0, "II"],
    ["ST 830 IPRO", 0, "II"], ["ST 812 IPRO", 0, "II"], ["ST 797 IPRO", 0, "II"]
  ]],
  ["Credenz (BASF)", ["zarc"], [
    ["CZ 26B10 IPRO", 0, "I"], ["CZ 37B51 IPRO", 0, "I"], ["CZ 26B47 I2X", 0, "I"], ["CZ 37B07 I2X", 0, "I"],
    ["CZ 37B66 I2X", 0, "I"], ["CZ 37B43 IPRO", 0, "I"], ["CZ 36B96 I2X", 0, "I"], ["CZ 37B39 I2X", 0, "I"],
    ["CZ 37B60 IPRO", 0, "I"], ["CZ 47B74 I2X", 0, "I"], ["CZ 48B18 IPRO", 0, "II"], ["CZ 48B08 I2X", 0, "II"],
    ["CZ 58B48 I2X", 0, "II"], ["CZ 58B28 IPRO", 0, "II"], ["CZ 47B90 IPRO", 0, "II"], ["CZ 58B23 I2X", 0, "II"],
    ["CZ 48B01 I2X", 0, "II"], ["CZ 47B91 I2X", 0, "II"], ["CZ 58B44 I2X", 0, "II"]
  ]],
  ["Syngenta", ["zarc"], [
    ["SYN 1059 RR", 0, "I"], ["SYN 1163 RR", 0, "I"], ["SYN 1263 RR", 0, "I"], ["SYN 1360C IPRO", 0, "I"],
    ["SYN 13610 IPRO", 0, "I"], ["SYN 13670 IPRO", 0, "I"], ["SYN 13561 IPRO", 0, "I"], ["SYN 1366C IPRO", 0, "I"],
    ["SYN 13671 IPRO", 0, "I"], ["SYN 1359S IPRO", 0, "I"], ["SYN 15640 IPRO", 0, "I"], ["SYN 1562 IPRO", 0, "I"],
    ["SYN 7740 IPRO", 0, "I"], ["NK 7701 IPRO", 0, "I"], ["NK 7201 IPRO", 0, "I"], ["NK 7777 IPRO", 0, "I"],
    ["NK 7730 CE", 0, "I"], ["SYN 2376 IPRO", 0, "I"], ["SYN 9070 RR", 0, "I"], ["NK 7600 IPRO", 0, "I"],
    ["NK 7010 IPRO", 0, "I"], ["SYN 1183 RR", 0, "II"], ["SYN 1285 RR", 0, "II"], ["SYN 1281 RR", 0, "II"],
    ["SYN 1378C IPRO", 0, "II"], ["SYN 13840 IPRO", 0, "II"], ["SYN 13850 IPRO", 0, "II"], ["SYN 13842R IPRO", 0, "II"],
    ["SYN 1387 RR", 0, "II"], ["SYN 1385 RR", 0, "II"], ["SYN 1585 IPRO", 0, "II"], ["SYN 1683 IPRO", 0, "II"],
    ["SYN 1684 IPRO", 0, "II"], ["SYN 1685 IPRO", 0, "II"], ["SYN 1785 IPRO", 0, "II"], ["NK 8401 IPRO", 0, "II"],
    ["NK 8301 IPRO", 0, "II"], ["NK 8448 IPRO", 0, "II"], ["SYN 2083 IPRO", 0, "II"], ["SYN 2384 IPRO", 0, "II"],
    ["NK 8100 IPRO", 0, "II"], ["SYN 2282 IPRO", 0, "II"], ["SYN 2478 IPRO", 0, "II"], ["SYN 13870 IPRO", 0, "III"],
    ["SYN 1686 IPRO", 0, "III"], ["SYN 16861 IPRO", 0, "III"], ["SYN 1687 IPRO", 0, "III"], ["NK 8770 IPRO", 0, "III"]
  ]],
  ["Golden Harvest (Syngenta)", ["bs", "zarc"], [
    ["GH 2463 I2X", 6.3], ["GH 2473 I2X", 7.3], ["GH 2478 IPRO", 7.9], ["GH 2483 IPRO", 8.1],
    ["GH 2564 I2X", 6.4], ["GH 2566 I2X", 6.5], ["GH 2581 I2X", 8.1], ["GH 5933 IPRO", 6.0],
    ["GH 6700 IPRO", 6.9], ["GH 2275 I2X", 0, "I"]
  ]],
  ["Pioneer", ["zarc"], [
    ["96R10 IPRO", 0, "I"], ["96Y90", 0, "I"], ["97R50 IPRO", 0, "I"], ["96R29 IPRO", 0, "I"],
    ["97Y70 CE", 0, "I"], ["97Y91 IPRO", 0, "II"], ["97Y97 IPRO", 0, "II"], ["98Y21 IPRO", 0, "II"],
    ["98R30 CE", 0, "II"], ["99R09", 0, "III"]
  ]],
  ["Brevant (Corteva)", ["zarc"], [
    ["DS7417 IPRO", 0, "I"], ["B74C22", 0, "I"], ["B75C22", 0, "I"], ["B72C22", 0, "I"],
    ["B64C22", 0, "I"], ["B66C22", 0, "I"], ["B76C23", 0, "I"], ["B5830 CE", 0, "II"],
    ["B80C23", 0, "II"]
  ]],
  ["Cordius (Corteva)", ["bs", "zarc"], [
    ["C2790 CE", 7.9], ["C2570 RR", 0, "I"], ["C2732 IPRO", 0, "I"], ["C2600 IPRO", 0, "I"],
    ["C2740 CE", 0, "I"], ["C2775 E", 0, "I"], ["C2680 E", 0, "I"], ["C2800 IPRO", 0, "II"],
    ["C2795 CE", 0, "II"], ["C2810 CE", 0, "II"]
  ]],
  ["Stine", ["zarc"], [
    ["76KA72", 0, "I"]
  ]],
  ["Embrapa", ["zarc"], [
    ["BRS 7480 RR", 0, "I"], ["BRS 7380 RR", 0, "I"], ["BRS 284", 0, "I"], ["BRS 6680", 0, "I"],
    ["BRS 6980", 0, "I"], ["BRS 7581 RR", 0, "I"], ["BRS 1003 IPRO", 0, "I"], ["BRS 7481", 0, "I"],
    ["BRS 5980 IPRO", 0, "I"], ["BRS 7180 IPRO", 0, "I"], ["BRS 511", 0, "I"], ["BRS 573", 0, "I"],
    ["BRSMG 534", 0, "I"], ["BRS 7582", 0, "I"], ["BRS 7881 IPRO", 0, "I"], ["BRS 774 RR", 0, "I"],
    ["BRS 1061 IPRO", 0, "I"], ["BRS 1075 IPRO", 0, "I"], ["BRS 7980", 0, "II"], ["BRS 8280 RR", 0, "II"],
    ["BRS 8381", 0, "II"], ["BRS 8480", 0, "II"], ["MG/BR 46 (Conquista)", 0, "II"], ["BRS 8581", 0, "II"],
    ["BRS 8481", 0, "II"], ["BRS 8780", 0, "III"], ["BRS Sambaíba", 0, "III"], ["BRSMT Uirapuru", 0, "III"],
    ["BRS 8781 RR", 0, "III"], ["BRS 9280 RR", 0, "III"]
  ]],
  ["KWS", ["zarc"], [
    ["RK6813 RR", 0, "I"], ["RK7214 IPRO", 0, "I"], ["RK8115 IPRO", 0, "I"], ["RK7518 IPRO", 0, "I"],
    ["RK6719 IPRO", 0, "I"], ["K78C21", 0, "I"], ["K7323 I2X", 0, "I"], ["RK8317 IPRO", 0, "II"],
    ["K7922 IPRO", 0, "II"]
  ]],
  ["LG Sementes", ["zarc"], [
    ["L60177 IPRO", 0, "I"], ["L60174 IPRO", 0, "I"], ["L60162 IPRO", 0, "I"], ["LG60179 IPRO", 0, "I"],
    ["LG60175 RR", 0, "I"], ["LG60263 IPRO", 0, "I"], ["LG60165 IPRO", 0, "I"], ["LG60262 IPRO", 0, "I"],
    ["L60184 IPRO", 0, "II"], ["L60180 IPRO", 0, "II"]
  ]],
  ["Agroeste", ["zarc"], [
    ["AS 3680 IPRO", 0, "I"], ["AS 3730 IPRO", 0, "I"], ["AS 3715 I2X", 0, "I"], ["AS 3720 I2X", 0, "I"],
    ["AS 3850 IPRO", 0, "II"], ["AS 3810 IPRO", 0, "II"], ["AS 3840 I2X", 0, "II"]
  ]],
  ["FTS Sementes", ["zarc"], [
    ["FTR 4153 IPRO", 0, "I"], ["FTR 2161 RR", 0, "I"], ["FTR 3165 IPRO", 0, "I"], ["FTR 3868 IPRO", 0, "I"],
    ["FTR 4262 IPRO", 0, "I"], ["FTR 2660 IPRO", 0, "I"], ["FTR 1936M IPRO", 0, "I"], ["FTR 2155 RR", 0, "I"],
    ["FTR 2557 RR", 0, "I"], ["FTR 1157 RR", 0, "I"], ["FTR 158 RR", 0, "I"], ["FTR 2858 IPRO", 0, "I"],
    ["FTR 286C IPRO", 0, "I"], ["FTR 486C IPRO", 0, "I"], ["FTR 166M IPRO", 0, "I"], ["FTR 2065 RR", 0, "I"],
    ["FTR 1155 RR", 0, "I"], ["FTR 4462 I2X", 0, "I"], ["FTR 4664 I2X", 0, "I"], ["FTR 2266 I2X", 0, "I"],
    ["FTR 1060 XTD", 0, "I"], ["FTR 1662 XTD", 0, "I"], ["FTR 3771 IPRO", 0, "I"], ["FTR 477M I2X", 0, "I"],
    ["FTR 366M IPRO", 0, "I"], ["FTR 296L IPRO", 0, "I"], ["FTR 327C IPRO", 0, "I"], ["FTR 367M IPRO", 0, "I"],
    ["FTR 337M IPRO", 0, "I"], ["FTR 416M I2X", 0, "I"], ["FTR 216L I2X", 0, "I"], ["FTR 466L IPRO", 0, "I"],
    ["FTR 227M IPRO", 0, "I"], ["FTR 177L IPRO", 0, "I"], ["FTR 455 IPRO", 0, "I"], ["FTR 4060 I2X", 0, "I"],
    ["FTR 4363 I2X", 0, "I"], ["FTR 1959 RR", 0, "I"], ["FTR 2669 I2X", 0, "I"], ["FTR 4772 I2X", 0, "I"],
    ["FTR 2775 I2X", 0, "I"], ["FTR 2277 I2X", 0, "I"], ["FTR 1177 I2X", 0, "I"], ["FTR 4878 I2X", 0, "I"],
    ["FTS GRACIOSA RR", 0, "II"], ["FTR 2182 IPRO", 0, "II"], ["FTR 4280 IPRO", 0, "II"], ["FTR 4182 IPRO", 0, "II"],
    ["FTR 3179 IPRO", 0, "II"], ["FTR 4181 IPRO", 0, "II"], ["FTR 3282 IPRO", 0, "II"], ["FTR 1282 XTD", 0, "II"],
    ["FTR 4882 IPRO", 0, "II"], ["FTR 297L IPRO", 0, "II"], ["FTR 417L I2X", 0, "II"], ["FTR 338C IPRO", 0, "II"],
    ["FTR 1979 I2X", 0, "II"], ["FTR 4181 I2X", 0, "II"], ["FTR 3383 I2X", 0, "II"], ["FTS PARAGOMINAS RR", 0, "III"],
    ["FTR 3190 IPRO", 0, "III"], ["FTR 4288 IPRO", 0, "III"], ["FTR 3191 IPRO", 0, "III"], ["FTS 4188", 0, "III"],
    ["FTR 4887 IPRO", 0, "III"], ["FTR 3388 I2X", 0, "III"], ["FTR 3387 IPRO", 0, "III"]
  ]],
  ["Seedcorp|HO", ["zarc"], [
    ["74Ho112 TP IPRO", 0, "I"], ["82Ho112 CI IPRO", 0, "I"], ["75HO111 CI IPRO", 0, "I"], ["67HO107 IPRO", 0, "I"],
    ["77HO110 IPRO", 0, "I"], ["64HO133 IPRO", 0, "I"], ["64HO130 I2X", 0, "I"], ["77HO111 I2X", 0, "I"],
    ["69SC100 I2X", 0, "I"], ["71SC110 I2X", 0, "I"], ["76SC114 I2X", 0, "I"], ["77SC118 I2X", 0, "I"],
    ["67SC115 I2X", 0, "I"], ["76SC112 I2X", 0, "I"], ["67HO105 RR", 0, "I"], ["67HO106 RR", 0, "I"],
    ["66HO101 IPRO", 0, "I"], ["77HO108 IPRO", 0, "I"], ["76SC108 IPRO", 0, "I"], ["83HO113 TP IPRO", 0, "II"],
    ["81HO110 IPRO", 0, "II"], ["81SC120 I2X", 0, "II"], ["81SC118 I2X", 0, "II"], ["81SC115 I2X", 0, "II"],
    ["85SC125 I2X", 0, "II"], ["82HO111 IPRO", 0, "II"], ["83HO122 IPRO", 0, "II"], ["79HO103 IPRO", 0, "II"],
    ["83HO115 IPRO", 0, "II"], ["80HO110 IPRO", 0, "II"], ["79SC115 IPRO", 0, "II"], ["79SC118 IPRO", 0, "II"],
    ["82SC120 I2X", 0, "II"]
  ]],
  ["Caraíba Genética", ["zarc"], [
    ["CG 7665 RR", 0, "I"], ["CG Speed IPRO", 0, "I"], ["CG 7277 IPRO", 0, "I"], ["CG 7578 IPRO", 0, "I"],
    ["CG 7879 IPRO", 0, "I"], ["CG 7275", 0, "I"], ["CG 7776", 0, "I"], ["CG 7681", 0, "I"],
    ["CG 7583 RR", 0, "I"], ["CG 7584 IPRO", 0, "I"], ["CG 7886 IPRO", 0, "I"], ["CG 6987 IPRO", 0, "I"],
    ["CG 7789", 0, "I"], ["CG 8166 RR", 0, "II"], ["CG 7974", 0, "II"], ["CG 8077 IPRO", 0, "II"],
    ["CG 8382 IPRO", 0, "II"]
  ]],
  ["Inova Genética", ["zarc"], [
    ["VA 78A IPRO", 0, "I"], ["VA 75GO IPRO", 0, "I"], ["VA 7203 IPRO", 0, "I"], ["VA 7304 IPRO", 0, "I"],
    ["VA 7310 IPRO", 0, "I"], ["VA 7405 IPRO", 0, "I"], ["VA 7606 IPRO", 0, "I"], ["VA 7209 IPRO", 0, "I"],
    ["VA 6800 IPRO", 0, "I"], ["VA 5701 IPRO", 0, "I"], ["VA 82BA IPRO", 0, "II"], ["VA 82A RR", 0, "II"],
    ["VA 79A IPRO", 0, "II"], ["VA 84A IPRO", 0, "II"], ["VA 7907 IPRO", 0, "II"], ["VA 8108 IPRO", 0, "II"]
  ]],
  ["Latitude Genética", ["zarc"], [
    ["LTT 7701 IPRO", 0, "I"], ["LTT 7501 IPRO", 0, "I"], ["LTT 7801 IPRO", 0, "I"], ["LTT 8101 IPRO", 0, "II"],
    ["LTT 7901 IPRO", 0, "II"], ["LTT 8001 IPRO", 0, "II"], ["LTT 8402 IPRO", 0, "II"], ["LTT 8301 IPRO", 0, "II"]
  ]],
  ["IMAmt", ["zarc"], [
    ["IMA 731 IPRO", 0, "I"], ["IMA 742 IPRO", 0, "I"], ["IMA 781 IPRO", 0, "I"], ["IMA 80118 RR", 0, "II"],
    ["IMA 84114 RR", 0, "II"], ["IMA 84120 RR", 0, "II"], ["IMA 821 IPRO", 0, "II"], ["IMA 801 IPRO", 0, "II"],
    ["IMA 791 IPRO", 0, "II"]
  ]],
  ["GM Seeds", ["zarc"], [
    ["GMS 6834 IPRO", 0, "I"], ["GMS 6836 RR", 0, "I"], ["GMS 6929 RR", 0, "I"], ["GMS 7069 RR", 0, "I"],
    ["GMS 6808 IPRO", 0, "I"], ["GMS 8219", 0, "II"], ["GMS 8450 RR", 0, "II"], ["GMS 8365 RR", 0, "II"],
    ["GMS 8256 RR", 0, "II"], ["GMS 8244 RR", 0, "II"]
  ]],
  ["Sinergia (GNS)", ["zarc"], [
    ["GNS 7400 IPRO", 0, "I"], ["GNS 7700 IPRO", 0, "I"], ["GNS 7501 IPRO", 0, "I"], ["GNS 7900 IPRO", 0, "II"],
    ["GNS 8200 IPRO", 0, "II"], ["GNS 7901 IPRO", 0, "II"], ["GNS 7902 I2X", 0, "II"]
  ]],
  ["Avanti Seeds", ["zarc"], [
    ["AV AGILY RR", 0, "I"], ["AV GURIA RR", 0, "I"], ["SW BRIZA RR", 0, "I"], ["AV MAMBA RR", 0, "II"],
    ["SW ADARA RR", 0, "II"], ["SW ATRIA RR", 0, "II"], ["AV BRUTA RR", 0, "III"]
  ]],
  ["Granbras", ["zarc"], [
    ["GS 59R95", 0, "I"], ["GS 56R62", 0, "I"], ["GS 64R37", 0, "I"], ["GS 61R06", 0, "I"],
    ["GS 57R50", 0, "I"], ["GS 61R11", 0, "I"], ["GS 64R33", 0, "I"], ["GS 5R58", 0, "I"],
    ["GS 61R42", 0, "I"], ["GS 5R50 Rpp", 0, "I"], ["GS 6R60 Rpp", 0, "I"], ["GS 61R53", 0, "I"],
    ["GS 62R57", 0, "I"], ["GS 2231MP IPRO", 0, "I"]
  ]],
  ["Genética Soy", ["bs"], [
    ["Soy Combate IPRO", 7.4], ["Soy Completa IPRO", 7.9]
  ]],
  ["BASF", ["zarc"], [
    ["TEC 7849 IPRO", 0, "I"], ["TEC 6702 IPRO", 0, "I"], ["TEC 7022 IPRO", 0, "I"]
  ]],
  ["CEI", ["zarc"], [
    ["INT7100 IPRO", 0, "I"], ["INT7401 IPRO", 0, "I"], ["INT7501 IPRO", 0, "I"]
  ]],
  ["Expo Grain", ["zarc"], [
    ["BA 7700R", 0, "I"], ["BA 7300R", 0, "I"], ["BA 82 IPRO", 0, "II"]
  ]],
  ["GMax", ["zarc"], [
    ["GMX CANCHEIRO RR", 0, "I"]
  ]]
];

/* ---------------- busca no catálogo e ciclo pelo GMR ----------------
   O mesmo cálculo roda no app (public/js/agro.js) e no portal da fazenda. */

// regra padrão: GMR 8.0 = 116 dias do plantio à colheita; cada 1 ponto de GMR = 14 dias
// (ajustada aos ciclos que Brasmax e Neogen publicam para o MT: ~111 dias após a emergência no GMR 8.0, ~13,6 dias por ponto)
export const REGRA_PADRAO = { gmr: 8.0, dias: 116, ponto: 14 };

const TEC_FIM = /(ipro|i2x|rr|ce3|ce|e|xtd|tf|rsf)+$/;
export function chaveCult(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
let indice = null;
function montarIndice() {
  indice = {};
  const por = (k, x) => { if (k && !indice[k]) indice[k] = x; };
  CATALOGO.forEach(([empresa, , itens]) => itens.forEach((it) => {
    const x = { empresa, nome: it[0], gmr: it[1] || 0, faixa: it[1] ? '' : it[2], dae: it[1] ? (it[2] || 0) : 0 };
    const k = chaveCult(it[0]), semMarca = k.replace(/^bmx/, '');
    por(k, x); por(semMarca, x); por(k.replace(TEC_FIM, ''), x); por(semMarca.replace(TEC_FIM, ''), x);
  }));
}
export function acharCultivar(nome) {
  if (!indice) montarIndice();
  const k = chaveCult(nome).replace(/^brasmax/, 'bmx');
  return indice[k] || indice[k.replace(/^bmx/, '')] || indice[k.replace(TEC_FIM, '')] || null;
}
export function regraValida(r) {
  const n = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
  const g = n(r && r.gmr), d = n(r && r.dias), p = n(r && r.ponto);
  return { gmr: g >= 3 && g <= 10 ? g : REGRA_PADRAO.gmr, dias: d >= 60 && d <= 250 ? Math.round(d) : REGRA_PADRAO.dias, ponto: p >= 0 && p <= 40 ? p : REGRA_PADRAO.ponto };
}
export function cicloPorGmr(gmr, regra) {
  const r = regraValida(regra);
  return Math.round(r.dias + (Number(gmr) - r.gmr) * r.ponto);
}
// ciclo de um material: dias informados > GMR (informado ou do catálogo) pela regra > nada (o app usa o padrão da cultura)
export function cicloMaterial(variedade, cultura, linha, regra) {
  if (linha && Number(linha.dias) > 0) return { dias: Number(linha.dias), fonte: 'informado', gmr: Number(linha.gmr) || 0 };
  if (cultura && cultura !== 'soja') return null;
  const c = acharCultivar(variedade);
  const gmr = (linha && Number(linha.gmr)) || (c && c.gmr) || 0;
  if (gmr) return { dias: cicloPorGmr(gmr, regra), fonte: 'gmr', gmr };
  if (c && c.faixa) return { dias: cicloPorGmr(GMR_FAIXA[c.faixa], regra), fonte: 'faixa', gmr: GMR_FAIXA[c.faixa] };
  return null;
}

// nome oficial do catálogo para um nome digitado ("Olimpo" → "BMX Olimpo IPRO"); '' quando não tem certeza.
// Se o nome digitado traz a tecnologia e ela é outra (ex.: "Olimpo I2X"), não troca.
const TECS = { IPRO: 1, I2X: 1, RR: 1, CE: 1, E: 1, XTD: 1, CE3: 1, TF: 1, RSF: 1 };
const tecDe = (n) => { const u = String(n || '').trim().toUpperCase().split(/\s+/).pop(); return TECS[u] ? u : ''; };
export function nomeOficial(nome) {
  const c = acharCultivar(nome);
  if (!c) return '';
  const t1 = tecDe(nome), t2 = tecDe(c.nome);
  if (t1 && t2 && t1 !== t2) return '';
  return c.nome;
}
