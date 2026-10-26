# Plan: Simulador de Bases de Datos (SQL interactivo) — tecnoLSM

## 0. Contexto y decisiones (fijadas con Luis 26/10/2026)

- **Destinatarios:** alumnado de 2º Bachillerato (Programación y Gestión de Datos), que **nunca ha oído hablar de bases de datos**. El simulador debe ser pedagógico: conceptos explicados, ejemplos guiados, mensajes de error legibles.
- **Brand:** tecnoLSM completo (tema claro/oscuro, fuentes Space Grotesk / DM Sans / IBM Plex Mono, footer estándar, watermark).
- **Nivel SQL:** intermedio. Cubre SELECT completo (WHERE, ORDER BY, GROUP BY, HAVING, JOIN, subconsultas, agregaciones) + DML básico (INSERT, UPDATE, DELETE) sobre las BDs de ejemplo. NO incluye DDL (CREATE TABLE) en el MVP.
- **Bases de datos de ejemplo:** 3 seleccionables: instituto, tienda, biblioteca. Datos precocinados en `data/bd_*.json` (INMUTABLES).
- **Modo:** práctica libre con feedback inmediato + modo examen con enunciados y validación de resultados.
- **Visualización:** tabla de resultados + diagrama ER simple + historial de consultas + explicaciones pedagógicas (tooltips/conceptos).
- **Salida:** web (Cloudflare Pages) + localStorage para borradores + exportación .sql + importación .sql.

## 1. Reglas de oro para agy (LEER ANTES DE TOCAR NADA)

1. **NO ejecutar comandos de terminal.** agy headless solo tiene read_file/write_file/apply_patch. Cualquier comando mata el proceso.
2. **NO modificar ni borrar `data/*.json`**. Son datos precocinados e inmutables. Si falta un dato, avisa en el informe.
3. **HTML estático = atributo `class`, NUNCA `className`**. Ag y mete React en HTML plano con `onError={...}` y se rompe.
4. **NO tocar la carpeta de origen** (`/Users/luissolamantilla/Mis aplicaciones/...`). Solo el checkout de trabajo.
5. **Solo se editan copias** en el checkout de trabajo.
6. **Iconos MDI reales**: bombilla = `lightbulb-on-outline`, no círculos genéricos.
7. **Subíndices en SVG**: usar `<tspan baseline-shift="sub">`, NUNCA `<sub>`/`<sup>` dentro de `<text>`.
8. **Dejar informe** en `docs/informe_simulador_bd.md` con lo hecho, lo omitido y los valores de verificación.

## 2. Archivos que puede modificar

- `index.html` — estructura principal
- `css/styles.css` — estilos brand tecnoLSM
- `js/app.js` — lógica principal (editor, ejecución, visualización)
- `js/sql-engine.js` — motor SQL (parsing + ejecución sobre JSON)
- `js/diagrama-er.js` — diagrama ER
- `js/ejemplos.js` — ejemplos guiados por BD
- `js/examenes.js` — modo examen con enunciados
- `docs/informe_simulador_bd.md` — informe final

## 3. Archivos PROHIBIDOS

- `data/*.json` — datos precocinados, inmutables.
- Cualquier archivo fuera del checkout.

## 4. Brand tecnoLSM (variables CSS exactas)

```css
:root { --paper:#0B111E; --ink:#DDEAF0; --muted:#94A9B8; --rule:#2A3444; --accent:#68D7E8; }
[data-theme="dark"] { --paper:#0B111E; --ink:#DDEAF0; --muted:#94A9B8; --rule:#2A3444; --accent:#68D7E8; }
```

- Fuentes: Space Grotesk (títulos), DM Sans (cuerpo), IBM Plex Mono (código).
- Footer estándar: «Aplicación creada por Tecno LSM para uso educativo © 2026 Licencia libre de uso no comercial (Creative Commons BY-NC-SA 4.0).»
- Watermark: «tecnoLSM · Simulador de bases de datos» en esquina inferior izquierda (position:fixed, bottom:12px, left:12px, z-index:9998, font:500 10px/1 IBM Plex Mono, color:var(--muted), opacity:.4, pointer-events:none).
- Toggle claro/oscuro persistido en localStorage.
- `color-scheme: light` en `:root`, `dark` en `[data-theme="dark"]`, `light` en `@media print`.

