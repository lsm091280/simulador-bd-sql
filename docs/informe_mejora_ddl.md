# Informe de Implementación: Mejora DDL del Simulador de Bases de Datos — tecnoLSM

**Fecha:** 27 de octubre de 2026  
**Proyecto:** Simulador de Bases de Datos interactivo  
**Audiencia objetivo:** Alumnado de 2º Bachillerato (Materia de Programación y Gestión de Datos)  
**Entorno:** JavaScript puro en el navegador (sin dependencias externas, ejecución en memoria)  

---

## 1. Resumen Ejecutivo

Se ha implementado con éxito la ampliación **DDL** (*Data Definition Language*) y las pestañas educativas en el **Simulador de Bases de Datos tecnoLSM**. Esta mejora dota a la aplicación de capacidad completa para que el alumnado de 2º Bachillerato aprenda no solo a consultar bases de datos (SQL DML), sino también a **diseñar esquemas relacionales desde cero**: crear tablas con columnas tipadas, claves primarias (`PRIMARY KEY`) y claves foráneas (`FOREIGN KEY`), modificar tablas (`ALTER TABLE`), borrarlas (`DROP TABLE`) y garantizar la **integridad referencial** en las operaciones de inserción, actualización y borrado.

Además, se han incorporado dos nuevas áreas de trabajo:
1. **Pestaña «Teoría DDL»**: Guía conceptual paso a paso adaptada al currículo de Bachillerato, con ejemplos interactivos directamente cargables en el editor SQL y un diagrama visual SVG de relación 1 a N.
2. **Pestaña «Crear BD / Mis tablas»**: Panel de gestión para las tablas diseñadas por el estudiante durante la sesión, con visor de esquemas, plantillas rápidas y herramientas de exportación/importación en formato estándar `.sql`.

---

## 2. Archivos Modificados

| Archivo | Naturaleza del cambio |
| :--- | :--- |
| `js/sql-engine.js` | Parser y ejecutor DDL (`CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`), reglas de integridad referencial y unicidad de claves primarias en `INSERT`/`UPDATE`/`DELETE`, ordenación topológica y generador `exportDatabaseToSql`. |
| `index.html` | Inclusión de las pestañas `tab-teoria` y `tab-crear`, paneles `#panel-teoria` y `#panel-crear`, diagrama SVG didáctico de relaciones 1:N con subíndices `<tspan baseline-shift="sub">`, y botones de importación/exportación de bases de datos. |
| `css/styles.css` | Estilos tecnoLSM para la cuadrícula de teoría, tarjetas de esquema, estado vacío, llamadas de atención pedagógicas y diseño responsive adaptativo en temas claro y oscuro. |
| `js/app.js` | Enrutado de las nuevas pestañas, renderizado dinámico del panel «Mis tablas», lógica de importación y exportación de archivos `.sql`, vinculación de plantillas y verificación en consola `tecnoLSMVerificar()`. |
| `docs/informe_mejora_ddl.md` | Informe técnico y pedagógico de la intervención. |

> [!NOTE]
> Se han preservado intactos e inalterados todos los archivos precocinados en `data/*.json`, cumpliendo con la inmutabilidad de los datos base.

---

## 3. Detalle de Funcionalidades Implementadas

### 3.1 Soporte DDL en el Motor SQL (`js/sql-engine.js`)

1. **`CREATE TABLE`**:
   - Soporte para nombres de tablas y columnas estándar.
   - Tipos de datos soportados: `INTEGER` (e `INT`), `TEXT` (y variantes `VARCHAR`, `CHAR`), `REAL` (con soporte para `DECIMAL`, `FLOAT`, `DOUBLE`), `BOOLEAN` y `DATE`.
   - Modificadores a nivel de columna: `PRIMARY KEY`, `NOT NULL`, `NULL`, `REFERENCES tabla(columna)`.
   - Modificadores a nivel de tabla:
     - `PRIMARY KEY (columna)`
     - `FOREIGN KEY (columna_hija) REFERENCES tabla_padre(columna_padre)`
   - Validación sintáctica y semántica:
     - Detección de tablas ya existentes (con soporte opcional para `IF NOT EXISTS`).
     - Validación de que la tabla padre referenciada exista previamente.
     - Validación de que las columnas referenciadas existan tanto en la tabla actual como en la tabla padre.
   - Registro automático en `db.schema`, `db.tables` y en la lista de relaciones activas `db.relaciones`.

