# Informe — Simulador de bases de datos (tecnoLSM)

Fecha: 26/10/2026 · Ejecutado por: Antigravity (Claude Sonnet 5.5, Medium)

> [!IMPORTANT]
> **No se ha podido ejecutar nada en el navegador.** Siguiendo la regla de oro 1 del plan (no usar terminal) solo se han leído y escrito archivos. Por tanto el código **no se ha probado en ejecución**: los valores de la sección 3 están **comprobados a mano sobre los JSON**, no medidos. El auditor debe lanzar `tecnoLSMVerificar()` (ver sección 4) para confirmarlos.

## 1. Qué se ha hecho

Se ha construido el MVP completo y, además, todo lo de la Fase 2 del plan.

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura: cabecera con selector de BD y toggle de tema, pestañas (Práctica libre / Ejemplos guiados / Modo examen), editor, resultados, panel lateral (resumen de BD, diagrama ER colapsable, conceptos clave, historial), footer estándar y watermark. HTML estático con atributo `class` (nunca `className`). |
| `css/styles.css` | Variables exactas del brand en `:root` y `[data-theme="dark"]`, más una variante `[data-theme="light"]` (el plan no daba valores de tema claro, ver sección 5). `color-scheme` light/dark/light en print. Fuentes Space Grotesk / DM Sans / IBM Plex Mono. Watermark con los valores indicados. Sin sombras ni gradientes. |
| `js/sql-engine.js` | Tokenizador, parser de descenso recursivo y ejecutor. Ver detalle abajo. |
| `js/diagrama-er.js` | Diagrama ER en SVG: cajas con columnas y tipo, badges PK/FK, líneas con cardinalidad N/1 y resaltado de las tablas usadas. |
| `js/ejemplos.js` | 10 ejemplos guiados por BD con descripción y concepto. |
| `js/examenes.js` | 5 enunciados por BD con pista y consulta solución. |
| `js/app.js` | Selector de BD, editor con resaltado, ejecución, resultados, historial, pestañas, ejemplos, examen, exportación/importación, verificación. |
| `robots.txt` | Permite todo. |

### Motor SQL
- **SELECT**: `*`, `tabla.*`, columnas, expresiones, `AS` (y alias implícito), `DISTINCT`, `WHERE`, `GROUP BY` (también por alias o posición), `HAVING`, `ORDER BY` (varias columnas, ASC/DESC, alias, posición), `LIMIT`/`OFFSET`.
- **JOIN**: `INNER`, `LEFT [OUTER]`, `CROSS` y coma. `RIGHT`/`FULL` dan un mensaje que sugiere usar LEFT.
- **Operadores**: `= <> != < > <= >=`, `LIKE` (insensible a mayúsculas), `IN` (lista o subconsulta), `NOT IN`, `BETWEEN`, `IS [NOT] NULL`, `AND/OR/NOT`, aritmética `+ - * / %`, `||`, lógica de tres valores (NULL).
- **Subconsultas**: en `WHERE` (escalares, `IN`, `EXISTS`, correlacionadas), en `FROM` y en el `SELECT`.
- **Funciones**: `COUNT` (también `*` y `DISTINCT`), `SUM`, `AVG`, `MIN`, `MAX`, `UPPER`, `LOWER`, `LENGTH`, `ROUND`, `ABS`, `COALESCE`, `IFNULL`, `SUBSTR`, `TRIM`, `CONCAT`, `YEAR`, `FLOOR`, `CEIL`, y `CASE WHEN`.
- **DML** (sobre memoria; el JSON nunca se toca): `INSERT` (varias filas, lista de columnas opcional, `id` autonumérico si se omite), `UPDATE ... SET ... WHERE`, `DELETE FROM ... WHERE`. Comprueba tipos. Botón «Restaurar datos originales».
- **Errores en español**, con línea, sugerencia «¿Quisiste escribir…?» (distancia de Levenshtein) y explicación pedagógica en el desplegable «¿Qué significa esto?». Mensajes: «Error de sintaxis en la línea X…», «La tabla 'X' no existe», «La columna 'Y' no existe en la tabla 'Z'», columna ambigua, agregación en WHERE, subconsulta con varias filas, etc.
- **DDL** (`CREATE`/`ALTER`/`DROP`) rechazado con explicación, como pide el plan.
- Se admiten varias sentencias separadas por `;` (se muestra el resultado de la última).

