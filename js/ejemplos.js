/* ============================================================
   tecnoLSM · Simulador de bases de datos
   Ejemplos guiados: 10 consultas por base de datos, de menos a más difícil.
   ============================================================ */
window.EJEMPLOS = {
  instituto: [
    {
      titulo: '1. Ver toda una tabla',
      concepto: 'SELECT *',
      descripcion: 'El asterisco (*) significa «todas las columnas». Esta consulta muestra todas las filas de la tabla alumnos.',
      sql: 'SELECT * FROM alumnos;'
    },
    {
      titulo: '2. Elegir columnas',
      concepto: 'SELECT columnas',
      descripcion: 'Puedes pedir solo las columnas que te interesan, separadas por comas. Aquí, el nombre y los apellidos.',
      sql: 'SELECT nombre, apellidos FROM alumnos;'
    },
    {
      titulo: '3. Filtrar filas con WHERE',
      concepto: 'WHERE',
      descripcion: 'WHERE deja pasar solo las filas que cumplen una condición. Los textos van entre comillas simples. Debe devolver 4 alumnos.',
      sql: "SELECT nombre, apellidos FROM alumnos WHERE grupo = 'A';"
    },
    {
      titulo: '4. Ordenar el resultado',
      concepto: 'ORDER BY',
      descripcion: 'ORDER BY ordena las filas. ASC es de menor a mayor (A→Z) y DESC al revés.',
      sql: 'SELECT nombre, apellidos FROM alumnos ORDER BY apellidos ASC;'
    },
    {
      titulo: '5. Buscar por patrón',
      concepto: 'LIKE',
      descripcion: 'LIKE busca textos que encajan con un patrón: % sustituye a cualquier cantidad de letras. Aquí, alumnos cuyo nombre empieza por M o por A.',
      sql: "SELECT nombre, apellidos FROM alumnos\nWHERE nombre LIKE 'M%' OR nombre LIKE 'A%';"
    },
    {
      titulo: '6. Calcular con una agregación',
      concepto: 'COUNT, AVG, MAX',
      descripcion: 'Las funciones de agregación resumen muchas filas en un solo valor: cuántas notas hay, su media y la más alta.',
      sql: 'SELECT COUNT(*) AS total_notas, AVG(nota) AS nota_media, MAX(nota) AS nota_maxima\nFROM notas;'
    },
    {
      titulo: '7. Agrupar con GROUP BY',
      concepto: 'GROUP BY',
      descripcion: 'GROUP BY forma un grupo por cada valor distinto de la columna y calcula la agregación dentro de cada grupo. Aquí, cuántos alumnos hay en cada grupo.',
      sql: 'SELECT grupo, COUNT(*) AS num_alumnos\nFROM alumnos\nGROUP BY grupo;'
    },
    {
      titulo: '8. Unir dos tablas con JOIN',
      concepto: 'JOIN … ON',
      descripcion: 'Las notas guardan solo el id del alumno (clave foránea). JOIN une cada nota con su alumno usando la condición ON. Muestra las notas del primer trimestre en Programación (asignatura 1).',
      sql: 'SELECT a.nombre, a.apellidos, n.nota\nFROM alumnos a\nJOIN notas n ON a.id = n.alumno_id\nWHERE n.asignatura_id = 1 AND n.trimestre = 1;'
    },
    {
      titulo: '9. Filtrar grupos con HAVING',
      concepto: 'JOIN + GROUP BY + HAVING',
      descripcion: 'HAVING filtra grupos ya calculados (WHERE filtra filas antes de agrupar). Esta consulta muestra los alumnos con nota media igual o superior a 6, de mejor a peor.',
      sql: 'SELECT a.nombre, AVG(n.nota) AS media\nFROM alumnos a\nJOIN notas n ON a.id = n.alumno_id\nGROUP BY a.id\nHAVING AVG(n.nota) >= 6\nORDER BY media DESC;'
    },
    {
      titulo: '10. Una consulta dentro de otra',
      concepto: 'Subconsulta',
      descripcion: 'La consulta interior (entre paréntesis) se ejecuta primero y devuelve una lista de ids; la exterior usa IN para quedarse con los alumnos que han sacado alguna vez un 9 o más.',
      sql: 'SELECT nombre, apellidos\nFROM alumnos\nWHERE id IN (SELECT alumno_id FROM notas WHERE nota >= 9);'
    }
  ],

  tienda: [
    {
      titulo: '1. Ver toda una tabla',
      concepto: 'SELECT *',
      descripcion: 'El asterisco (*) significa «todas las columnas». Muestra el catálogo completo de productos.',
      sql: 'SELECT * FROM productos;'
    },
    {
      titulo: '2. Ordenar por precio',
      concepto: 'ORDER BY DESC',
      descripcion: 'Elegimos dos columnas y ordenamos de mayor a menor precio con DESC.',
      sql: 'SELECT nombre, precio FROM productos ORDER BY precio DESC;'
    },
    {
      titulo: '3. Productos con poco stock',
      concepto: 'WHERE con <',
      descripcion: 'Operadores de comparación: =, <>, <, >, <=, >=. Esta consulta busca los productos con menos de 100 unidades.',
      sql: 'SELECT nombre, stock FROM productos WHERE stock < 100;'
    },
    {
      titulo: '4. Rango de precios',
      concepto: 'BETWEEN',
      descripcion: 'BETWEEN comprueba si un valor está entre dos límites (ambos incluidos).',
      sql: 'SELECT nombre, precio FROM productos WHERE precio BETWEEN 1 AND 10;'
    },
    {
      titulo: '5. Varios valores posibles',
      concepto: 'IN',
      descripcion: 'IN equivale a varias condiciones con OR: la ciudad debe ser una de las de la lista.',
      sql: "SELECT nombre, ciudad FROM clientes WHERE ciudad IN ('Santander', 'Laredo');"
    },
    {
      titulo: '6. Resumen por categoría',
      concepto: 'GROUP BY + COUNT + AVG',
      descripcion: 'Agrupamos los productos por categoría y calculamos cuántos hay y su precio medio en cada una.',
      sql: 'SELECT categoria, COUNT(*) AS num_productos, AVG(precio) AS precio_medio\nFROM productos\nGROUP BY categoria;'
    },
    {
      titulo: '7. Pedidos con el nombre del cliente',
      concepto: 'JOIN',
      descripcion: 'La tabla pedidos solo guarda cliente_id (clave foránea). JOIN lo une con la tabla clientes para ver el nombre.',
      sql: 'SELECT c.nombre, p.fecha, p.estado\nFROM clientes c\nJOIN pedidos p ON c.id = p.cliente_id\nORDER BY p.fecha;'
    },
    {
      titulo: '8. Incluir también lo que no tiene pareja',
      concepto: 'LEFT JOIN',
      descripcion: 'LEFT JOIN conserva todas las filas de la tabla de la izquierda aunque no tengan pedidos (el contador sale 0). Con JOIN normal esos clientes desaparecerían.',
      sql: 'SELECT c.nombre, COUNT(p.id) AS num_pedidos\nFROM clientes c\nLEFT JOIN pedidos p ON c.id = p.cliente_id\nGROUP BY c.id;'
    },
    {
      titulo: '9. Total comprado por cada cliente',
      concepto: 'JOIN de 3 tablas + SUM',
      descripcion: 'Encadenamos dos JOIN (clientes → pedidos → líneas) y sumamos cantidad × precio para obtener el importe total de cada cliente.',
      sql: 'SELECT c.nombre, SUM(l.cantidad * l.precio_unitario) AS total\nFROM clientes c\nJOIN pedidos p ON c.id = p.cliente_id\nJOIN lineas_pedido l ON p.id = l.pedido_id\nGROUP BY c.id;'
    },
    {
      titulo: '10. Comparar con la media',
      concepto: 'Subconsulta',
      descripcion: 'La subconsulta calcula el precio medio de todos los productos; la consulta exterior muestra los que cuestan más que esa media.',
      sql: 'SELECT nombre, precio\nFROM productos\nWHERE precio > (SELECT AVG(precio) FROM productos);'
    }
  ],

  biblioteca: [
    {
      titulo: '1. Ver toda una tabla',
      concepto: 'SELECT *',
      descripcion: 'El asterisco (*) significa «todas las columnas». Muestra todos los libros de la biblioteca.',
      sql: 'SELECT * FROM libros;'
    },
    {
      titulo: '2. Libros por año',
      concepto: 'ORDER BY',
      descripcion: 'Elegimos dos columnas y ordenamos del libro más antiguo al más moderno.',
      sql: 'SELECT titulo, anio FROM libros ORDER BY anio;'
    },
    {
      titulo: '3. Libros anteriores a 1900',
      concepto: 'WHERE con <',
      descripcion: 'Una condición numérica con el operador < (menor que).',
      sql: 'SELECT titulo FROM libros WHERE anio < 1900;'
    },
    {
      titulo: '4. Autores de una nacionalidad',
      concepto: 'WHERE con texto',
      descripcion: 'Para comparar con un texto, ponlo entre comillas simples. Cuidado con las mayúsculas y las tildes.',
      sql: "SELECT nombre, nacionalidad FROM autores WHERE nacionalidad = 'Británica';"
    },
    {
      titulo: '5. Buscar por patrón',
      concepto: 'LIKE',
      descripcion: 'Con LIKE y el comodín %, esta consulta encuentra todos los géneros que empiezan por «Novela» (Novela, Novela romántica…).',
      sql: "SELECT titulo, genero FROM libros WHERE genero LIKE 'Novela%';"
    },
    {
      titulo: '6. Resumen por género',
      concepto: 'GROUP BY + COUNT + SUM',
      descripcion: 'Cuántos títulos hay de cada género y cuántos ejemplares físicos suman.',
      sql: 'SELECT genero, COUNT(*) AS num_libros, SUM(ejemplares) AS total_ejemplares\nFROM libros\nGROUP BY genero;'
    },
    {
      titulo: '7. Libros con el nombre de su autor',
      concepto: 'JOIN',
      descripcion: 'libros guarda solo autor_id (clave foránea). JOIN lo une con autores para mostrar el nombre. AS le da un nombre nuevo a la columna.',
      sql: 'SELECT l.titulo, a.nombre AS autor\nFROM libros l\nJOIN autores a ON l.autor_id = a.id;'
    },
    {
      titulo: '8. Préstamos pendientes de devolver',
      concepto: 'JOIN de 3 tablas',
      descripcion: 'Unimos prestamos con libros y usuarios para saber qué libro tiene cada persona y desde cuándo. devuelto es una columna verdadero/falso.',
      sql: 'SELECT l.titulo, u.nombre, p.fecha_prestamo\nFROM prestamos p\nJOIN libros l ON p.libro_id = l.id\nJOIN usuarios u ON p.usuario_id = u.id\nWHERE p.devuelto = FALSE;'
    },
    {
      titulo: '9. Autores con varios libros',
      concepto: 'LEFT JOIN + GROUP BY + HAVING',
      descripcion: 'Contamos los libros de cada autor y nos quedamos solo con los grupos que tienen 2 o más (HAVING filtra grupos).',
      sql: 'SELECT a.nombre, COUNT(l.id) AS num_libros\nFROM autores a\nLEFT JOIN libros l ON l.autor_id = a.id\nGROUP BY a.id\nHAVING COUNT(l.id) >= 2;'
    },
    {
      titulo: '10. Libros que nunca se han prestado',
      concepto: 'Subconsulta con NOT IN',
      descripcion: 'La subconsulta lista los libros que aparecen en algún préstamo; NOT IN deja los que no están en esa lista.',
      sql: 'SELECT titulo\nFROM libros\nWHERE id NOT IN (SELECT libro_id FROM prestamos);'
    }
  ]
};