## 5. Funcionalidades del simulador

### 5.1 Selector de base de datos
- Dropdown con 3 opciones: Instituto, Tienda, Biblioteca.
- Al cambiar, se carga el JSON correspondiente y se muestra el diagrama ER.
- Se muestra un resumen: nombre de la BD, número de tablas, número de registros por tabla.

### 5.2 Editor SQL
- Área de texto con fuente monoespaciada (IBM Plex Mono).
- Resaltado de sintaxis básico (palabras clave SQL en color).
- Botón «Ejecutar» (o Ctrl+Enter).
- Botón «Limpiar».
- Historial de consultas (últimas 20) con clic para recargar.

### 5.3 Motor SQL (js/sql-engine.js)
- Parser + ejecutor sobre los datos JSON en memoria.
- Soporta:
  - SELECT con columnas, *, expresiones (AS)
  - WHERE con operadores (=, <>, <, >, <=, >=, LIKE, IN, BETWEEN, IS NULL)
  - ORDER BY (ASC/DESC, múltiples columnas)
  - GROUP BY + funciones de agregación (COUNT, SUM, AVG, MIN, MAX)
  - HAVING
  - JOIN (INNER, LEFT) con ON
  - Subconsultas en WHERE y FROM
  - LIMIT / OFFSET
  - INSERT INTO ... VALUES (...)
  - UPDATE ... SET ... WHERE ...
  - DELETE FROM ... WHERE ...
- Mensajes de error legibles en español: «Error de sintaxis en la línea X», «La tabla 'X' no existe», «La columna 'Y' no existe en la tabla 'Z'», etc.
- Las operaciones DML (INSERT/UPDATE/DELETE) modifican los datos en memoria (no persisten en el JSON original). Botón «Restaurar datos originales».

### 5.4 Visualización de resultados
- Tabla HTML con los resultados (cabeceras con nombres de columnas).
- Mensaje de éxito: «Consulta ejecutada: N filas devueltas en X ms».
- Mensaje de error en rojo con explicación pedagógica.
- Si la consulta no devuelve filas: «La consulta es válida pero no devuelve resultados. Prueba a relajar las condiciones.»

### 5.5 Diagrama ER
- Diagrama simple con cajas por tabla (nombre + columnas con tipo) y líneas de relación.
- Resalta las tablas involucradas en la consulta actual (si se puede detectar).
- Colapsable para ganar espacio.

### 5.6 Explicaciones pedagógicas
- Panel lateral «Conceptos clave» con explicaciones breves de: tabla, fila, columna, clave primaria, clave foránea, JOIN, WHERE, GROUP BY, agregación.
- Tooltips en los mensajes de error: «¿Qué significa esto?» con explicación.
- Ejemplos guiados: 8-10 consultas por BD con descripción de qué hacen y botón «Cargar en editor».

### 5.7 Modo examen
- Lista de 5 enunciados por BD (ej: «Obtén el nombre y la nota media de cada alumno en Programación»).
- El alumno escribe la consulta y pulsa «Comprobar».
- El simulador ejecuta la consulta del alumno y la compara con el resultado esperado (comparación de conjuntos de filas, orden insensible).
- Feedback: «Correcto» (verde) o «Incorrecto: tu consulta devuelve X filas, se esperaban Y. Revisa...» con pista.
- Contador de intentos y tiempo.

### 5.8 Exportación / importación
- Botón «Exportar consulta» → descarga archivo .sql con la consulta actual.
- Botón «Importar consulta» → carga un archivo .sql en el editor.
- Botón «Exportar resultados» → descarga CSV con los resultados de la última consulta.

## 6. Estructura de archivos

