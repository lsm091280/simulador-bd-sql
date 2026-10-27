/* ============================================================
   tecnoLSM · Simulador de bases de datos
   Lógica principal: selector de BD, editor con resaltado, ejecución,
   resultados, historial, ejemplos, modo examen y exportación/importación.
   ============================================================ */
(function () {
  'use strict';

  var BDS = {
    instituto: { file: 'data/bd_instituto.json', label: 'Instituto' },
    tienda: { file: 'data/bd_tienda.json', label: 'Tienda' },
    biblioteca: { file: 'data/bd_biblioteca.json', label: 'Biblioteca' }
  };
  var LS = { theme: 'tecnolsm-theme', bd: 'tecnolsm-simbd-bd', draft: 'tecnolsm-simbd-borrador', hist: 'tecnolsm-simbd-historial', done: 'tecnolsm-simbd-examen-' };
  var HISTORY_MAX = 20;
  var MAX_ROWS_SHOWN = 500;

  var state = {
    bdKey: 'instituto',
    json: {},          // JSON original por BD (inmutable, solo lectura)
    db: null,          // base de datos en memoria (modificable por DML)
    lastResult: null,
    history: [],
    loadToken: 0,
    erKey: '',
    exam: { idx: null, attempts: 0, start: 0, timer: null, done: [] }
  };

  var $ = function (id) { return document.getElementById(id); };
  var el = {};

  /* ---------- Utilidades ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* almacenamiento no disponible */ } }
  function plural(n, s, p) { return n + ' ' + (n === 1 ? s : p); }
  function fmtMs(ms) { return ms < 10 ? ms.toFixed(1) : String(Math.round(ms)); }
  function fmtTime(s) {
    var m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }
  function icon(name) { return '<iconify-icon icon="mdi:' + name + '" aria-hidden="true"></iconify-icon>'; }

  /* ---------- Tema claro / oscuro ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    el.themeIcon.setAttribute('icon', t === 'dark' ? 'mdi:white-balance-sunny' : 'mdi:weather-night');
    el.themeLabel.textContent = t === 'dark' ? 'Tema claro' : 'Tema oscuro';
  }
  function toggleTheme() {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    lsSet(LS.theme, next);
    applyTheme(next);
  }

  /* ---------- Mensajes ---------- */
  function setMsg(kind, iconName, html) {
    el.resultMsg.className = 'msg msg-' + kind;
    el.resultMsg.innerHTML = icon(iconName) + '<div class="msg-body">' + html + '</div>';
  }

  function errorHtml(err) {
    var title = err && err.message ? err.message : String(err);
    var html = '<p class="msg-title">' + esc(title) + '</p>';
    if (err && err.hint) html += '<p class="msg-hint">' + esc(err.hint) + '</p>';
    var detail = (err && err.detail) || 'Algo no ha ido como se esperaba al ejecutar la consulta. Revisa la sintaxis y los nombres de tablas y columnas.';
    html += '<details class="explain"><summary>' + icon('help-circle-outline') + ' ¿Qué significa esto?</summary><p>' + esc(detail) + '</p></details>';
    return html;
  }

  function showError(err) {
    el.resultTable.textContent = '';
    state.lastResult = null;
    el.btnExportCsv.disabled = true;
    setMsg('error', 'alert-circle-outline', errorHtml(err));
  }

  function reportError(err) {
    if (!(err instanceof SqlEngine.SqlError)) {
      if (window.console) console.error(err);
      err = new SqlEngine.SqlError('Error inesperado: ' + (err && err.message ? err.message : err));
    }
    showError(err);
  }

  /* ---------- Resaltado de sintaxis ---------- */
  var KW = new Set(SqlEngine.KEYWORDS);
  var FN = new Set(SqlEngine.FUNCTIONS);
  var TOKEN_RE = /('(?:[^']|'')*'?)|(--[^\n]*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_\u00C0-\u024F][A-Za-z0-9_\u00C0-\u024F]*)|([\s\S])/g;

  function highlight(text) {
    var out = '', m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(text)) !== null) {
      if (m[1] !== undefined) out += '<span class="tk-str">' + esc(m[1]) + '</span>';
      else if (m[2] !== undefined) out += '<span class="tk-com">' + esc(m[2]) + '</span>';
      else if (m[3] !== undefined) out += '<span class="tk-num">' + esc(m[3]) + '</span>';
      else if (m[4] !== undefined) {
        var up = m[4].toUpperCase();
        if (KW.has(up)) out += '<span class="tk-kw">' + esc(m[4]) + '</span>';
        else if (FN.has(up) && /^\s*\(/.test(text.slice(TOKEN_RE.lastIndex, TOKEN_RE.lastIndex + 8))) out += '<span class="tk-fn">' + esc(m[4]) + '</span>';
        else out += esc(m[4]);
      } else out += esc(m[5]);
    }
    return out;
  }

  function updateHighlight() {
    el.hlCode.innerHTML = highlight(el.input.value) + '\n';
    syncScroll();
  }
  function syncScroll() {
    el.hl.scrollTop = el.input.scrollTop;
    el.hl.scrollLeft = el.input.scrollLeft;
  }

  function setEditor(text, focus) {
    el.input.value = text;
    updateHighlight();
    saveDraft();
    updateER();
    if (focus) { el.input.focus(); }
  }
  function saveDraft() { lsSet(LS.draft, el.input.value); }

  /* ---------- Carga de BD ---------- */
  function getJson(key) {
    if (state.json[key]) return Promise.resolve(state.json[key]);
    return fetch(BDS[key].file).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) { state.json[key] = j; return j; });
  }

  function loadBd(key) {
    var token = ++state.loadToken;
    state.bdKey = key;
    lsSet(LS.bd, key);
    el.bdSelect.value = key;
    el.bdNombre.textContent = 'Cargando…';
    return getJson(key).then(function (json) {
      if (token !== state.loadToken) return;
      state.db = SqlEngine.createDatabase(json);
      el.resultTable.textContent = '';
      state.lastResult = null;
      el.btnExportCsv.disabled = true;
      setMsg('info', 'information-outline', 'Base de datos «' + esc(BDS[key].label) + '» cargada. Escribe una consulta y pulsa «Ejecutar».');
      renderSummary();
      renderMisTablas();
      state.erKey = '';
      updateER();
      renderEjemplos();
      renderExamList();
      resetExamView();
      // Aviso de BD activa en pestaña Crear BD
      var aviso = $('bd-activa-aviso');
      if (aviso) aviso.textContent = 'BD activa: «' + esc(BDS[key].label) + '». Las tablas que crees (CREATE TABLE) se añadirán a esta BD.';
      if (!el.input.value.trim()) {
        var first = (window.EJEMPLOS[key] || [])[0];
        if (first) setEditor(first.sql);
      }
    }).catch(function (err) {
      if (token !== state.loadToken) return;
      el.bdNombre.textContent = 'No se han podido cargar los datos';
      el.bdTablas.textContent = '';
      setMsg('error', 'alert-circle-outline',
        '<p class="msg-title">No se han podido cargar los datos de la base de datos (' + esc(err.message) + ').</p>' +
        '<p class="msg-hint">Abre la aplicación desde un servidor web y no haciendo doble clic en el archivo. Por ejemplo, en la carpeta del proyecto: <code>python3 -m http.server 8000</code> y entra en <code>http://localhost:8000</code>.</p>');
    });
  }

  function renderSummary() {
    var db = state.db;
    var names = db.tableNames();
    var total = 0;
    el.bdNombre.textContent = db.nombre;
    el.bdTablas.textContent = '';
    names.forEach(function (t) {
      var n = db.tables[t].length;
      total += n;
      var tr = document.createElement('tr');
      tr.dataset.table = t;
      tr.innerHTML = '<td>' + esc(t) + '</td><td class="num">' + n + '</td>';
      el.bdTablas.appendChild(tr);
    });
    el.bdResumen.textContent = plural(names.length, 'tabla', 'tablas') + ' · ' + plural(total, 'registro', 'registros') + ' en total.';
    markUsedTables(detectTables(el.input.value));
  }

  function markUsedTables(used) {
    var low = used.map(function (t) { return t.toLowerCase(); });
    Array.prototype.forEach.call(el.bdTablas.children, function (tr) {
      tr.classList.toggle('is-used', low.indexOf(tr.dataset.table.toLowerCase()) >= 0);
    });
  }

  /* ---------- Diagrama ER ---------- */
  function detectTables(sql) {
    if (!state.db) return [];
    var text = sql.replace(/'(?:[^']|'')*'/g, ' ');
    return state.db.tableNames().filter(function (t) {
      return new RegExp('(^|[^A-Za-z0-9_])' + t + '($|[^A-Za-z0-9_])', 'i').test(text);
    });
  }

  function updateER(forced) {
    if (!state.db) return;
    var used = forced || detectTables(el.input.value);
    var key = state.bdKey + '|' + used.join(',');
    markUsedTables(used);
    if (key === state.erKey) return;
    state.erKey = key;
    DiagramaER.render(el.er, state.db, used);
  }

  var erTimer = null;
  function scheduleER() {
    clearTimeout(erTimer);
    erTimer = setTimeout(function () { updateER(); }, 200);
  }

  /* ---------- Ejecución y resultados ---------- */
  function formatCell(v) {
    if (v === null || v === undefined) return { t: 'NULL', c: 'null' };
    if (typeof v === 'number') return { t: String(Math.round(v * 10000) / 10000), c: 'num' };
    if (typeof v === 'boolean') return { t: v ? 'TRUE' : 'FALSE', c: '' };
    return { t: String(v), c: '' };
  }

  function renderTable(res) {
    var numeric = res.columns.map(function (_, i) {
      return res.rows.length > 0 && res.rows.every(function (r) { return r[i] === null || typeof r[i] === 'number'; });
    });
    var html = '<table><thead><tr>';
    res.columns.forEach(function (c, i) { html += '<th scope="col"' + (numeric[i] ? ' class="num"' : '') + '>' + esc(c) + '</th>'; });
    html += '</tr></thead><tbody>';
    res.rows.slice(0, MAX_ROWS_SHOWN).forEach(function (r) {
      html += '<tr>';
      r.forEach(function (v, i) {
        var f = formatCell(v);
        var cls = (f.c || (numeric[i] ? 'num' : '')).trim();
        html += '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(f.t) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    if (res.rows.length > MAX_ROWS_SHOWN) {
      html += '<p class="row-count">Se muestran las primeras ' + MAX_ROWS_SHOWN + ' filas de ' + res.rows.length + '.</p>';
    }
    el.resultTable.innerHTML = html;
  }

  function showResult(res) {
    updateER(res.tables);
    if (res.type === 'select') {
      state.lastResult = res;
      el.btnExportCsv.disabled = false;
      var n = res.rows.length;
      var ok = 'Consulta ejecutada: ' + (n === 1 ? '1 fila devuelta' : n + ' filas devueltas') + ' en ' + fmtMs(res.ms) + ' ms';
      if (n === 0) {
        el.resultTable.textContent = '';
        setMsg('warn', 'information-outline',
          '<p class="msg-title">' + esc(ok) + '</p><p class="msg-hint">La consulta es válida pero no devuelve resultados. Prueba a relajar las condiciones.</p>');
      } else {
        renderTable(res);
        setMsg('ok', 'check-circle-outline', '<p class="msg-title">' + esc(ok) + '</p>');
      }
    } else {
      state.lastResult = null;
      el.btnExportCsv.disabled = true;
      el.resultTable.textContent = '';
      setMsg('ok', 'check-circle-outline',
        '<p class="msg-title">Consulta ejecutada: ' + esc(res.message) + ' (' + fmtMs(res.ms) + ' ms)</p>' +
        '<p class="msg-hint">Los cambios solo existen en tu navegador. Usa «Restaurar datos originales» para volver al principio.</p>');
      renderSummary();
      renderMisTablas();
    }
  }

  function execute() {
    if (!state.db) return null;
    var sql = el.input.value.trim();
    var res;
    try {
      res = SqlEngine.run(state.db, sql);
    } catch (err) {
      reportError(err);
      return null;
    }
    addHistory(sql);
    showResult(res);
    return res;
  }

  function clearEditor() {
    setEditor('', true);
    el.resultTable.textContent = '';
    state.lastResult = null;
    el.btnExportCsv.disabled = true;
    setMsg('info', 'information-outline', 'Editor vacío. Escribe una consulta y pulsa «Ejecutar».');
  }

  function restoreData() {
    if (!state.db) return;
    state.db.reset();
    renderSummary();
    renderMisTablas();
    updateER();
    el.resultTable.textContent = '';
    state.lastResult = null;
    el.btnExportCsv.disabled = true;
    setMsg('ok', 'database-refresh-outline', '<p class="msg-title">Datos originales restaurados.</p><p class="msg-hint">Todas las tablas han vuelto a su estado inicial.</p>');
  }

  /* ---------- Historial ---------- */
  function loadHistory() {
    try { var h = JSON.parse(lsGet(LS.hist, '[]')); state.history = Array.isArray(h) ? h.slice(0, HISTORY_MAX) : []; }
    catch (e) { state.history = []; }
  }
  function addHistory(sql) {
    state.history = [sql].concat(state.history.filter(function (h) { return h !== sql; })).slice(0, HISTORY_MAX);
    lsSet(LS.hist, JSON.stringify(state.history));
    renderHistory();
  }
  function renderHistory() {
    el.histList.textContent = '';
    state.history.forEach(function (q) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = q.replace(/\s+/g, ' ');
      b.title = q;
      b.addEventListener('click', function () { setEditor(q, true); });
      li.appendChild(b);
      el.histList.appendChild(li);
    });
    el.histEmpty.hidden = state.history.length > 0;
    el.btnClearHist.hidden = state.history.length === 0;
  }

  /* ---------- Pestañas ---------- */
  var TABS = ['libre', 'teoria', 'crear', 'ejemplos', 'examen'];
  function switchTab(name, focusTab) {
    TABS.forEach(function (t) {
      var on = t === name;
      var tab = $('tab-' + t);
      if (!tab) return;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      var panel = $('panel-' + t);
      if (panel) panel.hidden = !on;
      if (on && focusTab) tab.focus();
    });
    if (name === 'crear') {
      renderMisTablas();
    }
  }

  /* ---------- Mis tablas ---------- */
  function renderMisTablas() {
    if (!state.db) return;
    var userList = $('mis-tablas-lista');
    var emptyBox = $('mis-tablas-vacio');
    var counter = $('mis-tablas-contador');
    var sisList = $('tablas-sistema-lista');
    var sisCount = $('tablas-sistema-count');
    if (!userList || !sisList) return;

    var userTableNames = state.db.userTables ? Array.from(state.db.userTables) : [];
    var allTableNames = state.db.tableNames();
    var sysTableNames = allTableNames.filter(function (t) { return userTableNames.indexOf(t) < 0; });

    counter.textContent = plural(userTableNames.length, 'tabla creada', 'tablas creadas');
    emptyBox.hidden = userTableNames.length > 0;
    userList.textContent = '';

    function createTableCard(t, isUser) {
      var card = document.createElement('div');
      card.className = 'tabla-card';
      var rowsCount = (state.db.tables[t] || []).length;
      var sch = state.db.schema[t] || [];

      var head = '<div class="tabla-card-head">' +
        '<h4 class="tabla-card-title">' + esc(t) + '</h4>' +
        '<span class="badge">' + plural(rowsCount, 'fila', 'filas') + '</span>' +
        '</div>';

      var colsHtml = '<div class="tabla-card-cols">';
      sch.forEach(function (c) {
        var badges = '';
        if (c.pk) badges += '<span class="pk-label">PK</span> ';
        var isFk = (state.db.relaciones || []).some(function (r) {
          return r.from.toLowerCase() === (t + '.' + c.name).toLowerCase();
        });
        if (isFk) badges += '<span class="fk-label">FK</span> ';
        colsHtml += '<div class="tabla-card-col"><span>' + badges + esc(c.name) + '</span><span class="muted">' + esc(c.type) + '</span></div>';
      });
      colsHtml += '</div>';

      var actions = document.createElement('div');
      actions.className = 'tabla-card-actions';

      var btnSelect = document.createElement('button');
      btnSelect.type = 'button';
      btnSelect.className = 'btn btn-small';
      btnSelect.innerHTML = icon('table-search') + ' Ver datos';
      btnSelect.addEventListener('click', function () {
        setEditor('SELECT * FROM ' + t + ';', true);
        execute();
        el.editorCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      actions.appendChild(btnSelect);

      var btnInsert = document.createElement('button');
      btnInsert.type = 'button';
      btnInsert.className = 'btn btn-small';
      btnInsert.innerHTML = icon('plus-circle-outline') + ' Insertar';
      btnInsert.addEventListener('click', function () {
        var colNames = sch.map(function (c) { return c.name; });
        var valPlaceholders = sch.map(function (c) {
          if (c.type === 'INTEGER' || c.type === 'REAL') return '0';
          if (c.type === 'BOOLEAN') return 'TRUE';
          return "'...'";
        });
        var sql = 'INSERT INTO ' + t + ' (' + colNames.join(', ') + ')\nVALUES (' + valPlaceholders.join(', ') + ');';
        setEditor(sql, true);
        el.editorCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      actions.appendChild(btnInsert);

      if (isUser) {
        var btnDrop = document.createElement('button');
        btnDrop.type = 'button';
        btnDrop.className = 'btn btn-small';
        btnDrop.style.color = 'var(--danger)';
        btnDrop.innerHTML = icon('delete-outline') + ' Borrar';
        btnDrop.addEventListener('click', function () {
          setEditor('DROP TABLE ' + t + ';', true);
          execute();
        });
        actions.appendChild(btnDrop);
      }

      card.innerHTML = head + colsHtml;
      card.appendChild(actions);
      return card;
    }

    userTableNames.forEach(function (t) {
      userList.appendChild(createTableCard(t, true));
    });

    sisCount.textContent = String(sysTableNames.length);
    sisList.textContent = '';
    sysTableNames.forEach(function (t) {
      sisList.appendChild(createTableCard(t, false));
    });
  }

  /* ---------- Ejemplos guiados ---------- */
  function renderEjemplos() {
    el.ejemplos.textContent = '';
    (window.EJEMPLOS[state.bdKey] || []).forEach(function (ej) {
      var li = document.createElement('li');
      li.className = 'ejemplo';
      li.innerHTML =
        '<h3>' + esc(ej.titulo) + '</h3>' +
        '<span class="concepto">' + esc(ej.concepto) + '</span>' +
        '<p>' + esc(ej.descripcion) + '</p>' +
        '<pre><code>' + highlight(ej.sql) + '</code></pre>';
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-small';
      b.innerHTML = icon('code-tags') + ' Cargar en editor';
      b.addEventListener('click', function () {
        setEditor(ej.sql, true);
        el.editorCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      li.appendChild(b);
      el.ejemplos.appendChild(li);
    });
  }

  /* ---------- Modo examen ---------- */
  function examList() { return window.EXAMENES[state.bdKey] || []; }

  function loadDone() {
    try { var d = JSON.parse(lsGet(LS.done + state.bdKey, '[]')); state.exam.done = Array.isArray(d) ? d : []; }
    catch (e) { state.exam.done = []; }
  }

  function renderExamList() {
    loadDone();
    el.examList.textContent = '';
    examList().forEach(function (ex, i) {
      var b = document.createElement('button');
      var done = state.exam.done.indexOf(ex.id) >= 0;
      b.type = 'button';
      b.className = 'exam-chip' + (done ? ' is-done' : '');
      b.setAttribute('aria-pressed', state.exam.idx === i ? 'true' : 'false');
      b.innerHTML = (done ? icon('check-circle-outline') : icon('file-document-outline')) + ' Enunciado ' + (i + 1) + (done ? ' (resuelto)' : '');
      b.addEventListener('click', function () { selectExam(i); });
      el.examList.appendChild(b);
    });
  }

  function stopTimer() { if (state.exam.timer) { clearInterval(state.exam.timer); state.exam.timer = null; } }
  function tick() { el.examTime.textContent = fmtTime(Math.floor((Date.now() - state.exam.start) / 1000)); }

  function resetExamView() {
    stopTimer();
    state.exam.idx = null;
    state.exam.attempts = 0;
    el.examActual.hidden = true;
    renderExamList();
  }

  function selectExam(i) {
    var ex = examList()[i];
    if (!ex) return;
    stopTimer();
    state.exam.idx = i;
    state.exam.attempts = 0;
    state.exam.start = Date.now();
    el.examActual.hidden = false;
    el.examDif.textContent = ex.dificultad;
    el.examEnun.textContent = ex.enunciado;
    el.examIntentos.textContent = '0';
    el.examPista.hidden = true;
    el.examSol.hidden = true;
    el.btnSolucion.hidden = true;
    el.examFeedback.hidden = true;
    tick();
    state.exam.timer = setInterval(tick, 1000);
    renderExamList();
    el.input.focus();
  }

  function setFeedback(kind, iconName, html) {
    el.examFeedback.hidden = false;
    el.examFeedback.className = 'msg msg-' + kind;
    el.examFeedback.innerHTML = icon(iconName) + '<div class="msg-body">' + html + '</div>';
  }

  function checkExam() {
    var ex = examList()[state.exam.idx];
    if (!ex || !state.db) return;
    var sql = el.input.value.trim();
    if (!sql) {
      setFeedback('warn', 'information-outline', '<p class="msg-title">Escribe primero tu consulta en el editor.</p>');
      return;
    }
    state.exam.attempts++;
    el.examIntentos.textContent = String(state.exam.attempts);
    if (state.exam.attempts >= 3) el.btnSolucion.hidden = false;

    var json = state.json[state.bdKey];
    var actual, expected;
    try {
      actual = SqlEngine.run(SqlEngine.createDatabase(json), sql);
    } catch (err) {
      reportError(err);
      setFeedback('error', 'close-circle-outline',
        '<p class="msg-title">Incorrecto: tu consulta tiene un error y no se puede ejecutar.</p><p class="msg-hint">Mira el mensaje de error en el panel «Resultado» y corrígela.</p>');
      return;
    }
    addHistory(sql);
    showResult(actual);
    if (actual.type !== 'select') {
      setFeedback('warn', 'information-outline', '<p class="msg-title">Para comprobar el ejercicio necesitas una consulta SELECT.</p>');
      return;
    }
    expected = SqlEngine.run(SqlEngine.createDatabase(json), ex.solucion);
    var cmp = SqlEngine.compareResults(actual, expected);
    if (cmp.ok) {
      var secs = Math.floor((Date.now() - state.exam.start) / 1000);
      stopTimer();
      el.examTime.textContent = fmtTime(secs);
      if (state.exam.done.indexOf(ex.id) < 0) {
        state.exam.done.push(ex.id);
        lsSet(LS.done + state.bdKey, JSON.stringify(state.exam.done));
      }
      renderExamList();
      setFeedback('ok', 'check-circle-outline',
        '<p class="msg-title">Correcto</p><p class="msg-hint">Tu consulta devuelve el resultado esperado. Intentos: ' + state.exam.attempts + ' · Tiempo: ' + fmtTime(secs) + '.</p>');
      return;
    }
    var motivo;
    if (cmp.reason === 'filas') {
      motivo = 'Tu consulta devuelve ' + plural(cmp.actual, 'fila', 'filas') + ', se esperaban ' + cmp.expected + '. Revisa las condiciones (WHERE, HAVING), los JOIN y si necesitas DISTINCT o GROUP BY.';
    } else if (cmp.reason === 'columnas') {
      motivo = 'Tu consulta devuelve ' + plural(cmp.actual, 'columna', 'columnas') + ', se esperaban ' + cmp.expected + '. Revisa qué columnas pide el enunciado en el SELECT.';
    } else {
      motivo = 'El número de filas y de columnas es correcto (' + cmp.actual + ' filas), pero los valores no coinciden. Revisa las condiciones de filtrado y los cálculos.';
    }
    setFeedback('error', 'close-circle-outline',
      '<p class="msg-title">Incorrecto: ' + esc(motivo) + '</p><p class="msg-hint"><strong>Pista:</strong> ' + esc(ex.pista) + '</p>');
  }

  function showHint() {
    var ex = examList()[state.exam.idx];
    if (!ex) return;
    el.examPista.textContent = 'Pista: ' + ex.pista;
    el.examPista.hidden = false;
  }
  function showSolution() {
    var ex = examList()[state.exam.idx];
    if (!ex) return;
    el.examSol.textContent = ex.solucion + ';';
    el.examSol.hidden = false;
  }

  /* ---------- Exportar / importar ---------- */
  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportSql() {
    var text = el.input.value.trim();
    if (!text) { setMsg('warn', 'information-outline', '<p class="msg-title">No hay ninguna consulta que exportar.</p><p class="msg-hint">Escribe una consulta en el editor primero.</p>'); return; }
    download('consulta.sql', text + '\n', 'text/plain');
  }

  function importSql(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      setEditor(String(reader.result).replace(/\r\n/g, '\n'), true);
      setMsg('info', 'information-outline', 'Consulta importada desde «' + esc(file.name) + '». Pulsa «Ejecutar» para probarla.');
    };
    reader.onerror = function () {
      setMsg('error', 'alert-circle-outline', '<p class="msg-title">No se ha podido leer el archivo.</p>');
    };
    reader.readAsText(file);
  }

  function exportDatabase() {
    if (!state.db) return;
    try {
      var sql = SqlEngine.exportDatabaseToSql(state.db, false);
      download('mi_base_de_datos.sql', sql, 'text/plain');
      setMsg('ok', 'database-export-outline',
        '<p class="msg-title">Base de datos exportada en «mi_base_de_datos.sql».</p>' +
        '<p class="msg-hint">Contiene la definición completa de tablas (CREATE TABLE) y los datos actuales (INSERT INTO) en el orden de dependencias correcto.</p>');
    } catch (err) {
      reportError(err);
    }
  }

  function importDatabase(file) {
    if (!file || !state.db) return;
    var reader = new FileReader();
    reader.onload = function () {
      var content = String(reader.result).replace(/\r\n/g, '\n');
      try {
        var res = SqlEngine.run(state.db, content);
        renderSummary();
        renderMisTablas();
        updateER();
        setMsg('ok', 'database-import-outline',
          '<p class="msg-title">Base de datos importada correctamente desde «' + esc(file.name) + '».</p>' +
          '<p class="msg-hint">' + esc(res.message) + ' (' + fmtMs(res.ms) + ' ms).</p>');
      } catch (err) {
        reportError(err);
      }
    };
    reader.onerror = function () {
      setMsg('error', 'alert-circle-outline', '<p class="msg-title">No se ha podido leer el archivo .sql.</p>');
    };
    reader.readAsText(file);
  }

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = typeof v === 'number' ? String(Math.round(v * 10000) / 10000) : String(v);
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCsv() {
    var r = state.lastResult;
    if (!r) return;
    var lines = [r.columns.map(csvCell).join(',')].concat(r.rows.map(function (row) { return row.map(csvCell).join(','); }));
    download('resultados.csv', '\uFEFF' + lines.join('\r\n') + '\r\n', 'text/csv');
  }

  /* ---------- Verificación automática (consola del navegador) ---------- */
  window.tecnoLSMVerificar = function () {
    var keys = Object.keys(BDS);
    return Promise.all(keys.map(getJson)).then(function () {
      var out = { bds: keys.length, detalle: {}, consultas: {}, ejemplos: {}, examenes: {}, errores: [] };
      keys.forEach(function (k) {
        var db = SqlEngine.createDatabase(state.json[k]);
        var filas = {};
        db.tableNames().forEach(function (t) { filas[t] = db.tables[t].length; });
        out.detalle[k] = { tablas: db.tableNames().length, filas: filas };
        var ej = window.EJEMPLOS[k] || [], ex = window.EXAMENES[k] || [];
        out.ejemplos[k] = ej.length;
        out.examenes[k] = ex.length;
        ej.forEach(function (e, i) {
          try { SqlEngine.run(SqlEngine.createDatabase(state.json[k]), e.sql); }
          catch (err) { out.errores.push(k + ' ejemplo ' + (i + 1) + ': ' + err.message); }
        });
        ex.forEach(function (e, i) {
          try { SqlEngine.run(SqlEngine.createDatabase(state.json[k]), e.solucion); }
          catch (err) { out.errores.push(k + ' examen ' + (i + 1) + ': ' + err.message); }
        });
      });
      var q = function (k, sql) { return SqlEngine.run(SqlEngine.createDatabase(state.json[k]), sql).rows.length; };
      out.consultas.q8_alumnos_grupo_A = q('instituto', "SELECT nombre, apellidos FROM alumnos WHERE grupo = 'A'");
      out.consultas.q9_media_por_alumno = q('instituto', 'SELECT a.nombre, AVG(n.nota) FROM alumnos a JOIN notas n ON a.id = n.alumno_id GROUP BY a.id');
      out.consultas.q10_total_por_cliente = q('tienda', 'SELECT c.nombre, SUM(l.cantidad * l.precio_unitario) AS total FROM clientes c JOIN pedidos p ON c.id = p.cliente_id JOIN lineas_pedido l ON p.id = l.pedido_id GROUP BY c.id');
      out.consultas.alumnos = q('instituto', 'SELECT * FROM alumnos');
      out.consultas.productos = q('tienda', 'SELECT * FROM productos');
      out.consultas.libros = q('biblioteca', 'SELECT * FROM libros');

      /* Verificación de funcionalidades DDL y relaciones */
      try {
        var dbTest = SqlEngine.createDatabase({ nombre: 'Test DDL', tablas: {}, relaciones: [] });
        SqlEngine.run(dbTest, 'CREATE TABLE test (id INTEGER PRIMARY KEY, nombre TEXT)');
        out.ddl_create = dbTest.tableNames().indexOf('test') >= 0;

        SqlEngine.run(dbTest, "INSERT INTO test VALUES (1, 'Ana')");
        var selRes = SqlEngine.run(dbTest, "SELECT * FROM test");
        out.ddl_select = selRes.rows.length === 1;

        SqlEngine.run(dbTest, "DROP TABLE test");
        out.ddl_drop = dbTest.tableNames().indexOf('test') === -1;

        SqlEngine.run(dbTest, 'CREATE TABLE padres (id INTEGER PRIMARY KEY, nombre TEXT)');
        SqlEngine.run(dbTest, 'CREATE TABLE hija (id INTEGER PRIMARY KEY, padre_id INTEGER, FOREIGN KEY (padre_id) REFERENCES padres(id))');
        out.ddl_fk_create = dbTest.tableNames().indexOf('hija') >= 0;

        var fkErrorCaught = false;
        try {
          SqlEngine.run(dbTest, 'INSERT INTO hija VALUES (1, 999)');
        } catch (e) {
          fkErrorCaught = true;
        }
        out.ddl_fk_violation = fkErrorCaught;

        var expSql = SqlEngine.exportDatabaseToSql(dbTest);
        out.ddl_export = expSql.indexOf('CREATE TABLE padres') >= 0 && expSql.indexOf('CREATE TABLE hija') >= 0;

        var dbImport = SqlEngine.createDatabase({ nombre: 'ImportTest', tablas: {}, relaciones: [] });
        SqlEngine.run(dbImport, expSql);
        out.ddl_import = dbImport.tableNames().indexOf('padres') >= 0 && dbImport.tableNames().indexOf('hija') >= 0;
      } catch (errDdl) {
        out.errores.push('DDL verification error: ' + errDdl.message);
      }

      if (window.console) console.log(JSON.stringify(out, null, 2));
      return out;
    });
  };

  /* ---------- Arranque ---------- */
  function bind() {
    el.themeIcon = $('theme-icon'); el.themeLabel = $('theme-label');
    el.bdSelect = $('bd-select'); el.bdNombre = $('bd-nombre'); el.bdResumen = $('bd-resumen'); el.bdTablas = $('bd-tablas');
    el.er = $('er-container');
    el.input = $('sql-input'); el.hl = $('sql-highlight'); el.hlCode = el.hl.querySelector('code');
    el.editorCard = document.querySelector('.editor-card');
    el.resultMsg = $('result-msg'); el.resultTable = $('result-table');
    el.btnExportCsv = $('btn-export-csv');
    el.histList = $('historial-lista'); el.histEmpty = $('historial-vacio'); el.btnClearHist = $('btn-clear-history');
    el.ejemplos = $('ejemplos-lista');
    el.examList = $('examen-lista'); el.examActual = $('examen-actual'); el.examDif = $('examen-dificultad');
    el.examIntentos = $('examen-intentos'); el.examTime = $('examen-tiempo'); el.examEnun = $('examen-enunciado');
    el.examFeedback = $('examen-feedback'); el.examPista = $('examen-pista'); el.examSol = $('examen-solucion');
    el.btnSolucion = $('btn-solucion');

    $('theme-toggle').addEventListener('click', toggleTheme);
    el.bdSelect.addEventListener('change', function () { loadBd(el.bdSelect.value); });

    el.input.addEventListener('input', function () { updateHighlight(); saveDraft(); scheduleER(); });
    el.input.addEventListener('scroll', syncScroll);
    el.input.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); execute(); }
    });
    if (window.ResizeObserver) new ResizeObserver(syncScroll).observe(el.input);

    $('btn-run').addEventListener('click', execute);
    $('btn-clear').addEventListener('click', clearEditor);
    $('btn-restore').addEventListener('click', restoreData);
    $('btn-export-sql').addEventListener('click', exportSql);
    $('btn-import-sql').addEventListener('click', function () { $('file-import').click(); });
    $('file-import').addEventListener('change', function (e) { importSql(e.target.files[0]); e.target.value = ''; });
    el.btnExportCsv.addEventListener('click', exportCsv);
    el.btnClearHist.addEventListener('click', function () { state.history = []; lsSet(LS.hist, '[]'); renderHistory(); });

    var btnExpDb = $('btn-export-db');
    if (btnExpDb) btnExpDb.addEventListener('click', exportDatabase);
    var btnCrearExpDb = $('btn-crear-export-db');
    if (btnCrearExpDb) btnCrearExpDb.addEventListener('click', exportDatabase);

    var fileImpDb = $('file-import-db');
    var btnImpDb = $('btn-import-db');
    if (btnImpDb && fileImpDb) btnImpDb.addEventListener('click', function () { fileImpDb.click(); });
    var btnCrearImpDb = $('btn-crear-import-db');
    if (btnCrearImpDb && fileImpDb) btnCrearImpDb.addEventListener('click', function () { fileImpDb.click(); });
    if (fileImpDb) fileImpDb.addEventListener('change', function (e) { importDatabase(e.target.files[0]); e.target.value = ''; });

    var pSimple = $('btn-plantilla-simple');
    if (pSimple) pSimple.addEventListener('click', function () {
      setEditor('CREATE TABLE profesores (\n  id INTEGER PRIMARY KEY,\n  nombre TEXT NOT NULL,\n  departamento TEXT\n);', true);
      el.editorCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    var pRel = $('btn-plantilla-relacion');
    if (pRel) pRel.addEventListener('click', function () {
      setEditor('CREATE TABLE calificaciones (\n  id INTEGER PRIMARY KEY,\n  alumno_id INTEGER,\n  asignatura TEXT NOT NULL,\n  nota REAL,\n  FOREIGN KEY (alumno_id) REFERENCES alumnos(id)\n);', true);
      el.editorCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    var pIns = $('btn-plantilla-insert');
    if (pIns) pIns.addEventListener('click', function () {
      setEditor("INSERT INTO alumnos (id, nombre, apellidos, curso, grupo)\nVALUES (31, 'Marcos', 'Pérez Gil', '2º Bach', 'A');", true);
      el.editorCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.btn-load-teoria'), function (btn) {
      btn.addEventListener('click', function () {
        var sql = btn.getAttribute('data-sql');
        if (sql) {
          setEditor(sql, true);
          el.editorCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });

    $('btn-comprobar').addEventListener('click', checkExam);
    $('btn-pista').addEventListener('click', showHint);
    el.btnSolucion.addEventListener('click', showSolution);

    TABS.forEach(function (t, i) {
      var tab = $('tab-' + t);
      tab.addEventListener('click', function () { switchTab(t); });
      tab.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); switchTab(TABS[(i + d + TABS.length) % TABS.length], true); }
      });
    });
  }

  function init() {
    bind();
    applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    loadHistory();
    renderHistory();
    var draft = lsGet(LS.draft, '');
    if (draft) { el.input.value = draft; updateHighlight(); }
    var saved = lsGet(LS.bd, 'instituto');
    loadBd(BDS[saved] ? saved : 'instituto');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
