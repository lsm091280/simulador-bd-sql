/* ============================================================
   tecnoLSM · Simulador de bases de datos
   Motor SQL: tokenizador + parser (descenso recursivo) + ejecutor
   sobre datos JSON en memoria. Sin dependencias.
   Soporta: SELECT (DISTINCT, WHERE, GROUP BY, HAVING, ORDER BY,
   LIMIT/OFFSET, JOIN INNER/LEFT/CROSS, subconsultas en WHERE/FROM/SELECT,
   funciones de agregación y escalares, CASE), INSERT, UPDATE, DELETE.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- Errores legibles ---------- */
  class SqlError extends Error {
    constructor(message, opts) {
      super(message);
      opts = opts || {};
      this.name = 'SqlError';
      this.line = opts.line || null;
      this.detail = opts.detail || '';
      this.hint = opts.hint || '';
    }
  }

  const SYNTAX_DETAIL =
    'El motor lee tu consulta de izquierda a derecha y se detiene en el primer sitio donde no la entiende. ' +
    'Revisa comas, paréntesis, comillas y el orden de las cláusulas: ' +
    'SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT.';

  /* ---------- Utilidades ---------- */
  function levenshtein(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  function closest(word, candidates) {
    let best = null, bestD = Infinity;
    for (const c of candidates) {
      const d = levenshtein(word, c);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best !== null && bestD <= Math.max(2, Math.floor(word.length / 3)) ? best : null;
  }

  const KEYWORDS = new Set([
    'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET',
    'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'ON', 'AS',
    'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL', 'DISTINCT',
    'ASC', 'DESC', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'TRUE', 'FALSE', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'CREATE', 'DROP', 'ALTER', 'TABLE', 'UNION'
  ]);
  const STATEMENT_STARTS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  const AGG = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);
  const SCALAR_FUNCS = ['UPPER', 'LOWER', 'LENGTH', 'ROUND', 'ABS', 'COALESCE', 'IFNULL',
    'SUBSTR', 'SUBSTRING', 'TRIM', 'CONCAT', 'YEAR', 'FLOOR', 'CEIL'];

  /* ---------- Tokenizador ---------- */
  function tokenize(sql) {
    const toks = [];
    const n = sql.length;
    let i = 0, line = 1;
    while (i < n) {
      const c = sql[i];
      if (c === '\n') { line++; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (c === '-' && sql[i + 1] === '-') { while (i < n && sql[i] !== '\n') i++; continue; }
      if (c === '/' && sql[i + 1] === '*') {
        const e = sql.indexOf('*/', i + 2);
        const end = e < 0 ? n : e + 2;
        for (let k = i; k < end; k++) if (sql[k] === '\n') line++;
        i = end; continue;
      }
      if (c === "'") {
        const startLine = line;
        let s = '', j = i + 1, closed = false;
        while (j < n) {
          if (sql[j] === "'") {
            if (sql[j + 1] === "'") { s += "'"; j += 2; continue; }
            closed = true; j++; break;
          }
          if (sql[j] === '\n') line++;
          s += sql[j++];
        }
        if (!closed) {
          throw new SqlError(
            'Error de sintaxis en la línea ' + startLine + ": falta cerrar el texto con una comilla simple (').",
            { line: startLine, detail: 'Los textos en SQL van entre comillas simples, por ejemplo \'A\'. Cada comilla que se abre debe cerrarse.' });
        }
        toks.push({ t: 'str', v: s, line: startLine });
        i = j; continue;
      }
      if (c === '"' || c === '`') {
        const e = sql.indexOf(c, i + 1);
        if (e < 0) {
          throw new SqlError('Error de sintaxis en la línea ' + line + ': falta cerrar el nombre entre comillas (' + c + ').', { line: line, detail: SYNTAX_DETAIL });
        }
        toks.push({ t: 'id', v: sql.slice(i + 1, e), line: line });
        i = e + 1; continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(sql[i + 1] || ''))) {
        const m = /^(\d+(\.\d+)?|\.\d+)/.exec(sql.slice(i));
        toks.push({ t: 'num', v: parseFloat(m[0]), line: line });
        i += m[0].length; continue;
      }
      if (/[A-Za-z_\u00C0-\u024F]/.test(c)) {
        const m = /^[A-Za-z_\u00C0-\u024F][A-Za-z0-9_\u00C0-\u024F]*/.exec(sql.slice(i));
        const w = m[0];
        const up = w.toUpperCase();
        if (KEYWORDS.has(up)) toks.push({ t: 'kw', v: up, raw: w, line: line });
        else toks.push({ t: 'id', v: w, line: line });
        i += w.length; continue;
      }
      const two = sql.substr(i, 2);
      if (two === '<=' || two === '>=' || two === '<>' || two === '!=' || two === '||') {
        toks.push({ t: 'op', v: two === '!=' ? '<>' : two, line: line });
        i += 2; continue;
      }
      if ('=<>+-*/%(),.;'.indexOf(c) >= 0) {
        toks.push({ t: 'op', v: c, line: line });
        i++; continue;
      }
      throw new SqlError(
        'Error de sintaxis en la línea ' + line + ": carácter no reconocido '" + c + "'.",
        { line: line, detail: SYNTAX_DETAIL });
    }
    toks.push({ t: 'eof', v: '', line: line });
    return toks;
  }

  function tokText(t) {
    if (t.t === 'str') return "'" + t.v + "'";
    if (t.t === 'kw') return t.raw || t.v;
    return String(t.v);
  }

  /* ---------- Parser ---------- */
  class Parser {
    constructor(toks) { this.toks = toks; this.p = 0; this.tables = new Set(); }
    peek(o) { return this.toks[Math.min(this.p + (o || 0), this.toks.length - 1)]; }
    next() { const t = this.toks[this.p]; if (t.t !== 'eof') this.p++; return t; }
    isKw(v, o) { const t = this.peek(o); return t.t === 'kw' && t.v === v; }
    isOp(v, o) { const t = this.peek(o); return t.t === 'op' && t.v === v; }
    acceptKw(v) { if (this.isKw(v)) { this.p++; return true; } return false; }
    acceptOp(v) { if (this.isOp(v)) { this.p++; return true; } return false; }
    expectKw(v, desc) { if (!this.acceptKw(v)) throw this.err(desc || v); }
    expectOp(v, desc) { if (!this.acceptOp(v)) throw this.err(desc || "'" + v + "'"); }
    expectIdent(desc) {
      const t = this.peek();
      if (t.t === 'id') return this.next().v;
      throw this.err(desc || 'un nombre');
    }

    err(expected, extraHint) {
      const t = this.peek();
      let msg = 'Error de sintaxis en la línea ' + t.line + ': ';
      msg += t.t === 'eof' ? 'la consulta termina de forma inesperada' : "no se esperaba '" + tokText(t) + "'";
      if (expected) msg += ' (se esperaba ' + expected + ')';
      msg += '.';
      return new SqlError(msg, { line: t.line, detail: SYNTAX_DETAIL, hint: extraHint || '' });
    }

    parseScript() {
      const stmts = [];
      while (this.peek().t !== 'eof') {
        if (this.acceptOp(';')) continue;
        stmts.push(this.parseStatement());
        if (this.peek().t !== 'eof' && !this.isOp(';')) {
          throw this.err("el final de la consulta o ';'",
            'Comprueba que las cláusulas están en el orden correcto y que no falta ninguna coma.');
        }
      }
      return stmts;
    }

    parseStatement() {
      const t = this.peek();
      if (t.t === 'kw') {
        if (t.v === 'SELECT') return this.parseSelect();
        if (t.v === 'INSERT') return this.parseInsert();
        if (t.v === 'UPDATE') return this.parseUpdate();
        if (t.v === 'DELETE') return this.parseDelete();
        if (t.v === 'CREATE' || t.v === 'DROP' || t.v === 'ALTER') {
          throw new SqlError(
            'En este simulador no se pueden crear, modificar ni borrar tablas (' + t.v + ').',
            { line: t.line, detail: 'Las sentencias que definen la estructura (CREATE, ALTER, DROP) forman el lenguaje DDL. Aquí practicamos consultas (SELECT) y modificación de datos (INSERT, UPDATE, DELETE).' });
        }
      }
      let hint = '';
      if (t.t === 'id') {
        const c = closest(t.v, STATEMENT_STARTS);
        if (c) hint = "¿Quisiste escribir '" + c + "'?";
      }
      throw new SqlError(
        "Error de sintaxis en la línea " + t.line + ": una consulta debe empezar por SELECT, INSERT, UPDATE o DELETE (has escrito '" + tokText(t) + "').",
        { line: t.line, detail: SYNTAX_DETAIL, hint: hint });
    }

    /* ----- SELECT ----- */
    parseSelect() {
      this.expectKw('SELECT');
      const q = { type: 'select', distinct: false, items: [], from: null, joins: [], where: null, groupBy: [], having: null, orderBy: [], limit: null, offset: null };
      if (this.acceptKw('DISTINCT')) q.distinct = true;
      do {
        q.items.push(this.parseSelectItem());
      } while (this.acceptOp(','));

      if (this.acceptKw('FROM')) {
        q.from = this.parseSource();
        for (;;) {
          let kind = null;
          if (this.isKw('JOIN')) { this.next(); kind = 'inner'; }
          else if (this.isKw('INNER') && this.isKw('JOIN', 1)) { this.next(); this.next(); kind = 'inner'; }
          else if (this.isKw('LEFT')) {
            this.next(); this.acceptKw('OUTER'); this.expectKw('JOIN', 'JOIN'); kind = 'left';
          } else if (this.isKw('CROSS') && this.isKw('JOIN', 1)) { this.next(); this.next(); kind = 'cross'; }
          else if (this.isKw('RIGHT') || this.isKw('FULL')) {
            const t = this.peek();
            throw new SqlError(
              "El simulador no admite " + t.v + " JOIN en la línea " + t.line + '.',
              { line: t.line, detail: 'Puedes obtener el mismo resultado que RIGHT JOIN intercambiando el orden de las tablas y usando LEFT JOIN.', hint: 'Usa LEFT JOIN cambiando el orden de las tablas.' });
          } else if (this.isOp(',')) { this.next(); kind = 'cross'; }
          else break;
          const source = this.parseSource();
          let on = null;
          if (kind !== 'cross') {
            if (!this.isKw('ON')) throw this.err('ON', 'Un JOIN necesita una condición que indique qué columnas relacionan las tablas, por ejemplo: ON a.id = n.alumno_id');
            this.next();
            on = this.parseExpr();
          }
          q.joins.push({ kind: kind, source: source, on: on });
        }
      }
      if (this.acceptKw('WHERE')) q.where = this.parseExpr();
      if (this.acceptKw('GROUP')) {
        this.expectKw('BY', 'BY');
        do { q.groupBy.push(this.parseExpr()); } while (this.acceptOp(','));
      }
      if (this.acceptKw('HAVING')) q.having = this.parseExpr();
      if (this.acceptKw('ORDER')) {
        this.expectKw('BY', 'BY');
        do {
          const e = this.parseExpr();
          let dir = 'ASC';
          if (this.acceptKw('DESC')) dir = 'DESC'; else this.acceptKw('ASC');
          q.orderBy.push({ expr: e, dir: dir });
        } while (this.acceptOp(','));
      }
      if (this.acceptKw('LIMIT')) {
        q.limit = this.parseCount('LIMIT');
        if (this.acceptKw('OFFSET')) q.offset = this.parseCount('OFFSET');
      }
      if (this.isKw('UNION')) {
        throw new SqlError("El simulador no admite UNION (línea " + this.peek().line + ').', { line: this.peek().line, detail: 'UNION combina los resultados de dos consultas. En este nivel lo resolvemos con una sola consulta.' });
      }
      return q;
    }

    parseCount(what) {
      const t = this.peek();
      if (t.t === 'num' && Number.isInteger(t.v) && t.v >= 0) { this.next(); return t.v; }
      throw this.err('un número entero después de ' + what);
    }

    parseSelectItem() {
      if (this.isOp('*')) { this.next(); return { star: true }; }
      if (this.peek().t === 'id' && this.isOp('.', 1) && this.isOp('*', 2)) {
        const table = this.next().v; this.next(); this.next();
        return { star: true, table: table };
      }
      const expr = this.parseExpr();
      let alias = null;
      if (this.acceptKw('AS')) {
        const t = this.peek();
        if (t.t === 'id' || t.t === 'str') { alias = String(this.next().v); }
        else throw this.err('un nombre de alias después de AS');
      } else if (this.peek().t === 'id') {
        alias = this.next().v;
      }
      return { expr: expr, alias: alias };
    }

    parseSource() {
      if (this.isOp('(')) {
        this.next();
        if (!this.isKw('SELECT')) throw this.err('SELECT dentro de la subconsulta');
        const sub = this.parseSelect();
        this.expectOp(')', "')' para cerrar la subconsulta");
        let alias = null;
        if (this.acceptKw('AS')) alias = this.expectIdent('un alias');
        else if (this.peek().t === 'id') alias = this.next().v;
        return { subquery: sub, alias: alias || 'subconsulta' };
      }
      const t = this.peek();
      if (t.t !== 'id') throw this.err('el nombre de una tabla');
      const table = this.next().v;
      this.tables.add(table.toLowerCase());
      let alias = null;
      if (this.acceptKw('AS')) alias = this.expectIdent('un alias');
      else if (this.peek().t === 'id') alias = this.next().v;
      return { table: table, alias: alias, line: t.line };
    }

    /* ----- Expresiones ----- */
    parseExpr() { return this.parseOr(); }

    parseOr() {
      let l = this.parseAnd();
      while (this.acceptKw('OR')) l = { k: 'or', l: l, r: this.parseAnd() };
      return l;
    }
    parseAnd() {
      let l = this.parseNot();
      while (this.acceptKw('AND')) l = { k: 'and', l: l, r: this.parseNot() };
      return l;
    }
    parseNot() {
      if (this.isKw('NOT') && !this.isKw('EXISTS', 1)) { this.next(); return { k: 'not', e: this.parseNot() }; }
      return this.parsePredicate();
    }

    parsePredicate() {
      let left = this.parseAdd();
      for (;;) {
        const t = this.peek();
        if (t.t === 'op' && ['=', '<>', '<', '>', '<=', '>='].indexOf(t.v) >= 0) {
          this.next();
          left = { k: 'bin', op: t.v, l: left, r: this.parseAdd() };
          continue;
        }
        if (this.isKw('IS')) {
          this.next();
          const neg = this.acceptKw('NOT');
          this.expectKw('NULL', 'NULL');
          left = { k: 'isnull', e: left, neg: neg };
          continue;
        }
        let neg = false;
        if (this.isKw('NOT') && (this.isKw('IN', 1) || this.isKw('LIKE', 1) || this.isKw('BETWEEN', 1))) { this.next(); neg = true; }
        if (this.isKw('IN')) {
          this.next();
          this.expectOp('(', "'(' después de IN");
          if (this.isKw('SELECT')) {
            const q = this.parseSelect();
            this.expectOp(')', "')' para cerrar la subconsulta");
            left = { k: 'in', e: left, q: q, neg: neg };
          } else {
            const list = [];
            do { list.push(this.parseExpr()); } while (this.acceptOp(','));
            this.expectOp(')', "')' al final de la lista");
            left = { k: 'in', e: left, list: list, neg: neg };
          }
          continue;
        }
        if (this.isKw('LIKE')) {
          this.next();
          left = { k: 'like', e: left, pat: this.parseAdd(), neg: neg };
          continue;
        }
        if (this.isKw('BETWEEN')) {
          this.next();
          const lo = this.parseAdd();
          this.expectKw('AND', 'AND entre los dos límites del BETWEEN');
          const hi = this.parseAdd();
          left = { k: 'between', e: left, lo: lo, hi: hi, neg: neg };
          continue;
        }
        break;
      }
      return left;
    }

    parseAdd() {
      let l = this.parseMul();
      for (;;) {
        const t = this.peek();
        if (t.t === 'op' && (t.v === '+' || t.v === '-' || t.v === '||')) {
          this.next();
          l = { k: 'bin', op: t.v, l: l, r: this.parseMul() };
        } else break;
      }
      return l;
    }
    parseMul() {
      let l = this.parseUnary();
      for (;;) {
        const t = this.peek();
        if (t.t === 'op' && (t.v === '*' || t.v === '/' || t.v === '%')) {
          this.next();
          l = { k: 'bin', op: t.v, l: l, r: this.parseUnary() };
        } else break;
      }
      return l;
    }
    parseUnary() {
      if (this.isOp('-')) { this.next(); return { k: 'neg', e: this.parseUnary() }; }
      if (this.isOp('+')) { this.next(); return this.parseUnary(); }
      return this.parsePrimary();
    }

    parsePrimary() {
      const t = this.peek();
      if (t.t === 'num') { this.next(); return { k: 'num', v: t.v }; }
      if (t.t === 'str') { this.next(); return { k: 'str', v: t.v }; }
      if (t.t === 'kw') {
        if (t.v === 'NULL') { this.next(); return { k: 'null' }; }
        if (t.v === 'TRUE') { this.next(); return { k: 'bool', v: true }; }
        if (t.v === 'FALSE') { this.next(); return { k: 'bool', v: false }; }
        if (t.v === 'EXISTS' || (t.v === 'NOT' && this.isKw('EXISTS', 1))) {
          let neg = false;
          if (t.v === 'NOT') { this.next(); neg = true; }
          this.next();
          this.expectOp('(', "'(' después de EXISTS");
          const q = this.parseSelect();
          this.expectOp(')', "')' para cerrar la subconsulta");
          const ex = { k: 'exists', q: q };
          return neg ? { k: 'not', e: ex } : ex;
        }
        if (t.v === 'CASE') {
          this.next();
          const whens = [];
          let els = null;
          while (this.acceptKw('WHEN')) {
            const c = this.parseExpr();
            this.expectKw('THEN', 'THEN');
            whens.push({ c: c, v: this.parseExpr() });
          }
          if (!whens.length) throw this.err('WHEN');
          if (this.acceptKw('ELSE')) els = this.parseExpr();
          this.expectKw('END', 'END para cerrar el CASE');
          return { k: 'case', whens: whens, els: els };
        }
      }
      if (t.t === 'op' && t.v === '(') {
        this.next();
        if (this.isKw('SELECT')) {
          const q = this.parseSelect();
          this.expectOp(')', "')' para cerrar la subconsulta");
          return { k: 'sub', q: q };
        }
        const e = this.parseExpr();
        this.expectOp(')', "')' para cerrar el paréntesis");
        return e;
      }
      if (t.t === 'id') {
        this.next();
        if (this.isOp('(')) {
          this.next();
          const fn = { k: 'fn', name: t.v.toUpperCase(), args: [], distinct: false, star: false, line: t.line };
          if (this.isOp('*')) { this.next(); fn.star = true; }
          else if (!this.isOp(')')) {
            if (this.acceptKw('DISTINCT')) fn.distinct = true;
            do { fn.args.push(this.parseExpr()); } while (this.acceptOp(','));
          }
          this.expectOp(')', "')' para cerrar la función " + fn.name);
          return fn;
        }
        if (this.isOp('.')) {
          this.next();
          const c = this.peek();
          if (c.t !== 'id') throw this.err('el nombre de una columna después del punto');
          this.next();
          return { k: 'col', table: t.v, name: c.v };
        }
        return { k: 'col', table: null, name: t.v };
      }
      throw this.err('una columna, un valor o una expresión');
    }

    /* ----- INSERT / UPDATE / DELETE ----- */
    parseInsert() {
      this.expectKw('INSERT');
      this.expectKw('INTO', 'INTO');
      const tt = this.peek();
      const table = this.expectIdent('el nombre de la tabla');
      this.tables.add(table.toLowerCase());
      let columns = null;
      if (this.isOp('(')) {
        this.next();
        columns = [];
        do { columns.push(this.expectIdent('el nombre de una columna')); } while (this.acceptOp(','));
        this.expectOp(')', "')' después de la lista de columnas");
      }
      this.expectKw('VALUES', 'VALUES');
      const rows = [];
      do {
        this.expectOp('(', "'(' antes de los valores");
        const vals = [];
        do { vals.push(this.parseExpr()); } while (this.acceptOp(','));
        this.expectOp(')', "')' después de los valores");
        rows.push(vals);
      } while (this.acceptOp(','));
      return { type: 'insert', table: table, columns: columns, rows: rows, line: tt.line };
    }

    parseUpdate() {
      this.expectKw('UPDATE');
      const tt = this.peek();
      const table = this.expectIdent('el nombre de la tabla');
      this.tables.add(table.toLowerCase());
      this.expectKw('SET', 'SET');
      const sets = [];
      do {
        const col = this.expectIdent('el nombre de una columna');
        this.expectOp('=', "'=' después del nombre de la columna");
        sets.push({ col: col, expr: this.parseExpr() });
      } while (this.acceptOp(','));
      let where = null;
      if (this.acceptKw('WHERE')) where = this.parseExpr();
      return { type: 'update', table: table, sets: sets, where: where, line: tt.line };
    }

    parseDelete() {
      this.expectKw('DELETE');
      this.expectKw('FROM', 'FROM');
      const tt = this.peek();
      const table = this.expectIdent('el nombre de la tabla');
      this.tables.add(table.toLowerCase());
      let where = null;
      if (this.acceptKw('WHERE')) where = this.parseExpr();
      return { type: 'delete', table: table, where: where, line: tt.line };
    }
  }

  /* ---------- Texto de expresiones (nombre por defecto de columnas) ---------- */
  function toSql(e) {
    switch (e.k) {
      case 'num': return String(e.v);
      case 'str': return "'" + e.v + "'";
      case 'bool': return e.v ? 'TRUE' : 'FALSE';
      case 'null': return 'NULL';
      case 'col': return (e.table ? e.table + '.' : '') + e.name;
      case 'neg': return '-' + toSql(e.e);
      case 'bin': return toSql(e.l) + ' ' + e.op + ' ' + toSql(e.r);
      case 'and': return toSql(e.l) + ' AND ' + toSql(e.r);
      case 'or': return toSql(e.l) + ' OR ' + toSql(e.r);
      case 'not': return 'NOT ' + toSql(e.e);
      case 'fn': return e.name + '(' + (e.distinct ? 'DISTINCT ' : '') + (e.star ? '*' : e.args.map(toSql).join(', ')) + ')';
      case 'isnull': return toSql(e.e) + (e.neg ? ' IS NOT NULL' : ' IS NULL');
      case 'like': return toSql(e.e) + (e.neg ? ' NOT LIKE ' : ' LIKE ') + toSql(e.pat);
      case 'between': return toSql(e.e) + (e.neg ? ' NOT BETWEEN ' : ' BETWEEN ') + toSql(e.lo) + ' AND ' + toSql(e.hi);
      case 'in': return toSql(e.e) + (e.neg ? ' NOT IN (...)' : ' IN (...)');
      case 'sub': return '(subconsulta)';
      case 'exists': return 'EXISTS (...)';
      case 'case': return 'CASE';
      default: return '?';
    }
  }

  /* ---------- Base de datos en memoria ---------- */
  function inferType(values) {
    const vs = values.filter(function (v) { return v !== null && v !== undefined; });
    if (!vs.length) return 'TEXT';
    if (vs.every(function (v) { return typeof v === 'boolean'; })) return 'BOOLEAN';
    if (vs.every(function (v) { return typeof v === 'number'; })) {
      return vs.every(Number.isInteger) ? 'INTEGER' : 'DECIMAL';
    }
    if (vs.every(function (v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); })) return 'DATE';
    return 'TEXT';
  }

  function createDatabase(json) {
    const original = JSON.parse(JSON.stringify(json.tablas || json.tables || {}));
    const db = {
      nombre: json.nombre || 'Base de datos',
      relaciones: json.relaciones || [],
      schema: {},
      tables: null,
      original: original,
      reset: function () { this.tables = JSON.parse(JSON.stringify(this.original)); },
      tableNames: function () { return Object.keys(this.schema); }
    };
    Object.keys(original).forEach(function (t) {
      const names = [];
      original[t].forEach(function (row) {
        Object.keys(row).forEach(function (k) { if (names.indexOf(k) < 0) names.push(k); });
      });
      db.schema[t] = names.map(function (n) {
        return { name: n, type: inferType(original[t].map(function (r) { return r[n]; })) };
      });
    });
    db.reset();
    return db;
  }

  function resolveTable(db, name, line) {
    const names = db.tableNames();
    const found = names.find(function (n) { return n.toLowerCase() === String(name).toLowerCase(); });
    if (found) return found;
    const c = closest(name, names);
    throw new SqlError("La tabla '" + name + "' no existe", {
      line: line,
      hint: (c ? "¿Quisiste escribir '" + c + "'? " : '') + 'Tablas disponibles: ' + names.join(', ') + '.',
      detail: 'Una base de datos guarda la información en tablas. Solo puedes consultar las tablas que existen en la base de datos activa; mira el diagrama ER para ver sus nombres exactos.'
    });
  }

  /* ---------- Semántica de valores ---------- */
  function cmp(a, b) {
    if (typeof a === 'boolean') a = a ? 1 : 0;
    if (typeof b === 'boolean') b = b ? 1 : 0;
    if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
    if (typeof a === 'number' && typeof b === 'string' && b.trim() !== '' && !isNaN(b)) return cmp(a, Number(b));
    if (typeof b === 'number' && typeof a === 'string' && a.trim() !== '' && !isNaN(a)) return cmp(Number(a), b);
    const sa = String(a), sb = String(b);
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  }

  function sortCmp(a, b) {
    if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'es');
    return cmp(a, b);
  }

  function tri(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    return v !== '';
  }
  function truthy(v) { return tri(v) === true; }

  function likeToRegex(p) {
    let re = '';
    for (const ch of String(p)) {
      if (ch === '%') re += '[\\s\\S]*';
      else if (ch === '_') re += '[\\s\\S]';
      else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('^' + re + '$', 'i');
  }

  function toNumber(v, op) {
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(v)) return Number(v);
    throw new SqlError("No se puede hacer la operación '" + op + "' con el valor de texto '" + v + "'", {
      detail: 'Las operaciones aritméticas (+, -, *, /) solo funcionan con números. Comprueba que la columna que usas es numérica.'
    });
  }

  /* ---------- Resolución de columnas ---------- */
  function findCol(cols, ref) {
    const name = ref.name.toLowerCase();
    const tbl = ref.table ? ref.table.toLowerCase() : null;
    let found = -1;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (c.name.toLowerCase() !== name) continue;
      if (tbl && c.table.toLowerCase() !== tbl) continue;
      if (found >= 0) return -2;
      found = i;
    }
    return found;
  }

  function resolveCol(ref, env) {
    let scope = env;
    while (scope) {
      const idx = findCol(scope.cols, ref);
      if (idx === -2) {
        throw new SqlError("La columna '" + ref.name + "' es ambigua: existe en más de una tabla", {
          hint: "Indica de qué tabla la quieres usando el nombre o alias de la tabla, por ejemplo: tabla." + ref.name,
          detail: 'Cuando dos tablas tienen una columna con el mismo nombre, SQL no sabe cuál elegir. Se escribe tabla.columna para aclararlo.'
        });
      }
      if (idx >= 0) return { scope: scope, idx: idx };
      scope = scope.parent;
    }
    const cols = env.cols;
    if (!cols.length) {
      throw new SqlError("La columna '" + ref.name + "' no existe (la consulta no tiene FROM)", { detail: 'Las columnas pertenecen a una tabla. Indica la tabla con FROM.' });
    }
    if (ref.table) {
      const tbl = ref.table.toLowerCase();
      const own = cols.filter(function (c) { return c.table.toLowerCase() === tbl; });
      if (!own.length) {
        const aliases = Array.from(new Set(cols.map(function (c) { return c.table; })));
        throw new SqlError("La tabla o alias '" + ref.table + "' no se usa en el FROM de esta consulta", {
          hint: 'Nombres disponibles: ' + aliases.join(', ') + '.',
          detail: 'Para escribir tabla.columna, la tabla (o su alias) debe aparecer antes en FROM o JOIN.'
        });
      }
      const c = closest(ref.name, own.map(function (x) { return x.name; }));
      throw new SqlError("La columna '" + ref.name + "' no existe en la tabla '" + ref.table + "'", {
        hint: (c ? "¿Quisiste escribir '" + c + "'? " : '') + "Columnas de '" + ref.table + "': " + own.map(function (x) { return x.name; }).join(', ') + '.',
        detail: 'Cada tabla tiene columnas fijas. Mira el diagrama ER para ver los nombres exactos de las columnas.'
      });
    }
    const tables = Array.from(new Set(cols.map(function (c) { return c.table; })));
    const c = closest(ref.name, cols.map(function (x) { return x.name; }));
    throw new SqlError("La columna '" + ref.name + "' no existe en ninguna de las tablas de la consulta (" + tables.join(', ') + ')', {
      hint: (c ? "¿Quisiste escribir '" + c + "'? " : '') + 'Revisa el nombre en el diagrama ER.',
      detail: 'Cada tabla tiene columnas fijas. Mira el diagrama ER para ver los nombres exactos de las columnas.'
    });
  }

  /* ---------- Evaluación de expresiones ---------- */
  function hasAgg(e) {
    if (!e || typeof e !== 'object') return false;
    if (e.k === 'fn' && AGG.has(e.name)) return true;
    for (const key of Object.keys(e)) {
      if (key === 'q') continue;
      const v = e[key];
      if (Array.isArray(v)) { if (v.some(function (x) { return x && typeof x === 'object' && (x.k ? hasAgg(x) : hasAgg(x.c) || hasAgg(x.v)); })) return true; }
      else if (v && typeof v === 'object' && v.k && hasAgg(v)) return true;
    }
    return false;
  }

  function subSingle(db, q, env, what) {
    const r = execSelect(db, q, env);
    if (r.columns.length !== 1) {
      throw new SqlError('La subconsulta ' + what + ' debe devolver una sola columna (devuelve ' + r.columns.length + ')', {
        detail: 'Cuando una subconsulta se compara con un valor o con IN, solo puede devolver una columna.'
      });
    }
    return r;
  }

  function evalExpr(e, env, db) {
    switch (e.k) {
      case 'num': case 'str': case 'bool': return e.v;
      case 'null': return null;
      case 'col': {
        const r = resolveCol(e, env);
        const v = r.scope.row[r.idx];
        return v === undefined ? null : v;
      }
      case 'neg': {
        const v = evalExpr(e.e, env, db);
        return v === null ? null : -toNumber(v, '-');
      }
      case 'and': {
        const l = tri(evalExpr(e.l, env, db));
        if (l === false) return false;
        const r = tri(evalExpr(e.r, env, db));
        if (r === false) return false;
        return l === null || r === null ? null : true;
      }
      case 'or': {
        const l = tri(evalExpr(e.l, env, db));
        if (l === true) return true;
        const r = tri(evalExpr(e.r, env, db));
        if (r === true) return true;
        return l === null || r === null ? null : false;
      }
      case 'not': {
        const v = tri(evalExpr(e.e, env, db));
        return v === null ? null : !v;
      }
      case 'bin': {
        const l = evalExpr(e.l, env, db), r = evalExpr(e.r, env, db);
        if (l === null || r === null) return null;
        switch (e.op) {
          case '=': return cmp(l, r) === 0;
          case '<>': return cmp(l, r) !== 0;
          case '<': return cmp(l, r) < 0;
          case '>': return cmp(l, r) > 0;
          case '<=': return cmp(l, r) <= 0;
          case '>=': return cmp(l, r) >= 0;
          case '||': return String(l) + String(r);
          case '+': return toNumber(l, '+') + toNumber(r, '+');
          case '-': return toNumber(l, '-') - toNumber(r, '-');
          case '*': return toNumber(l, '*') * toNumber(r, '*');
          case '/': {
            const d = toNumber(r, '/');
            if (d === 0) throw new SqlError('División entre cero', { detail: 'No se puede dividir un número entre 0. Revisa el divisor de tu operación.' });
            return toNumber(l, '/') / d;
          }
          case '%': {
            const d = toNumber(r, '%');
            if (d === 0) throw new SqlError('División entre cero', { detail: 'No se puede calcular el resto de dividir entre 0.' });
            return toNumber(l, '%') % d;
          }
        }
        throw new SqlError("Operador no soportado: '" + e.op + "'");
      }
      case 'isnull': {
        const v = evalExpr(e.e, env, db);
        return e.neg ? v !== null : v === null;
      }
      case 'like': {
        const v = evalExpr(e.e, env, db), p = evalExpr(e.pat, env, db);
        if (v === null || p === null) return null;
        const res = likeToRegex(p).test(String(v));
        return e.neg ? !res : res;
      }
      case 'between': {
        const v = evalExpr(e.e, env, db), lo = evalExpr(e.lo, env, db), hi = evalExpr(e.hi, env, db);
        if (v === null || lo === null || hi === null) return null;
        const res = cmp(v, lo) >= 0 && cmp(v, hi) <= 0;
        return e.neg ? !res : res;
      }
      case 'in': {
        const v = evalExpr(e.e, env, db);
        if (v === null) return null;
        let cands;
        if (e.q) cands = subSingle(db, e.q, env, 'de IN').rows.map(function (r) { return r[0]; });
        else cands = e.list.map(function (x) { return evalExpr(x, env, db); });
        let sawNull = false;
        for (const c of cands) {
          if (c === null) { sawNull = true; continue; }
          if (cmp(v, c) === 0) return !e.neg;
        }
        if (sawNull) return null;
        return !!e.neg;
      }
      case 'sub': {
        const r = subSingle(db, e.q, env, 'usada como valor');
        if (r.rows.length > 1) {
          throw new SqlError('La subconsulta devuelve ' + r.rows.length + ' filas donde solo se espera un valor', {
            hint: 'Usa IN en lugar de = o añade una agregación (MAX, AVG...) o LIMIT 1.',
            detail: 'Si comparas con = o > necesitas un único valor. Si la subconsulta puede devolver varios, usa IN.'
          });
        }
        return r.rows.length ? r.rows[0][0] : null;
      }
      case 'exists': return execSelect(db, e.q, env).rows.length > 0;
      case 'case': {
        for (const w of e.whens) if (truthy(evalExpr(w.c, env, db))) return evalExpr(w.v, env, db);
        return e.els ? evalExpr(e.els, env, db) : null;
      }
      case 'fn': return evalFn(e, env, db);
    }
    throw new SqlError('Expresión no soportada');
  }

  function evalFn(e, env, db) {
    const name = e.name;
    if (AGG.has(name)) {
      if (!env.group) {
        throw new SqlError('La función de agregación ' + name + ' no se puede usar aquí', {
          line: e.line,
          hint: 'Para filtrar por el resultado de una agregación usa HAVING en lugar de WHERE.',
          detail: 'WHERE filtra filas ANTES de agrupar, así que todavía no existen los totales. HAVING filtra grupos DESPUÉS de agregar.'
        });
      }
      if (name === 'COUNT' && e.star) return env.group.length;
      if (e.args.length !== 1) {
        throw new SqlError('La función ' + name + ' necesita exactamente un argumento', { line: e.line, detail: 'Ejemplo: ' + name + '(columna)' });
      }
      let vals = env.group.map(function (r) {
        return evalExpr(e.args[0], { cols: env.cols, row: r, group: null, parent: env.parent }, db);
      }).filter(function (v) { return v !== null; });
      if (e.distinct) {
        const seen = new Set();
        vals = vals.filter(function (v) { const k = typeof v + ':' + v; if (seen.has(k)) return false; seen.add(k); return true; });
      }
      switch (name) {
        case 'COUNT': return vals.length;
        case 'SUM': return vals.length ? vals.reduce(function (a, v) { return a + toNumber(v, 'SUM'); }, 0) : null;
        case 'AVG': return vals.length ? vals.reduce(function (a, v) { return a + toNumber(v, 'AVG'); }, 0) / vals.length : null;
        case 'MIN': return vals.length ? vals.reduce(function (a, v) { return sortCmp(v, a) < 0 ? v : a; }) : null;
        case 'MAX': return vals.length ? vals.reduce(function (a, v) { return sortCmp(v, a) > 0 ? v : a; }) : null;
      }
    }
    const args = e.args.map(function (a) { return evalExpr(a, env, db); });
    const need = function (min, max) {
      if (args.length < min || args.length > max) {
        throw new SqlError('La función ' + name + ' recibe ' + (min === max ? min : 'entre ' + min + ' y ' + max) + ' argumento(s) y le has dado ' + args.length, { line: e.line });
      }
    };
    switch (name) {
      case 'UPPER': need(1, 1); return args[0] === null ? null : String(args[0]).toUpperCase();
      case 'LOWER': need(1, 1); return args[0] === null ? null : String(args[0]).toLowerCase();
      case 'LENGTH': need(1, 1); return args[0] === null ? null : String(args[0]).length;
      case 'TRIM': need(1, 1); return args[0] === null ? null : String(args[0]).trim();
      case 'ABS': need(1, 1); return args[0] === null ? null : Math.abs(toNumber(args[0], 'ABS'));
      case 'FLOOR': need(1, 1); return args[0] === null ? null : Math.floor(toNumber(args[0], 'FLOOR'));
      case 'CEIL': need(1, 1); return args[0] === null ? null : Math.ceil(toNumber(args[0], 'CEIL'));
      case 'ROUND': {
        need(1, 2);
        if (args[0] === null) return null;
        const d = args.length > 1 && args[1] !== null ? toNumber(args[1], 'ROUND') : 0;
        const f = Math.pow(10, d);
        return Math.round((toNumber(args[0], 'ROUND') + Number.EPSILON) * f) / f;
      }
      case 'COALESCE': case 'IFNULL': {
        for (const a of args) if (a !== null) return a;
        return null;
      }
      case 'CONCAT': return args.map(function (a) { return a === null ? '' : String(a); }).join('');
      case 'SUBSTR': case 'SUBSTRING': {
        need(2, 3);
        if (args[0] === null) return null;
        const s = String(args[0]);
        const start = Math.max(1, toNumber(args[1], name)) - 1;
        return args.length > 2 ? s.substr(start, toNumber(args[2], name)) : s.substr(start);
      }
      case 'YEAR': {
        need(1, 1);
        if (args[0] === null) return null;
        const m = /^(\d{4})-/.exec(String(args[0]));
        return m ? Number(m[1]) : null;
      }
    }
    const c = closest(name, SCALAR_FUNCS.concat(Array.from(AGG)));
    throw new SqlError("La función '" + name + "' no existe", {
      line: e.line,
      hint: (c ? "¿Quisiste escribir '" + c + "'? " : '') + 'Funciones de agregación: COUNT, SUM, AVG, MIN, MAX. Otras: ' + SCALAR_FUNCS.join(', ') + '.',
      detail: 'Una función recibe valores entre paréntesis y devuelve un resultado. Revisa que el nombre esté bien escrito.'
    });
  }

  /* ---------- Ejecución de SELECT ---------- */
  function nullRow(n) { return new Array(n).fill(null); }

  function buildSource(db, src, outer) {
    if (src.subquery) {
      const r = execSelect(db, src.subquery, outer);
      return { cols: r.columns.map(function (n) { return { table: src.alias, name: n, real: src.alias }; }), rows: r.rows };
    }
    const tname = resolveTable(db, src.table, src.line);
    const sch = db.schema[tname];
    const alias = src.alias || tname;
    return {
      cols: sch.map(function (c) { return { table: alias, name: c.name, real: tname }; }),
      rows: db.tables[tname].map(function (o) { return sch.map(function (c) { return o[c.name] === undefined ? null : o[c.name]; }); })
    };
  }

  function execSelect(db, q, outer) {
    outer = outer || null;
    /* 1. FROM + JOIN */
    let cols = [], rows = [[]];
    if (q.from) {
      const first = buildSource(db, q.from, outer);
      cols = first.cols; rows = first.rows;
      for (const j of q.joins) {
        const right = buildSource(db, j.source, outer);
        const alias = right.cols.length ? right.cols[0].table : null;
        if (alias && cols.some(function (c) { return c.table.toLowerCase() === alias.toLowerCase(); })) {
          throw new SqlError("El nombre '" + alias + "' se usa dos veces en el FROM", {
            hint: 'Usa alias distintos, por ejemplo: FROM alumnos a1 JOIN alumnos a2 ...',
            detail: 'Si una tabla aparece dos veces en la consulta, cada aparición necesita su propio alias para poder distinguirlas.'
          });
        }
        const allCols = cols.concat(right.cols);
        const out = [];
        for (const l of rows) {
          let matched = false;
          for (const r of right.rows) {
            const row = l.concat(r);
            if (j.kind === 'cross' || truthy(evalExpr(j.on, { cols: allCols, row: row, group: null, parent: outer }, db))) {
              out.push(row); matched = true;
            }
          }
          if (!matched && j.kind === 'left') out.push(l.concat(nullRow(right.cols.length)));
        }
        cols = allCols; rows = out;
      }
    }

    /* 2. Elementos del SELECT */
    const items = [];
    for (const it of q.items) {
      if (it.star) {
        if (!q.from) throw new SqlError('SELECT * necesita una tabla: añade FROM', { detail: 'El asterisco significa «todas las columnas», pero hay que decir de qué tabla.' });
        let any = false;
        cols.forEach(function (c, idx) {
          if (it.table && c.table.toLowerCase() !== it.table.toLowerCase()) return;
          any = true;
          items.push({ name: c.name, idx: idx });
        });
        if (!any) throw new SqlError("La tabla o alias '" + it.table + "' no se usa en el FROM de esta consulta", { detail: 'Para escribir tabla.* la tabla (o su alias) debe aparecer en FROM o JOIN.' });
      } else {
        items.push({ name: it.alias || (it.expr.k === 'col' ? it.expr.name : toSql(it.expr)), expr: it.expr });
      }
    }

    /* 3. WHERE */
    if (q.where) {
      rows = rows.filter(function (row) {
        return truthy(evalExpr(q.where, { cols: cols, row: row, group: null, parent: outer }, db));
      });
    }

    /* 4. Agrupación */
    const grouped = q.groupBy.length > 0 || !!q.having ||
      items.some(function (i) { return i.expr && hasAgg(i.expr); }) ||
      q.orderBy.some(function (o) { return hasAgg(o.expr); });

    const resolveRef = function (g) {
      if (g.k === 'num' && Number.isInteger(g.v)) {
        const it = items[g.v - 1];
        if (!it) throw new SqlError('El número de columna ' + g.v + ' no existe en el SELECT', { detail: 'Puedes referirte a una columna del SELECT por su posición (1, 2, 3...).' });
        return it.expr || { k: 'col', table: null, name: it.name, _idx: it.idx };
      }
      if (g.k === 'col' && !g.table && findCol(cols, g) === -1) {
        const it = items.find(function (i) { return i.expr && i.name.toLowerCase() === g.name.toLowerCase(); });
        if (it) return it.expr;
      }
      return g;
    };

    let entries = [];
    if (grouped) {
      const groups = new Map();
      if (q.groupBy.length) {
        const gexprs = q.groupBy.map(resolveRef);
        for (const row of rows) {
          const env = { cols: cols, row: row, group: null, parent: outer };
          const key = JSON.stringify(gexprs.map(function (g) { const v = evalExpr(g, env, db); return v === null ? ['n'] : [typeof v, v]; }));
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(row);
        }
      } else {
        groups.set('', rows);
      }
      for (const grp of groups.values()) {
        const env = { cols: cols, row: grp.length ? grp[0] : nullRow(cols.length), group: grp, parent: outer };
        if (q.having && !truthy(evalExpr(q.having, env, db))) continue;
        entries.push({ env: env });
      }
    } else {
      entries = rows.map(function (row) { return { env: { cols: cols, row: row, group: null, parent: outer } }; });
    }

    /* 5. Proyección */
    for (const en of entries) {
      en.out = items.map(function (i) { return i.expr ? evalExpr(i.expr, en.env, db) : en.env.row[i.idx]; });
    }

    /* 6. ORDER BY */
    if (q.orderBy.length) {
      const keyFns = q.orderBy.map(function (o) {
        const x = o.expr;
        if (x.k === 'num' && Number.isInteger(x.v)) {
          if (x.v < 1 || x.v > items.length) throw new SqlError('El número de columna ' + x.v + ' del ORDER BY no existe en el SELECT', { detail: 'ORDER BY 2 ordena por la segunda columna del SELECT.' });
          return function (en) { return en.out[x.v - 1]; };
        }
        if (x.k === 'col' && !x.table) {
          const ai = items.findIndex(function (i) { return i.expr && i.name.toLowerCase() === x.name.toLowerCase(); });
          if (ai >= 0 && findCol(cols, x) === -1) return function (en) { return en.out[ai]; };
        }
        return function (en) { return evalExpr(x, en.env, db); };
      });
      entries.forEach(function (en) { en.keys = keyFns.map(function (f) { return f(en); }); });
      const decorated = entries.map(function (en, i) { return { en: en, i: i }; });
      decorated.sort(function (a, b) {
        for (let k = 0; k < q.orderBy.length; k++) {
          const x = a.en.keys[k], y = b.en.keys[k];
          let c;
          if (x === null && y === null) c = 0;
          else if (x === null) c = -1;
          else if (y === null) c = 1;
          else c = sortCmp(x, y);
          if (c !== 0) return q.orderBy[k].dir === 'DESC' ? -c : c;
        }
        return a.i - b.i;
      });
      entries = decorated.map(function (d) { return d.en; });
    }

    let out = entries.map(function (en) { return en.out; });

    /* 7. DISTINCT, OFFSET, LIMIT */
    if (q.distinct) {
      const seen = new Set();
      out = out.filter(function (r) {
        const k = JSON.stringify(r.map(function (v) { return v === null ? ['n'] : [typeof v, v]; }));
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
    }
    if (q.offset) out = out.slice(q.offset);
    if (q.limit !== null) out = out.slice(0, q.limit);

    return { columns: items.map(function (i) { return i.name; }), rows: out };
  }

  /* ---------- DML ---------- */
  function coerce(val, col) {
    if (val === null) return null;
    const bad = function (msg, detail) { return new SqlError(msg, { detail: detail }); };
    switch (col.type) {
      case 'INTEGER': case 'DECIMAL': {
        if (typeof val === 'number') return val;
        if (typeof val === 'boolean') return val ? 1 : 0;
        if (typeof val === 'string' && val.trim() !== '' && !isNaN(val)) return Number(val);
        throw bad("El valor '" + val + "' no es un número, pero la columna '" + col.name + "' es numérica",
          'Cada columna tiene un tipo de dato. Las columnas numéricas no aceptan texto: escribe el número sin comillas.');
      }
      case 'BOOLEAN': {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val !== 0;
        if (typeof val === 'string' && /^(true|false)$/i.test(val)) return val.toLowerCase() === 'true';
        throw bad("El valor '" + val + "' no es válido para la columna '" + col.name + "', que es de tipo verdadero/falso",
          'Usa TRUE o FALSE (o 1 y 0) para las columnas lógicas.');
      }
      case 'DATE': {
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        throw bad("El valor '" + val + "' no es una fecha válida para la columna '" + col.name + "'",
          "Las fechas se escriben entre comillas con formato AAAA-MM-DD, por ejemplo '2024-09-30'.");
      }
      default: return typeof val === 'string' ? val : String(val);
    }
  }

  function tableCols(db, tname) {
    return db.schema[tname].map(function (c) { return { table: tname, name: c.name, real: tname }; });
  }

  function findSchemaCol(db, tname, name) {
    const sch = db.schema[tname];
    const col = sch.find(function (c) { return c.name.toLowerCase() === String(name).toLowerCase(); });
    if (!col) {
      const c = closest(name, sch.map(function (x) { return x.name; }));
      throw new SqlError("La columna '" + name + "' no existe en la tabla '" + tname + "'", {
        hint: (c ? "¿Quisiste escribir '" + c + "'? " : '') + "Columnas de '" + tname + "': " + sch.map(function (x) { return x.name; }).join(', ') + '.',
        detail: 'Cada tabla tiene columnas fijas. Mira el diagrama ER para ver los nombres exactos.'
      });
    }
    return col;
  }

  function plural(n, s, p) { return n + ' ' + (n === 1 ? s : p); }

  function execInsert(db, st) {
    const tname = resolveTable(db, st.table, st.line);
    const sch = db.schema[tname];
    const targets = st.columns ? st.columns.map(function (c) { return findSchemaCol(db, tname, c); }) : sch;
    const env = { cols: [], row: [], group: null, parent: null };
    const newRows = [];
    for (const tuple of st.rows) {
      if (tuple.length !== targets.length) {
        throw new SqlError('Se han indicado ' + tuple.length + ' valores pero hay ' + targets.length + ' columnas', {
          hint: st.columns ? 'Cada columna de la lista necesita un valor.' : "Columnas de '" + tname + "': " + sch.map(function (c) { return c.name; }).join(', ') + '. Puedes indicar solo algunas: INSERT INTO ' + tname + ' (col1, col2) VALUES (...).',
          detail: 'En un INSERT, el número de valores debe coincidir con el número de columnas indicadas (o con todas las de la tabla si no las nombras).'
        });
      }
      const obj = {};
      sch.forEach(function (c) { obj[c.name] = null; });
      tuple.forEach(function (ex, i) { obj[targets[i].name] = coerce(evalExpr(ex, env, db), targets[i]); });
      const idCol = sch.find(function (c) { return c.name === 'id'; });
      if (idCol && obj.id === null) {
        const all = db.tables[tname].concat(newRows);
        obj.id = all.reduce(function (m, r) { return typeof r.id === 'number' && r.id > m ? r.id : m; }, 0) + 1;
      }
      newRows.push(obj);
    }
    newRows.forEach(function (r) { db.tables[tname].push(r); });
    return { type: 'dml', kind: 'insert', affected: newRows.length, tables: [tname], message: 'Se ha(n) insertado ' + plural(newRows.length, 'fila', 'filas') + " en '" + tname + "'" };
  }

  function execUpdate(db, st) {
    const tname = resolveTable(db, st.table, st.line);
    const cols = tableCols(db, tname);
    const sch = db.schema[tname];
    const sets = st.sets.map(function (s) { return { col: findSchemaCol(db, tname, s.col), expr: s.expr }; });
    const changes = [];
    db.tables[tname].forEach(function (obj) {
      const row = sch.map(function (c) { return obj[c.name] === undefined ? null : obj[c.name]; });
      const env = { cols: cols, row: row, group: null, parent: null };
      if (st.where && !truthy(evalExpr(st.where, env, db))) return;
      changes.push({ obj: obj, vals: sets.map(function (s) { return coerce(evalExpr(s.expr, env, db), s.col); }) });
    });
    changes.forEach(function (ch) { sets.forEach(function (s, i) { ch.obj[s.col.name] = ch.vals[i]; }); });
    return { type: 'dml', kind: 'update', affected: changes.length, tables: [tname], message: 'Se ha(n) modificado ' + plural(changes.length, 'fila', 'filas') + " en '" + tname + "'" };
  }

  function execDelete(db, st) {
    const tname = resolveTable(db, st.table, st.line);
    const cols = tableCols(db, tname);
    const sch = db.schema[tname];
    const keep = [];
    let removed = 0;
    db.tables[tname].forEach(function (obj) {
      const row = sch.map(function (c) { return obj[c.name] === undefined ? null : obj[c.name]; });
      const env = { cols: cols, row: row, group: null, parent: null };
      if (!st.where || truthy(evalExpr(st.where, env, db))) removed++; else keep.push(obj);
    });
    db.tables[tname] = keep;
    return { type: 'dml', kind: 'delete', affected: removed, tables: [tname], message: 'Se ha(n) borrado ' + plural(removed, 'fila', 'filas') + " de '" + tname + "'" };
  }

  /* ---------- API pública ---------- */
  function now() { return (global.performance && performance.now) ? performance.now() : Date.now(); }

  function run(db, sql) {
    const t0 = now();
    const parser = new Parser(tokenize(String(sql)));
    const stmts = parser.parseScript();
    if (!stmts.length) {
      throw new SqlError('La consulta está vacía', { detail: 'Escribe una sentencia SQL, por ejemplo: SELECT * FROM alumnos;' });
    }
    let res = null;
    for (const st of stmts) {
      if (st.type === 'select') {
        const r = execSelect(db, st, null);
        res = { type: 'select', columns: r.columns, rows: r.rows, tables: Array.from(parser.tables) };
      } else if (st.type === 'insert') res = execInsert(db, st);
      else if (st.type === 'update') res = execUpdate(db, st);
      else res = execDelete(db, st);
    }
    res.statements = stmts.length;
    res.ms = now() - t0;
    return res;
  }

  /* Comparación de resultados para el modo examen (orden insensible) */
  function normCell(v) {
    if (v === null || v === undefined) return '\u2205';
    if (typeof v === 'number') return String(Math.round(v * 100) / 100);
    if (typeof v === 'boolean') return v ? '1' : '0';
    return String(v);
  }
  function compareResults(actual, expected) {
    if (actual.columns.length !== expected.columns.length) {
      return { ok: false, reason: 'columnas', actual: actual.columns.length, expected: expected.columns.length };
    }
    if (actual.rows.length !== expected.rows.length) {
      return { ok: false, reason: 'filas', actual: actual.rows.length, expected: expected.rows.length };
    }
    const keys = function (rs) { return rs.map(function (r) { return r.map(normCell).join('\u0001'); }).sort(); };
    const a = keys(actual.rows), b = keys(expected.rows);
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return { ok: false, reason: 'contenido', actual: a.length, expected: b.length };
    }
    return { ok: true };
  }

  global.SqlEngine = {
    SqlError: SqlError,
    createDatabase: createDatabase,
    run: run,
    compareResults: compareResults,
    tokenize: tokenize,
    KEYWORDS: Array.from(KEYWORDS),
    FUNCTIONS: Array.from(AGG).concat(SCALAR_FUNCS)
  };
})(typeof window !== 'undefined' ? window : globalThis);