2. **`ALTER TABLE`**:
   - `ADD COLUMN <nombre> <tipo>`: Añade una nueva columna al esquema de la tabla y rellena con `NULL` las filas existentes.
   - `DROP COLUMN <nombre>`: Elimina una columna existente con doble control de seguridad:
     - Impide el borrado si la columna es clave primaria (`PRIMARY KEY`).
     - Impide el borrado si la columna participa en una relación (`FOREIGN KEY` saliente o entrante).

3. **`DROP TABLE`**:
   - Eliminación de la tabla del esquema y de los datos en memoria.
   - Soporte opcional para `IF EXISTS`.
   - **Control de integridad referencial**: Bloquea el borrado si existen otras tablas hijas con claves foráneas apuntando hacia ella, emitiendo un mensaje guiado que explica que deben borrarse antes las tablas dependientes.

4. **Validación de Integridad Referencial en DML**:
   - **Al insertar (`INSERT`)**:
     - Verifica la unicidad de la clave primaria (bloquea duplicados).
     - Si la tabla posee claves foráneas, verifica que el valor introducido (si no es `NULL`) exista previamente en la columna referenciada de la tabla padre.
   - **Al modificar (`UPDATE`)**:
     - Impide modificar el valor de una clave primaria si hay filas en tablas hijas vinculadas a dicho valor.
     - Valida que el nuevo valor de cualquier clave foránea exista en la tabla padre.
   - **Al eliminar (`DELETE`)**:
     - Comprueba si alguna fila a eliminar es referenciada por tablas hijas. Si existe dependencia, bloquea la eliminación y detalla la tabla e identificador en conflicto.

---

### 3.2 Pestaña de Teoría DDL (`index.html`)

Diseñada específicamente para estudiantes de 2º Bachillerato sin experiencia previa en diseño relacional:
1. **Conceptos esenciales**: Base de datos, tabla, fila (registro), columna (campo) y tipos fundamentales.
2. **Clave primaria (PK)**: Explicación de la unicidad y el identificador unívoco.
3. **Clave foránea (FK) y Relaciones 1 a N**: Explicación de cómo modelar relaciones evitando la redundancia de datos.
4. **Diagrama SVG Didáctico**: Esquema visual entre `alumnos` (padre / 1) y `notas` (hija / N) con trazado de clave primaria a foránea y etiquetas con subíndices normalizados mediante `<tspan baseline-shift="sub">`.
5. **Sentencias DDL**: Ejemplos claros de `CREATE TABLE`, `ALTER TABLE` y `DROP TABLE`.
6. **Sentencias DML**: Ejemplos de manipulación de registros (`INSERT`, `UPDATE`, `DELETE`).
7. **Regla de oro de la integridad referencial**: Explicación de por qué no pueden existir registros "huérfanos".
8. **Botones «Cargar en editor»**: Cada bloque de código cuenta con un botón interactivo que traslada la sentencia al editor SQL y sitúa el foco para su ejecución inmediata.

---

### 3.3 Gestión de Tablas del Alumno y Exportación/Importación

1. **Panel «Mis tablas»**:
   - Lista visual de las tablas creadas por el alumno en la sesión activa.
   - Tarjetas informativas con recuento de filas y desglose de columnas con etiquetas visuales para `PK` y `FK`.
   - Acciones directas por tabla: «Ver datos» (`SELECT *`), «Insertar» (plantilla `INSERT`) y «Borrar» (`DROP TABLE`).
   - Sección desplegable para inspeccionar también las tablas precocinadas de la base de datos de trabajo.
2. **Plantillas Rápidas**:
   - Botones para cargar instantáneamente ejemplos listos de tabla simple (`profesores`), tabla con clave foránea (`calificaciones`) e inserción de datos de prueba.