```
simulador-bd/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── sql-engine.js
│   ├── diagrama-er.js
│   ├── ejemplos.js
│   └── examenes.js
├── data/
│   ├── bd_instituto.json   (INMUTABLE)
│   ├── bd_tienda.json      (INMUTABLE)
│   └── bd_biblioteca.json  (INMUTABLE)
├── docs/
│   └── informe_simulador_bd.md
└── robots.txt
```

## 7. Valores de verificación (para el auditor)

El informe de agy debe incluir estos valores verificables:
1. Número de BDs seleccionables: 3.
2. Número de tablas en BD instituto: 5 (alumnos, asignaturas, profesores, matriculas, notas).
3. Número de alumnos en BD instituto: 8.
4. Número de productos en BD tienda: 8.
5. Número de libros en BD biblioteca: 7.
6. Número de ejemplos guiados: mínimo 8 por BD (24 total).
7. Número de enunciados de examen: mínimo 5 por BD (15 total).
8. Consulta de prueba: `SELECT nombre, apellidos FROM alumnos WHERE grupo = 'A'` debe devolver 4 filas.
9. Consulta de prueba: `SELECT a.nombre, AVG(n.nota) FROM alumnos a JOIN notas n ON a.id = n.alumno_id GROUP BY a.id` debe devolver 8 filas.
10. Consulta de prueba: `SELECT c.nombre, SUM(l.cantidad * l.precio_unitario) AS total FROM clientes c JOIN pedidos p ON c.id = p.cliente_id JOIN lineas_pedido l ON p.id = l.pedido_id GROUP BY c.id` debe devolver al menos 4 filas.

## 8. MVP (lo que agy debe construir en el primer run)

1. Selector de BD + carga de JSON.
2. Editor SQL con botón ejecutar.
3. Motor SQL con SELECT (WHERE, ORDER BY, GROUP BY, HAVING, JOIN, subconsultas, agregaciones, LIMIT).
4. Tabla de resultados + mensajes de error.
5. Diagrama ER básico.
6. 8 ejemplos guiados por BD.
7. Brand tecnoLSM completo (tema claro/oscuro, fuentes, footer, watermark).
8. Modo examen con 5 enunciados por BD.
9. Exportación/importación .sql + exportación CSV.

## 9. Fase 2 (si el MVP funciona)

- DML (INSERT/UPDATE/DELETE) con botón «Restaurar datos».
- Resaltado de sintaxis en el editor.
- Tooltips pedagógicos en mensajes de error.
- Panel de conceptos clave.

## 10. Cómo lanzar agy

```bash
cd /Users/luissolamantilla/Downloads/temporales_hermes/simulador_bd
~/.local/bin/agy -p "$(cat plan_simulador_bd.md)" --output-format text --model "Gemini 3.8 Flash (High)"
```

Verificar con `agy models` que el nombre del modelo es válido antes de lanzar.

## 11. Nota sobre subagentes

Antigravity (agy) **no tiene subagentes nativos**. Es un CLI que ejecuta un modelo. La estrategia es:

- **Run 1 (Sonnet 5.5 medium):** estructura HTML + CSS brand + motor SQL + carga de BDs. El trabajo difícil (parser SQL, JOINs, subconsultas).
- **Run 2 (Gemini 3.8 flash high):** ejemplos guiados + modo examen + diagrama ER + exportación/importación. El remate de batalla.
- **Hermes (yo):** auditor y verificador final. Puppeteer + comprobación de valores + arreglos de bugs.

Para lanzar Run 1 y Run 2 en secuencia, se crea un segundo plan (`plan_simulador_bd_parte_b.md`) con solo los pendientes, y se lanza agy de nuevo.

**Alternativa:** usar subagentes de Hermes (`delegate_task`) para delegar a otros agentes de Hermes, pero eso sería Hermes, no Antigravity. Si quieres que yo lance subagentes de Hermes para tareas paralelas (ej: uno genera ejemplos, otro genera exámenes), puedo hacerlo con `delegate_task`.
