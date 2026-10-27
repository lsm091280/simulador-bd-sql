/* ============================================================
   tecnoLSM · Simulador de bases de datos
   Diagrama ER simple en SVG (cajas por tabla + líneas de relación).
   Incluye zoom in / zoom out / reset para ver bien diagramas grandes.
   Los colores salen de variables CSS (.er-*) para respetar el tema.
   ============================================================ */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var BOX_W = 200, HEAD_H = 30, ROW_H = 22, GAP_X = 90, GAP_Y = 44, PAD = 16, PER_ROW = 3;

  function el(name, attrs, text) {
    var n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function parseRef(ref) {
    var p = String(ref).split('.');
    return { table: p[0], col: p[1] };
  }

  var zoomLevel = 1;
  var ZOOM_MIN = 0.4, ZOOM_MAX = 3, ZOOM_STEP = 0.25;

  function applyZoom(container) {
    var svg = container.querySelector('.er-svg');
    if (!svg) return;
    svg.style.transform = 'scale(' + zoomLevel + ')';
    svg.style.transformOrigin = 'top left';
    var wrap = container.querySelector('.er-wrap');
    if (wrap) {
      wrap.style.width = (zoomLevel * 100) + '%';
      wrap.style.height = (zoomLevel * 100) + '%';
    }
  }

  function zoomIn(container) {
    zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP);
    applyZoom(container);
    updateZoomLabel(container);
  }

  function zoomOut(container) {
    zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP);
    applyZoom(container);
    updateZoomLabel(container);
  }

  function resetZoom(container) {
    zoomLevel = 1;
    applyZoom(container);
    updateZoomLabel(container);
  }

  function updateZoomLabel(container) {
    var label = container.querySelector('.er-zoom-label');
    if (label) label.textContent = Math.round(zoomLevel * 100) + '%';
  }

  /**
   * Dibuja el diagrama dentro de `container`.
   * @param {HTMLElement} container
   * @param {object} db base de datos creada con SqlEngine.createDatabase
   * @param {string[]} highlight nombres de tablas a resaltar
   */
  function render(container, db, highlight) {
    highlight = (highlight || []).map(function (t) { return t.toLowerCase(); });
    container.textContent = '';
    var names = db.tableNames();
    var rels = (db.relaciones || []).map(function (r) { return { from: parseRef(r.from), to: parseRef(r.to) }; });

    var fkSet = {};
    rels.forEach(function (r) { fkSet[r.from.table + '.' + r.from.col] = true; });

    /* Posiciones en cuadrícula */
    var pos = {};
    var rowHeights = [];
    names.forEach(function (t, i) {
      var r = Math.floor(i / PER_ROW);
      var h = HEAD_H + db.schema[t].length * ROW_H + 8;
      rowHeights[r] = Math.max(rowHeights[r] || 0, h);
    });
    var rowY = [];
    var acc = PAD;
    rowHeights.forEach(function (h, r) { rowY[r] = acc; acc += h + GAP_Y; });
    names.forEach(function (t, i) {
      var r = Math.floor(i / PER_ROW), c = i % PER_ROW;
      pos[t] = { x: PAD + 24 + c * (BOX_W + GAP_X), y: rowY[r], h: HEAD_H + db.schema[t].length * ROW_H + 8, c: c };
    });
    var cols = Math.min(PER_ROW, names.length);
    var width = PAD * 2 + 48 + cols * BOX_W + (cols - 1) * GAP_X;
    var height = acc - GAP_Y + PAD;

    /* Controles de zoom (DOM seguro, sin innerHTML) */
    var controls = document.createElement('div');
    controls.className = 'er-controls';

    var btnOut = document.createElement('button');
    btnOut.type = 'button';
    btnOut.className = 'er-zoom-btn';
    btnOut.setAttribute('data-action', 'out');
    btnOut.title = 'Alejar';
    btnOut.textContent = '−';

    var label = document.createElement('span');
    label.className = 'er-zoom-label';
    label.textContent = '100%';

    var btnIn = document.createElement('button');
    btnIn.type = 'button';
    btnIn.className = 'er-zoom-btn';
    btnIn.setAttribute('data-action', 'in');
    btnIn.title = 'Acercar';
    btnIn.textContent = '+';

    var btnReset = document.createElement('button');
    btnReset.type = 'button';
    btnReset.className = 'er-zoom-btn';
    btnReset.setAttribute('data-action', 'reset');
    btnReset.title = 'Tamaño original';
    btnReset.textContent = '↺';

    controls.appendChild(btnOut);
    controls.appendChild(label);
    controls.appendChild(btnIn);
    controls.appendChild(btnReset);

    var wrap = document.createElement('div');
    wrap.className = 'er-wrap';
    wrap.style.overflow = 'auto';
    wrap.style.maxHeight = '420px';

    var svg = el('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      class: 'er-svg',
      role: 'img',
      'aria-label': 'Diagrama entidad-relación de la base de datos ' + db.nombre
    });

    function colY(t, colName) {
      var idx = db.schema[t].findIndex(function (c) { return c.name === colName; });
      if (idx < 0) idx = 0;
      return pos[t].y + HEAD_H + idx * ROW_H + ROW_H / 2;
    }

    /* Líneas de relación (debajo de las cajas) */
    var gLines = el('g', { class: 'er-lines' });
    rels.forEach(function (r) {
      if (!pos[r.from.table] || !pos[r.to.table]) return;
      var a = pos[r.from.table], b = pos[r.to.table];
      var y1 = colY(r.from.table, r.from.col), y2 = colY(r.to.table, r.to.col);
      var x1, x2, d, lx1, lx2, anchor1, anchor2;
      if (a.c === b.c) {
        x1 = a.x; x2 = b.x;
        var off = 34 + Math.abs(y1 - y2) / 12;
        d = 'M' + x1 + ' ' + y1 + ' C' + (x1 - off) + ' ' + y1 + ' ' + (x2 - off) + ' ' + y2 + ' ' + x2 + ' ' + y2;
        lx1 = x1 - 6; lx2 = x2 - 6; anchor1 = 'end'; anchor2 = 'end';
      } else if (a.c < b.c) {
        x1 = a.x + BOX_W; x2 = b.x;
        d = 'M' + x1 + ' ' + y1 + ' C' + (x1 + 45) + ' ' + y1 + ' ' + (x2 - 45) + ' ' + y2 + ' ' + x2 + ' ' + y2;
        lx1 = x1 + 6; lx2 = x2 - 6; anchor1 = 'start'; anchor2 = 'end';
      } else {
        x1 = a.x; x2 = b.x + BOX_W;
        d = 'M' + x1 + ' ' + y1 + ' C' + (x1 - 45) + ' ' + y1 + ' ' + (x2 + 45) + ' ' + y2 + ' ' + x2 + ' ' + y2;
        lx1 = x1 - 6; lx2 = x2 + 6; anchor1 = 'end'; anchor2 = 'start';
      }
      var active = highlight.indexOf(r.from.table.toLowerCase()) >= 0 && highlight.indexOf(r.to.table.toLowerCase()) >= 0;
      var g = el('g', { class: 'er-rel' + (active ? ' er-active' : '') });
      g.appendChild(el('title', {}, r.from.table + '.' + r.from.col + ' → ' + r.to.table + '.' + r.to.col));
      g.appendChild(el('path', { d: d, class: 'er-line', fill: 'none' }));
      g.appendChild(el('text', { x: lx1, y: y1 - 4, 'text-anchor': anchor1, class: 'er-card' }, 'N'));
      g.appendChild(el('text', { x: lx2, y: y2 - 4, 'text-anchor': anchor2, class: 'er-card' }, '1'));
      gLines.appendChild(g);
    });
    svg.appendChild(gLines);

    /* Cajas de tabla */
    names.forEach(function (t) {
      var p = pos[t];
      var active = highlight.indexOf(t.toLowerCase()) >= 0;
      var g = el('g', { class: 'er-table' + (active ? ' er-active' : ''), transform: 'translate(' + p.x + ',' + p.y + ')' });
      g.appendChild(el('rect', { width: BOX_W, height: p.h, rx: 8, class: 'er-box' }));
      g.appendChild(el('path', { d: 'M0 ' + HEAD_H + ' H' + BOX_W, class: 'er-sep' }));
      g.appendChild(el('text', { x: 12, y: 20, class: 'er-title' }, t));
      db.schema[t].forEach(function (c, i) {
        var y = HEAD_H + i * ROW_H + 16;
        var isPk = c.name === 'id';
        var isFk = !!fkSet[t + '.' + c.name];
        if (isPk || isFk) {
          g.appendChild(el('text', { x: 12, y: y, class: 'er-key ' + (isPk ? 'er-pk' : 'er-fk') }, isPk ? 'PK' : 'FK'));
        }
        g.appendChild(el('text', { x: 36, y: y, class: 'er-col' }, c.name));
        g.appendChild(el('text', { x: BOX_W - 10, y: y, 'text-anchor': 'end', class: 'er-type' }, c.type));
      });
      svg.appendChild(g);
    });

    wrap.appendChild(svg);
    container.appendChild(controls);
    container.appendChild(wrap);

    /* Eventos de zoom */
    controls.addEventListener('click', function (e) {
      var btn = e.target.closest('.er-zoom-btn');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'in') zoomIn(container);
      else if (action === 'out') zoomOut(container);
      else if (action === 'reset') resetZoom(container);
    });

    /* Reset zoom al renderizar */
    zoomLevel = 1;
    updateZoomLabel(container);
  }

  global.DiagramaER = { render: render, zoomIn: zoomIn, zoomOut: zoomOut, resetZoom: resetZoom };
})(window);