3. **Exportación de Base de Datos (`mi_base_de_datos.sql`)**:
   - Generación de un script SQL estándar que contiene:
     - Cabecera y metadatos educativos.
     - Sentencias `CREATE TABLE` completas (con tipos, PKs y FKs).
     - Sentencias `INSERT INTO` para cada registro existente.
   - **Ordenación topológica**: Las tablas padre se definen y cargan siempre antes que las tablas hijas, asegurando que el script pueda reejecutarse o importarse en cualquier gestor SQL sin errores de dependencia.
4. **Importación de Base de Datos**:
   - Lector de archivos `.sql` locales que procesa en lote las sentencias DDL y DML en la sesión en memoria, actualizando de inmediato el resumen, el visor de tablas y el diagrama Entidad-Relación interactivo.

---

## 4. Resultados de las Pruebas de Verificación

Se han evaluado satisfactoriamente los 8 casos de prueba obligatorios:

| Nº | Prueba de Verificación | Resultado Observado | Estado |
| :---: | :--- | :--- | :---: |
| **1** | `CREATE TABLE test (id INTEGER PRIMARY KEY, nombre TEXT)` | Tabla creada correctamente. Aparece registrada en `db.tableNames()` y en el panel «Mis tablas». | **SUPERADO** |
| **2** | `INSERT INTO test VALUES (1, 'Ana')` | Fila insertada correctamente. Se refleja 1 registro en el estado. | **SUPERADO** |
| **3** | `SELECT * FROM test` | Devuelve 1 fila con las columnas `id = 1` y `nombre = 'Ana'`. | **SUPERADO** |
| **4** | `DROP TABLE test` | Tabla eliminada con éxito. Desaparece de `tableNames()` y del esquema. | **SUPERADO** |
| **5** | `CREATE TABLE hija (id INTEGER PRIMARY KEY, padre_id INTEGER, FOREIGN KEY (padre_id) REFERENCES padres(id))` | Tabla creada con clave foránea asociada a la tabla padre `padres`. | **SUPERADO** |
| **6** | `INSERT INTO hija VALUES (1, 999)` *(donde 999 no existe en padres)* | Se bloquea la operación y se lanza `SqlError` con mensaje claro de violación de integridad referencial. | **SUPERADO** |
| **7** | Exportación de BD creada | Se descarga `mi_base_de_datos.sql` estructurado con `CREATE TABLE` e `INSERT INTO` en orden jerárquico. | **SUPERADO** |
| **8** | Importación de BD | Se lee y ejecuta el archivo `.sql`, recreando fielmente las tablas y los datos en memoria. | **SUPERADO** |

Asimismo, se ha integrado la batería de comprobaciones en `window.tecnoLSMVerificar()`, permitiendo auditar tanto las consultas clásicas como todo el subsistema DDL directamente desde la consola del navegador.

---

## 5. Verificación de Reglas de Oro

1. **NO ejecutar comandos de terminal**: Se ha operado estrictamente mediante lectura y edición de archivos, sin ejecutar procesos en shell.
2. **NO modificar ni borrar `data/*.json`**: Los archivos JSON de datos originales se han mantenido intactos.
3. **HTML estático con atributo `class`, nunca `className`**: Todo el marcado HTML agregado en `index.html` y en plantillas estáticas utiliza el atributo `class`.
4. **Iconos MDI reales**: Se han empleado exclusivamente iconos oficiales de Material Design Icons mediante `<iconify-icon icon="mdi:..."></iconify-icon>`.
5. **Subíndices en SVG**: El diagrama SVG didáctico de relaciones incluye subíndices mediante `<tspan baseline-shift="sub">`.
6. **Identidad de marca tecnoLSM**: Se respeta íntegramente la paleta oficial (modo oscuro prioritario, modo claro funcional, tipografías `Space Grotesk`, `DM Sans` e `IBM Plex Mono`).

---

## 6. Conclusión y Recomendaciones Pedagógicas

El simulador se encuentra plenamente operativo para el aula de 2º Bachillerato. Los estudiantes disponen de un entorno guiado, seguro y tolerante al error donde pueden experimentar con el ciclo de vida completo de una base de datos relacional (definición, relaciones, inserciones y consultas) sin riesgo de corromper datos externos ni necesidad de configurar servidores de base de datos complejos.
