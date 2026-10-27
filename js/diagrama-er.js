/* ============================================================
   tecnoLSM · Simulador de bases de datos
   Diagrama ER simple en SVG (cajas por tabla + líneas de relación).
   Incluye botón "Ampliar" que abre el diagrama en un modal centrado.
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

  /** Construye el SVG del diagrama y lo devuelve. */
  function buildSvg(db, highlight) {
    highlight = (highlight || []).map(function (t) { return t.toLowerCase(); });
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

    var svg = el('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      class: 'er-svg er-svg-modal',
      role: 'img',
      'aria-label': 'Diagrama entidad-relación de la base de datos ' + db.nombre
    });

    function colY(t, colName) {
      var idx = db.schema[t].findIndex(function (c) { return c.name === colName; });
      if (idx < 0) idx = 0;
      return pos[t].y + HEAD_H + idx * ROW_H + ROW_H / 2;
    }

    /* Líneas de relación */
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

    return svg;
  }

  /** Abre un modal centrado con el diagrama a tamaño grande. */
  function openModal(db, highlight) {
    var old = document.getElementById('er-modal');
    if (old) old.parentNode.removeChild(old);

    var overlay = document.createElement('div');
    overlay.id = 'er-modal';
    overlay.className = 'er-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'er-modal';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'er-modal-close';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Cerrar';
    closeBtn.addEventListener('click', closeModal);

    var title = document.createElement('h3');
    title.className = 'er-modal-title';
    title.textContent = 'Diagrama ER — ' + db.nombre;

    var body = document.createElement('div');
    body.className = 'er-modal-body';

    var svg = buildSvg(db, highlight);
    svg.setAttribute('width', svg.viewBox.baseVal.width * 2);
    svg.setAttribute('height', svg.viewBox.baseVal.height * 2);
    body.appendChild(svg);

    modal.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(body);
    overlay.appendChild(modal);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    function onKey(e) {
      if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onKey); }
    }
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var overlay = document.getElementById('er-modal');
    if (overlay) overlay.parentNode.removeChild(overlay);
    document.body.style.overflow = '';
  }

  /**
   * Dibuja el diagrama dentro de `container`.
   */
  function render(container, db, highlight) {
    container.textContent = '';

    var btnExpand = document.createElement('button');
    btnExpand.type = 'button';
    btnExpand.className = 'er-expand-btn';
    btnExpand.textContent = 'Ampliar diagrama';
    btnExpand.title = 'Ver el diagrama a tamaño completo';
    btnExpand.addEventListener('click', function () { openModal(db, highlight); });

    var wrap = document.createElement('div');
    wrap.className = 'er-wrap';
    wrap.style.overflow = 'auto';
    wrap.style.maxHeight = '320px';

    var svg = buildSvg(db, highlight);
    wrap.appendChild(svg);

    container.appendChild(btnExpand);
    container.appendChild(wrap);
  }

  global.DiagramaER = { render: render, openModal: openModal, closeModal: closeModal };
})(window);
