# Plan: Mejora DDL del Simulador de bases de datos — tecnoLSM

## 0. Contexto y decisiones (fijadas con Luis 27/10/2026)

- **Objetivo:** añadir soporte DDL (CREATE TABLE, ALTER TABLE, DROP TABLE) y una pestaña de teoría al simulador de bases de datos existente, para que el alumnado de 2º Bachillerato aprenda a crear bases de datos, tablas, insertar datos y relacionarlas.
- **Nivel DDL:** CREATE TABLE (con columnas, tipos, PRIMARY KEY, FOREIGN KEY), ALTER TABLE (ADD COLUMN, DROP COLUMN), DROP TABLE. Con validación de relaciones sencillas.
- **Relaciones:** FOREIGN KEY básicas (una tabla puede referenciar a otra). Validación de integridad referencial al insertar/actualizar.
- **Persistencia:** solo en memoria durante la sesión. Exportación/importación a archivo SQL para retomar.
- **Pestaña de teoría:** explicaciones de DDL con ejemplos cargables en el editor.
- **Exportación:** exportar la BD creada (esquema + datos) a archivo .sql.
- **Brand:** tecnoLSM completo (ya aplicado).
- **Audiencia:** alumnado de 2º Bachillerato (Programación y Gestión de Datos), nunca ha creado BDs.

## 1. Reglas de oro para agy (LEER ANTES DE TOCAR NADA)

1. **NO ejecutar comandos de terminal.** agy headless solo tiene read_file/write_file/apply_patch. Cualquier comando mata el proceso.
2. **NO modificar ni borrar `data/*.json`**. Son datos precocinados e inmutables.
3. **HTML estático = atributo `class`, NUNCA `className`**.
4. **NO tocar la carpeta de origen**. Solo el checkout de trabajo.
5. **Solo se editan copias** en el checkout de trabajo.
6. **Iconos MDI reales**.
7. **Subíndices en SVG**: usar `<tspan baseline-shift="sub">`.
8. **Dejar informe** en `docs/informe_mejora_ddl.md`.

## 2. Archivos que puede modificar

- `js/sql-engine.js` — añadir DDL (CREATE, ALTER, DROP) al parser y ejecutor.
- `js/app.js` — añadir pestaña de teoría, botones de exportación de BD creada, manejo de DDL.
- `index.html` — añadir pestaña "Teoría DDL" y "Crear BD".
- `css/styles.css` — estilos para la nueva pestaña.
- `docs/informe_mejora_ddl.md` — informe final.

## 3. Archivos PROHIBIDOS

- `data/*.json` — datos precocinados, inmutables.
- Cualquier archivo fuera del checkout.

## 4. Funcionalidades a añadir

### 4.1 DDL en el motor SQL

**CREATE TABLE:**
```sql
CREATE TABLE alumnos (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  edad INTEGER,
  curso TEXT
);
```
- Soportar tipos: INTEGER, TEXT, REAL, BOOLEAN.
- Soportar PRIMARY KEY (simple, sobre una columna).
- Soportar FOREIGN KEY: `FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id)`.
- Validar que la tabla no exista ya.
- Validar que las columnas referenciadas existan.

**ALTER TABLE:**
```sql
ALTER TABLE alumnos ADD COLUMN email TEXT;
ALTER TABLE alumnos DROP COLUMN email;
```
- ADD COLUMN: añadir columna (con valor por defecto NULL).
- DROP COLUMN: eliminar columna (si no es PK ni FK).

**DROP TABLE:**
```sql
DROP TABLE alumnos;
```
- Validar que no haya FKs referenciando a esta tabla.

**Validación de integridad referencial:**
- Al INSERT/UPDATE en una tabla con FK, verificar que el valor referenciado exista en la tabla padre.
- Al DELETE/UPDATE en la tabla padre, verificar que no haya filas hijas referenciando (o hacer CASCADE si se especifica).

### 4.2 Pestaña de teoría DDL

- Explicaciones en español de: qué es una base de datos, tabla, fila, columna, clave primaria, clave foránea, relación, CREATE TABLE, ALTER TABLE, DROP TABLE, INSERT, UPDATE, DELETE.
- Cada explicación con un ejemplo de código SQL.
- Botón «Cargar en editor» que pone el ejemplo en el editor SQL.
- Diagrama visual simple de una relación 1:N (alumnos → notas).

### 4.3 Exportación de BD creada

- Botón «Exportar mi BD» que genera un archivo .sql con:
  - CREATE TABLE para cada tabla creada por el alumno.
  - INSERT INTO para cada fila insertada.
  - Orden correcto (padres antes que hijos).
- El archivo se descarga como `mi_base_de_datos.sql`.

### 4.4 Importación de BD

- Botón «Importar BD» que lee un archivo .sql y ejecuta las sentencias.
- Validación: si hay errores, mostrar mensaje claro.

### 4.5 Modo "Mis tablas"

- Panel que muestra las tablas creadas por el alumno (además de las de ejemplo).
- Botón para borrar una tabla.
- Botón para ver el esquema de una tabla.

## 5. Estructura de archivos (sin cambios en estructura)

Los archivos existentes se modifican. No se crean archivos nuevos (excepto el informe).

## 6. Valores de verificación

1. `CREATE TABLE test (id INTEGER PRIMARY KEY, nombre TEXT)` → tabla creada, aparece en `tableNames()`.
2. `INSERT INTO test VALUES (1, 'Ana')` → fila insertada.
3. `SELECT * FROM test` → 1 fila.
4. `DROP TABLE test` → tabla eliminada.
5. `CREATE TABLE hija (id INTEGER PRIMARY KEY, padre_id INTEGER, FOREIGN KEY (padre_id) REFERENCES padres(id))` → tabla creada con FK.
6. `INSERT INTO hija VALUES (1, 999)` donde 999 no existe en padres → error de integridad referencial.
7. Exportación: archivo .sql con CREATE TABLE + INSERT.
8. Importación: leer el archivo .sql y recrear la BD.

## 7. MVP (lo que agy debe construir)

1. CREATE TABLE con columnas, tipos, PRIMARY KEY, FOREIGN KEY.
2. ALTER TABLE (ADD COLUMN, DROP COLUMN).
3. DROP TABLE con validación de FKs.
4. Validación de integridad referencial en INSERT/UPDATE/DELETE.
5. Pestaña de teoría DDL con explicaciones y ejemplos cargables.
6. Exportación de BD creada a .sql.
7. Importación de .sql.
8. Panel "Mis tablas" con borrar/ver esquema.

## 8. Fase 2 (si el MVP funciona)

- ALTER TABLE RENAME.
- CREATE INDEX.
- Vistas (CREATE VIEW).
- Triggers.

## 9. Cómo lanzar agy

```bash
cd /Users/luissolamantilla/Downloads/temporales_hermes/simulador_bd
~/.local/bin/agy -p "$(cat plan_mejora_ddl.md)" --output-format text --model "Claude Sonnet 5.5 (High)"
```

Verificar con `agy models` que el nombre del modelo es válido antes de lanzar.

## 10. Nota sobre subagentes

Antigravity (agy) **no tiene subagentes nativos**. La estrategia es:

- **Run 1 (Sonnet 5.5 High):** DDL en el motor SQL + pestaña de teoría. El trabajo difícil.
- **Run 2 (Gemini 3.8 flash high):** exportación/importación + panel "Mis tablas". El remate de batalla.
- **Hermes (yo):** auditor y verificador final.
