/* ============================================================
   geo.js — KML/KMZ -> GeoJSON, point-in-polygon, área e formatação
   Sem dependências externas (funciona 100% offline).
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- ZIP mínimo (para KMZ) usando DecompressionStream ---------- */
  async function unzipFirstKml(arrayBuffer) {
    const dv = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    // localiza End Of Central Directory
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 66000; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('KMZ inválido (EOCD não encontrado)');
    const count = dv.getUint16(eocd + 10, true);
    let ptr = dv.getUint32(eocd + 16, true);

    for (let n = 0; n < count; n++) {
      if (dv.getUint32(ptr, true) !== 0x02014b50) break;
      const method = dv.getUint16(ptr + 10, true);
      const compSize = dv.getUint32(ptr + 20, true);
      const nameLen = dv.getUint16(ptr + 28, true);
      const extraLen = dv.getUint16(ptr + 30, true);
      const commentLen = dv.getUint16(ptr + 32, true);
      const localOff = dv.getUint32(ptr + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
      ptr += 46 + nameLen + extraLen + commentLen;

      if (!/\.kml$/i.test(name)) continue;

      // cabeçalho local
      const lNameLen = dv.getUint16(localOff + 26, true);
      const lExtraLen = dv.getUint16(localOff + 28, true);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const raw = bytes.subarray(dataStart, dataStart + compSize);

      if (method === 0) return new TextDecoder().decode(raw);
      if (method === 8) {
        if (typeof DecompressionStream === 'undefined') {
          throw new Error('Navegador sem suporte a descompressão. Envie o .kml em vez do .kmz.');
        }
        const ds = new DecompressionStream('deflate-raw');
        const stream = new Blob([raw]).stream().pipeThrough(ds);
        return await new Response(stream).text();
      }
      throw new Error('Compressão do KMZ não suportada');
    }
    throw new Error('Nenhum .kml encontrado dentro do KMZ');
  }

  /* ---------- KML -> GeoJSON (Polygon / MultiGeometry) ---------- */
  function parseCoords(text) {
    return String(text).trim().split(/\s+/).filter(Boolean).map(function (t) {
      const p = t.split(',').map(Number);
      return [p[0], p[1]]; // [lon, lat]
    }).filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); });
  }

  function extendedData(pm) {
    const out = {};
    pm.querySelectorAll('ExtendedData > Data').forEach(function (d) {
      const k = d.getAttribute('name');
      const v = d.querySelector('value');
      if (k) out[k] = v ? v.textContent.trim() : '';
    });
    pm.querySelectorAll('ExtendedData SimpleData').forEach(function (d) {
      const k = d.getAttribute('name');
      if (k) out[k] = d.textContent.trim();
    });
    return out;
  }

  function kmlToGeoJSON(kmlText) {
    const doc = new DOMParser().parseFromString(kmlText, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('KML mal formado');
    const features = [];

    doc.querySelectorAll('Placemark').forEach(function (pm, idx) {
      const polys = [];
      pm.querySelectorAll('Polygon').forEach(function (poly) {
        const rings = [];
        const outer = poly.querySelector('outerBoundaryIs coordinates');
        if (outer) rings.push(parseCoords(outer.textContent));
        poly.querySelectorAll('innerBoundaryIs coordinates').forEach(function (inner) {
          rings.push(parseCoords(inner.textContent));
        });
        if (rings.length && rings[0].length >= 3) polys.push(rings);
      });
      if (!polys.length) return;

      const ext = extendedData(pm);
      const nameEl = pm.querySelector('name');
      const nomeKml = nameEl ? nameEl.textContent.trim() : '';
      const nome = nomeKml ||
                   ext.Name || ext.nome || ext.TALHAO || ext.Talhao ||
                   ('Talhão ' + (idx + 1));

      features.push({
        type: 'Feature',
        properties: Object.assign({}, ext, {
          _nome_kml: nomeKml,
          _ordem: idx + 1,
          nome: nome,
          id: 'T' + (idx + 1)
        }),
        geometry: polys.length === 1
          ? { type: 'Polygon', coordinates: polys[0] }
          : { type: 'MultiPolygon', coordinates: polys }
      });
    });

    return { type: 'FeatureCollection', features: features };
  }

  async function importarArquivo(file) {
    const nome = (file.name || '').toLowerCase();
    let kmlText;
    if (nome.endsWith('.kmz')) {
      kmlText = await unzipFirstKml(await file.arrayBuffer());
    } else {
      kmlText = await file.text();
    }
    const gj = kmlToGeoJSON(kmlText);
    gj.features.forEach(function (f) { f.properties.area_ha = areaHa(f.geometry); });
    return gj;
  }

  /* ---------- Point in polygon (ray casting) ---------- */
  function pointInRing(pt, ring) {
    let inside = false;
    const x = pt[0], y = pt[1];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInPolygon(pt, rings) {
    if (!rings.length || !pointInRing(pt, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) if (pointInRing(pt, rings[i])) return false; // buraco
    return true;
  }

  // Retorna { nome, id, feature } ou null
  function talhaoDoPonto(lon, lat, geojson) {
    if (!geojson || !geojson.features) return null;
    for (const f of geojson.features) {
      const g = f.geometry;
      if (!g) continue;
      const polys = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []);
      for (const rings of polys) {
        if (pointInPolygon([lon, lat], rings)) {
          return { nome: f.properties.nome, id: f.properties.id, feature: f };
        }
      }
    }
    return null;
  }

  /* ---------- Área aproximada (esférica) em hectares ---------- */
  function ringArea(ring) {
    const R = 6378137;
    let total = 0;
    for (let i = 0, len = ring.length; i < len; i++) {
      const p1 = ring[i], p2 = ring[(i + 1) % len];
      total += (p2[0] - p1[0]) * Math.PI / 180 *
        (2 + Math.sin(p1[1] * Math.PI / 180) + Math.sin(p2[1] * Math.PI / 180));
    }
    return Math.abs(total * R * R / 2);
  }

  function areaHa(geometry) {
    if (!geometry) return 0;
    const polys = geometry.type === 'Polygon' ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
    let m2 = 0;
    polys.forEach(function (rings) {
      rings.forEach(function (ring, i) { m2 += (i === 0 ? 1 : -1) * ringArea(ring); });
    });
    return +(m2 / 10000).toFixed(2);
  }

  /* ---------- Bounds e projeção simples para desenhar em SVG ---------- */
  function bounds(geojson) {
    let minX = 180, minY = 90, maxX = -180, maxY = -90;
    (geojson.features || []).forEach(function (f) {
      const g = f.geometry; if (!g) return;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      polys.forEach(function (rings) {
        rings.forEach(function (ring) {
          ring.forEach(function (p) {
            if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
            if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
          });
        });
      });
    });
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function grausParaDMS(v, eixo) {
    const dir = eixo === 'lat' ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W');
    const a = Math.abs(v);
    const g = Math.floor(a);
    const m = Math.floor((a - g) * 60);
    const s = ((a - g - m / 60) * 3600).toFixed(1);
    return g + '° ' + m + "' " + s + '" ' + dir;
  }

  /* ---------- atributos do KML: quais servem de nome ---------- */

  // Devolve [{ chave, rotulo, amostra }] com os campos encontrados no arquivo.
  function atributos(geojson) {
    const feats = (geojson && geojson.features) || [];
    if (!feats.length) return [];
    const chaves = [];
    const vistas = {};

    const temNomeKml = feats.some(function (f) { return f.properties._nome_kml; });
    if (temNomeKml) {
      chaves.push({ chave: '_nome_kml', rotulo: 'Nome do Placemark (padrão)',
                    amostra: feats.map(function (f) { return f.properties._nome_kml; }).filter(Boolean).slice(0, 3).join(', ') });
    }

    feats.forEach(function (f) {
      Object.keys(f.properties).forEach(function (k) {
        if (k.charAt(0) === '_' || k === 'nome' || k === 'id' || k === 'area_ha') return;
        if (vistas[k]) return;
        vistas[k] = true;
        const amostra = feats.map(function (x) { return x.properties[k]; })
          .filter(function (v) { return v !== undefined && v !== ''; })
          .slice(0, 3).join(', ');
        chaves.push({ chave: k, rotulo: k, amostra: amostra });
      });
    });

    chaves.push({ chave: '_ordem', rotulo: 'Numerar na ordem do arquivo', amostra: 'Talhão 1, Talhão 2, …' });
    return chaves;
  }

  // Reescreve properties.nome a partir da chave escolhida.
  function aplicarNome(geojson, chave) {
    (geojson.features || []).forEach(function (f, i) {
      const p = f.properties;
      let v = chave === '_ordem' ? ('Talhão ' + (p._ordem || i + 1)) : p[chave];
      if (v === undefined || v === null || String(v).trim() === '') v = 'Talhão ' + (p._ordem || i + 1);
      p.nome = String(v).trim();
    });
    return geojson;
  }

  /* ---------- desenho dos talhões ---------- */

  function svgTalhoes(geojson, opcoes) {
    const o = opcoes || {};
    const feats = (geojson && geojson.features) || [];
    if (!feats.length) return '';
    const b = bounds(geojson);
    const dx = (b.maxX - b.minX) || 0.001, dy = (b.maxY - b.minY) || 0.001;
    const minX = b.minX - dx * 0.04, maxX = b.maxX + dx * 0.04;
    const minY = b.minY - dy * 0.04, maxY = b.maxY + dy * 0.04;
    const W = 1000;
    const H = Math.max(260, Math.round(W * ((maxY - minY) / (maxX - minX)) *
      Math.cos((minY + maxY) / 2 * Math.PI / 180)));
    const px = function (l) { return (l - minX) / (maxX - minX) * W; };
    const py = function (l) { return H - (l - minY) / (maxY - minY) * H; };
    const esc = function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    };

    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';
    feats.forEach(function (f) {
      const g = f.geometry; if (!g) return;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      polys.forEach(function (rings) {
        const d = rings.map(function (ring) {
          return 'M' + ring.map(function (p) { return px(p[0]).toFixed(1) + ',' + py(p[1]).toFixed(1); }).join('L') + 'Z';
        }).join(' ');
        s += '<path d="' + d + '" fill="rgba(27,122,67,.15)" stroke="#1B7A43" stroke-width="2.5"/>';
      });
      let sx = 0, sy = 0, n = 0;
      polys.forEach(function (rings) { rings[0].forEach(function (p) { sx += p[0]; sy += p[1]; n++; }); });
      s += '<text x="' + px(sx / n).toFixed(1) + '" y="' + py(sy / n).toFixed(1) +
        '" font-size="22" font-weight="600" fill="#146034" text-anchor="middle" ' +
        'font-family="sans-serif" paint-order="stroke" stroke="#fff" stroke-width="5">' +
        esc(f.properties.nome) + '</text>';
    });
    (o.pontos || []).forEach(function (p) {
      if (p.lat == null) return;
      s += '<circle cx="' + px(p.lon).toFixed(1) + '" cy="' + py(p.lat).toFixed(1) +
        '" r="8" fill="' + (p.cor || '#D93025') + '" stroke="#fff" stroke-width="2.5"/>';
    });
    s += '</svg>';
    return s;
  }

  global.Geo = {
    importarArquivo: importarArquivo,
    atributos: atributos,
    aplicarNome: aplicarNome,
    svgTalhoes: svgTalhoes,
    kmlToGeoJSON: kmlToGeoJSON,
    talhaoDoPonto: talhaoDoPonto,
    areaHa: areaHa,
    bounds: bounds,
    grausParaDMS: grausParaDMS,
    pointInPolygon: pointInPolygon
  };
})(typeof window !== 'undefined' ? window : globalThis);
