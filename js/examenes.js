/* ============================================================
   tecnoLSM · Simulador de bases de datos
   Modo examen: 5 enunciados por base de datos.
   `solucion` se ejecuta sobre los datos originales y se compara con la
   consulta del alumno (conjunto de filas, orden insensible, nombres de
   columna ignorados). Los enunciados indican siempre qué columnas devolver.
   ============================================================ */
window.EXAMENES = {
  instituto: [
    {
      id: 'ins-1',
      dificultad: 'Fácil',
      enunciado: 'Obtén el nombre y los apellidos de los alumnos del grupo B, ordenados por apellidos.',
      pista: 'Necesitas SELECT con dos columnas, la tabla alumnos y un WHERE sobre la columna grupo. El texto va entre comillas simples.',
      solucion: "SELECT nombre, apellidos FROM alumnos WHERE grupo = 'B' ORDER BY apellidos"
    },
    {
      id: 'ins-2',
      dificultad: 'Fácil',
      enunciado: 'Muestra el grupo y el número de alumnos que hay en cada grupo (2 columnas).',
      pista: 'Agrupa con GROUP BY grupo y cuenta las filas de cada grupo con COUNT(*).',
      solucion: 'SELECT grupo, COUNT(*) FROM alumnos GROUP BY grupo'
    },
    {
      id: 'ins-3',
      dificultad: 'Media',
      enunciado: 'Obtén el nombre de cada alumno y su nota media en la asignatura «Programación y Gestión de Datos» (2 columnas).',
      pista: 'Une alumnos con notas, y notas con asignaturas (dos JOIN). Filtra por el nombre de la asignatura con WHERE y agrupa por alumno con GROUP BY a.id; la media es AVG(nota).',
      solucion: "SELECT a.nombre, AVG(n.nota) FROM alumnos a JOIN notas n ON a.id = n.alumno_id JOIN asignaturas s ON s.id = n.asignatura_id WHERE s.nombre = 'Programación y Gestión de Datos' GROUP BY a.id"
    },
    {
      id: 'ins-4',
      dificultad: 'Fácil',
      enunciado: 'Muestra el nombre y las horas semanales de las asignaturas que tienen más de 3 horas.',
      pista: '«Más de 3» se escribe con el operador > (estrictamente mayor). Mira la tabla asignaturas.',
      solucion: 'SELECT nombre, horas FROM asignaturas WHERE horas > 3'
    },
    {
      id: 'ins-5',
      dificultad: 'Media',
      enunciado: 'Obtén el nombre y los apellidos (sin repetir) de los alumnos que tienen alguna nota inferior a 4,5.',
      pista: 'Une alumnos con notas y filtra con n.nota < 4.5 (los decimales llevan punto). Un alumno puede tener varias notas bajas: usa DISTINCT para no repetirlo.',
      solucion: 'SELECT DISTINCT a.nombre, a.apellidos FROM alumnos a JOIN notas n ON a.id = n.alumno_id WHERE n.nota < 4.5'
    }
  ],

  tienda: [
    {
      id: 'tie-1',
      dificultad: 'Fácil',
      enunciado: "Muestra el nombre y el precio de los productos de la categoría 'Electricidad'.",
      pista: 'Consulta la tabla productos y filtra con WHERE categoria = ... (cuidado con las mayúsculas y las tildes).',
      solucion: "SELECT nombre, precio FROM productos WHERE categoria = 'Electricidad'"
    },
    {
      id: 'tie-2',
      dificultad: 'Fácil',
      enunciado: "Cuenta cuántos pedidos están en estado 'pendiente' (1 columna, 1 fila).",
      pista: 'COUNT(*) cuenta filas. Combínalo con un WHERE sobre la columna estado de la tabla pedidos.',
      solucion: "SELECT COUNT(*) FROM pedidos WHERE estado = 'pendiente'"
    },
    {
      id: 'tie-3',
      dificultad: 'Media',
      enunciado: 'Obtén el nombre de cada cliente y el número de pedidos que ha hecho (2 columnas, todos los clientes).',
      pista: 'Une clientes con pedidos por cliente_id. Para no perder clientes sin pedidos usa LEFT JOIN y cuenta con COUNT(p.id). Agrupa por cliente.',
      solucion: 'SELECT c.nombre, COUNT(p.id) FROM clientes c LEFT JOIN pedidos p ON c.id = p.cliente_id GROUP BY c.id'
    },
    {
      id: 'tie-4',
      dificultad: 'Difícil',
      enunciado: 'Obtén el nombre de cada producto vendido y el importe total vendido de ese producto (suma de cantidad × precio_unitario), 2 columnas.',
      pista: 'Une productos con lineas_pedido por producto_id, agrupa por producto y calcula SUM(l.cantidad * l.precio_unitario).',
      solucion: 'SELECT p.nombre, SUM(l.cantidad * l.precio_unitario) FROM productos p JOIN lineas_pedido l ON p.id = l.producto_id GROUP BY p.id'
    },
    {
      id: 'tie-5',
      dificultad: 'Media',
      enunciado: 'Muestra el nombre y el precio de los productos cuyo precio es superior al precio medio de todos los productos.',
      pista: 'Usa una subconsulta en el WHERE: precio > (SELECT AVG(precio) FROM productos).',
      solucion: 'SELECT nombre, precio FROM productos WHERE precio > (SELECT AVG(precio) FROM productos)'
    }
  ],

  biblioteca: [
    {
      id: 'bib-1',
      dificultad: 'Fácil',
      enunciado: 'Muestra el título y el año de los libros publicados después de 1950.',
      pista: 'Consulta la tabla libros y filtra con WHERE anio > 1950 (la columna se llama anio, sin ñ).',
      solucion: 'SELECT titulo, anio FROM libros WHERE anio > 1950'
    },
    {
      id: 'bib-2',
      dificultad: 'Fácil',
      enunciado: 'Muestra cada género y el número de libros de ese género (2 columnas).',
      pista: 'Agrupa por la columna genero con GROUP BY y cuenta con COUNT(*).',
      solucion: 'SELECT genero, COUNT(*) FROM libros GROUP BY genero'
    },
    {
      id: 'bib-3',
      dificultad: 'Media',
      enunciado: 'Obtén el título de cada libro junto con el nombre de su autor (2 columnas).',
      pista: 'libros.autor_id es una clave foránea que apunta a autores.id. Usa JOIN ... ON l.autor_id = a.id.',
      solucion: 'SELECT l.titulo, a.nombre FROM libros l JOIN autores a ON l.autor_id = a.id'
    },
    {
      id: 'bib-4',
      dificultad: 'Difícil',
      enunciado: 'Obtén el nombre (sin repetir) de los usuarios que tienen algún libro prestado sin devolver.',
      pista: 'Une usuarios con prestamos y filtra con p.devuelto = FALSE. Un usuario puede tener varios préstamos pendientes: usa DISTINCT.',
      solucion: 'SELECT DISTINCT u.nombre FROM usuarios u JOIN prestamos p ON u.id = p.usuario_id WHERE p.devuelto = FALSE'
    },
    {
      id: 'bib-5',
      dificultad: 'Difícil',
      enunciado: 'Obtén solo el nombre de los autores que tienen más de un libro en la biblioteca (1 columna).',
      pista: 'Une autores con libros, agrupa por autor y filtra los grupos con HAVING COUNT(*) > 1 (WHERE no puede usar agregaciones).',
      solucion: 'SELECT a.nombre FROM autores a JOIN libros l ON l.autor_id = a.id GROUP BY a.id HAVING COUNT(*) > 1'
    }
  ]
};