### Otras funcionalidades
- Resaltado de sintaxis en el editor (capa `<pre>` bajo un `<textarea>` transparente). Ctrl/Cmd + Enter ejecuta.
- Historial de las últimas 20 consultas (localStorage) y borrador del editor (localStorage).
- Exportar consulta (`consulta.sql`), importar `.sql`, exportar resultados (`resultados.csv`, UTF-8 con BOM, separador coma).
- Modo examen: contador de intentos, cronómetro, «Comprobar» (compara conjuntos de filas, orden insensible, redondeo a 2 decimales, nombres de columna ignorados), pista, y botón «Ver solución» tras 3 intentos. Los enunciados resueltos se guardan en localStorage por BD. La comprobación se hace siempre sobre una copia limpia de los datos, así que no la afectan los INSERT/UPDATE/DELETE que haya hecho el alumno.
- Toggle claro/oscuro persistido en `localStorage('tecnolsm-theme')`.
- Accesibilidad: skip link, roles de pestañas con flechas de teclado, `aria-live` en mensajes, foco visible, `prefers-reduced-motion`.

## 2. Qué se ha omitido o queda pendiente

- **Pruebas en ejecución: ninguna** (ver aviso arriba).
- Los iconos MDI y las fuentes se cargan por CDN (Iconify y Google Fonts). Sin conexión se ven los fallbacks del sistema y los iconos no aparecen. No se han incrustado SVG.
- `RIGHT JOIN`, `FULL JOIN`, `UNION` y DDL no están soportados (por diseño).
- La aplicación necesita servirse por HTTP (por ejemplo `python3 -m http.server`) porque carga los JSON con `fetch`. Si se abre con `file://` muestra un mensaje explicándolo.
- Mejora posible no hecha: el diagrama ER coloca las tablas en una cuadrícula de 3 columnas en el orden del JSON, así que alguna línea puede cruzar cajas (p. ej. en `instituto`).
- No se ha tocado `data/*.json` ni nada fuera del checkout. No se ha hecho ningún despliegue a GitHub.

## 3. Valores de verificación (comprobados a mano sobre los JSON)

| # | Valor | Esperado | Resultado (a mano) |
|---|---|---|---|
| 1 | BDs seleccionables | 3 | 3 (instituto, tienda, biblioteca) |
| 2 | Tablas en instituto | 5 | 5 (alumnos, asignaturas, profesores, matriculas, notas) |
| 3 | Alumnos en instituto | 8 | 8 (ids 1–8) |
| 4 | Productos en tienda | 8 | 8 |
| 5 | Libros en biblioteca | 7 | 7 |
| 6 | Ejemplos guiados | ≥ 8 por BD | 10 por BD = 30 |
| 7 | Enunciados de examen | ≥ 5 por BD | 5 por BD = 15 |
| 8 | `SELECT nombre, apellidos FROM alumnos WHERE grupo = 'A'` | 4 filas | 4 (ids 1, 2, 5, 7) |
| 9 | `SELECT a.nombre, AVG(n.nota) ... GROUP BY a.id` | 8 filas | 8 (los 8 alumnos tienen notas) |
| 10 | Total por cliente (3 tablas, `GROUP BY c.id`) | ≥ 4 filas | 5 (los 5 clientes tienen pedidos con líneas) |

## 4. Cómo verificar en el navegador

1. Servir la carpeta: `python3 -m http.server 8000` y abrir `http://localhost:8000`.
2. En la consola del navegador ejecutar `await tecnoLSMVerificar()`. Devuelve (y escribe en consola) número de BDs, tablas y filas por BD, nº de ejemplos y exámenes, los resultados de las consultas 8, 9 y 10, y una lista `errores` con cualquier ejemplo o solución de examen que falle al ejecutarse. **`errores` debe estar vacío.**
3. Revisar ambos temas con captura, el editor con resaltado (que la capa de color y el texto no se desalineen) y el diagrama ER.

## 5. Decisiones que conviene revisar

- **Tema claro**: el plan fija las mismas variables en `:root` y en `[data-theme="dark"]` y no define un tema claro. Se ha mantenido literal lo indicado y se ha añadido `[data-theme="light"]` con una paleta derivada del brand (fondo `#F4F7F9`, cian oscurecido `#0A7385` para contraste). La app fija siempre `data-theme` al cargar (oscuro por defecto), por lo que `color-scheme` efectivo es el correcto.
- **CSV con coma**: Excel en configuración regional española puede abrirlo en una sola columna. Si se prefiere `;`, es un cambio de una línea en `exportCsv` (`app.js`).
- **Se ha adelantado la Fase 2** (DML, resaltado, tooltips, conceptos clave) porque era barata de integrar con el diseño del motor.
