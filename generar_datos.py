import json, random, os

random.seed(42)

# ---------- INSTITUTO ----------
alumnos = [
    {"id":1,"nombre":"Ana","apellidos":"García López","curso":"2º Bach","grupo":"A"},
    {"id":2,"nombre":"Carlos","apellidos":"Fernández Ruiz","curso":"2º Bach","grupo":"A"},
    {"id":3,"nombre":"Lucía","apellidos":"Martínez Soto","curso":"2º Bach","grupo":"B"},
    {"id":4,"nombre":"David","apellidos":"López Pérez","curso":"2º Bach","grupo":"B"},
    {"id":5,"nombre":"María","apellidos":"Sánchez Díaz","curso":"2º Bach","grupo":"A"},
    {"id":6,"nombre":"Javier","apellidos":"Gómez Torres","curso":"2º Bach","grupo":"B"},
    {"id":7,"nombre":"Elena","apellidos":"Ramírez Vega","curso":"2º Bach","grupo":"A"},
    {"id":8,"nombre":"Pablo","apellidos":"Herrera Molina","curso":"2º Bach","grupo":"B"},
]
asignaturas = [
    {"id":1,"nombre":"Programación y Gestión de Datos","curso":"2º Bach","horas":4},
    {"id":2,"nombre":"Tecnología e Ingeniería II","curso":"2º Bach","horas":3},
    {"id":3,"nombre":"Matemáticas II","curso":"2º Bach","horas":4},
    {"id":4,"nombre":"Física","curso":"2º Bach","horas":4},
    {"id":5,"nombre":"Inglés","curso":"2º Bach","horas":3},
]
profesores = [
    {"id":1,"nombre":"Luis Solá","departamento":"Tecnología"},
    {"id":2,"nombre":"María Jesús","departamento":"Matemáticas"},
    {"id":3,"nombre":"Carlos Ruiz","departamento":"Física"},
    {"id":4,"nombre":"Ana Belén","departamento":"Inglés"},
]
# matrículas: todos los alumnos en todas las asignaturas
matriculas = [{"alumno_id":a["id"],"asignatura_id":asi["id"]} for a in alumnos for asi in asignaturas]
# notas: 3 trimestres por alumno/asignatura
notas = []
for a in alumnos:
    for asi in asignaturas:
        for t in (1,2,3):
            notas.append({"alumno_id":a["id"],"asignatura_id":asi["id"],"trimestre":t,"nota":round(random.uniform(4.0,9.5),1)})
instituto = {
    "nombre":"Instituto San Miguel (ejemplo)",
    "tablas":{
        "alumnos":alumnos,
        "asignaturas":asignaturas,
        "profesores":profesores,
        "matriculas":matriculas,
        "notas":notas
    },
    "relaciones":[
        {"from":"matriculas.alumno_id","to":"alumnos.id"},
        {"from":"matriculas.asignatura_id","to":"asignaturas.id"},
        {"from":"notas.alumno_id","to":"alumnos.id"},
        {"from":"notas.asignatura_id","to":"asignaturas.id"}
    ]
}

# ---------- TIENDA ----------
clientes = [
    {"id":1,"nombre":"Ferretería El Tornillo","ciudad":"Santander","fecha_alta":"2023-09-12"},
    {"id":2,"nombre":"Construcciones Norte S.L.","ciudad":"Torrelavega","fecha_alta":"2024-01-20"},
    {"id":3,"nombre":"Talleres Mecánicos Gómez","ciudad":"Laredo","fecha_alta":"2023-11-05"},
    {"id":4,"nombre":"Instalaciones Eléctricas Ruiz","ciudad":"Castro Urdiales","fecha_alta":"2024-03-15"},
    {"id":5,"nombre":"Carpintería Moderna","ciudad":"Santander","fecha_alta":"2023-08-01"},
]
productos = [
    {"id":1,"nombre":"Tornillo M6 x 20","categoria":"Ferretería","precio":0.15,"stock":5000},
    {"id":2,"nombre":"Tuerca M6","categoria":"Ferretería","precio":0.08,"stock":8000},
    {"id":3,"nombre":"Cable 2,5 mm² (m)","categoria":"Electricidad","precio":1.20,"stock":1200},
    {"id":4,"nombre":"Interruptor magnetotérmico 16A","categoria":"Electricidad","precio":8.50,"stock":120},
    {"id":5,"nombre":"Tabla pino 200x20x2 cm","categoria":"Madera","precio":12.00,"stock":45},
    {"id":6,"nombre":"Bisagra 3\"","categoria":"Herrajes","precio":2.30,"stock":300},
    {"id":7,"nombre":"Pintura blanca 4L","categoria":"Pintura","precio":24.90,"stock":60},
    {"id":8,"nombre":"Broca HSS 8mm","categoria":"Herramientas","precio":4.50,"stock":90},
]
pedidos = [
    {"id":1,"cliente_id":1,"fecha":"2024-09-03","estado":"entregado"},
    {"id":2,"cliente_id":2,"fecha":"2024-09-10","estado":"entregado"},
    {"id":3,"cliente_id":1,"fecha":"2024-09-18","estado":"pendiente"},
    {"id":4,"cliente_id":3,"fecha":"2024-09-22","estado":"entregado"},
    {"id":5,"cliente_id":4,"fecha":"2024-09-25","estado":"pendiente"},
    {"id":6,"cliente_id":5,"fecha":"2024-09-28","estado":"entregado"},
]
lineas = [
    {"pedido_id":1,"producto_id":1,"cantidad":200,"precio_unitario":0.15},
    {"pedido_id":1,"producto_id":2,"cantidad":200,"precio_unitario":0.08},
    {"pedido_id":2,"producto_id":3,"cantidad":50,"precio_unitario":1.20},
    {"pedido_id":2,"producto_id":4,"cantidad":10,"precio_unitario":8.50},
    {"pedido_id":3,"producto_id":5,"cantidad":12,"precio_unitario":12.00},
    {"pedido_id":3,"producto_id":6,"cantidad":30,"precio_unitario":2.30},
    {"pedido_id":4,"producto_id":7,"cantidad":5,"precio_unitario":24.90},
    {"pedido_id":4,"producto_id":8,"cantidad":6,"precio_unitario":4.50},
    {"pedido_id":5,"producto_id":3,"cantidad":80,"precio_unitario":1.20},
    {"pedido_id":5,"producto_id":4,"cantidad":4,"precio_unitario":8.50},
    {"pedido_id":6,"producto_id":5,"cantidad":8,"precio_unitario":12.00},
    {"pedido_id":6,"producto_id":1,"cantidad":500,"precio_unitario":0.15},
]
tienda = {
    "nombre":"Tienda de materiales (ejemplo)",
    "tablas":{
        "clientes":clientes,
        "productos":productos,
        "pedidos":pedidos,
        "lineas_pedido":lineas
    },
    "relaciones":[
        {"from":"pedidos.cliente_id","to":"clientes.id"},
        {"from":"lineas_pedido.pedido_id","to":"pedidos.id"},
        {"from":"lineas_pedido.producto_id","to":"productos.id"}
    ]
}

# ---------- BIBLIOTECA ----------
autores = [
    {"id":1,"nombre":"Miguel de Cervantes","nacionalidad":"Española"},
    {"id":2,"nombre":"Gabriel García Márquez","nacionalidad":"Colombiana"},
    {"id":3,"nombre":"Jane Austen","nacionalidad":"Británica"},
    {"id":4,"nombre":"Antoine de Saint-Exupéry","nacionalidad":"Francesa"},
    {"id":5,"nombre":"J.K. Rowling","nacionalidad":"Británica"},
]
libros = [
    {"id":1,"titulo":"Don Quijote de la Mancha","autor_id":1,"genero":"Novela","anio":1605,"ejemplares":3},
    {"id":2,"titulo":"Cien años de soledad","autor_id":2,"genero":"Novela","anio":1967,"ejemplares":4},
    {"id":3,"titulo":"Orgullo y prejuicio","autor_id":3,"genero":"Novela romántica","anio":1813,"ejemplares":2},
    {"id":4,"titulo":"El principito","autor_id":4,"genero":"Fábula","anio":1943,"ejemplares":5},
    {"id":5,"titulo":"Harry Potter y la piedra filosofal","autor_id":5,"genero":"Fantasía","anio":1997,"ejemplares":6},
    {"id":6,"titulo":"El amor en los tiempos del cólera","autor_id":2,"genero":"Novela","anio":1985,"ejemplares":2},
    {"id":7,"titulo":"Emma","autor_id":3,"genero":"Novela romántica","anio":1815,"ejemplares":1},
]
usuarios = [
    {"id":1,"nombre":"Ana García","tipo":"alumno","fecha_alta":"2024-09-01"},
    {"id":2,"nombre":"Carlos Fernández","tipo":"alumno","fecha_alta":"2024-09-01"},
    {"id":3,"nombre":"Lucía Martínez","tipo":"alumno","fecha_alta":"2024-09-01"},
    {"id":4,"nombre":"Prof. Luis Solá","tipo":"profesor","fecha_alta":"2023-09-01"},
    {"id":5,"nombre":"Bibliotecaria María","tipo":"personal","fecha_alta":"2022-09-01"},
]
prestamos = [
    {"id":1,"libro_id":1,"usuario_id":1,"fecha_prestamo":"2024-09-10","fecha_devolucion":"2024-09-24","devuelto":True},
    {"id":2,"libro_id":4,"usuario_id":2,"fecha_prestamo":"2024-09-12","fecha_devolucion":"2024-09-26","devuelto":True},
    {"id":3,"libro_id":5,"usuario_id":3,"fecha_prestamo":"2024-09-15","fecha_devolucion":"2024-09-29","devuelto":False},
    {"id":4,"libro_id":2,"usuario_id":1,"fecha_prestamo":"2024-09-18","fecha_devolucion":"2024-10-02","devuelto":False},
    {"id":5,"libro_id":3,"usuario_id":4,"fecha_prestamo":"2024-09-20","fecha_devolucion":"2024-10-04","devuelto":True},
    {"id":6,"libro_id":7,"usuario_id":2,"fecha_prestamo":"2024-09-22","fecha_devolucion":"2024-10-06","devuelto":False},
]
biblioteca = {
    "nombre":"Biblioteca del instituto (ejemplo)",
    "tablas":{
        "autores":autores,
        "libros":libros,
        "usuarios":usuarios,
        "prestamos":prestamos
    },
    "relaciones":[
        {"from":"libros.autor_id","to":"autores.id"},
        {"from":"prestamos.libro_id","to":"libros.id"},
        {"from":"prestamos.usuario_id","to":"usuarios.id"}
    ]
}

os.makedirs("data",exist_ok=True)
for name,db in [("bd_instituto",instituto),("bd_tienda",tienda),("bd_biblioteca",biblioteca)]:
    with open(f"data/{name}.json","w",encoding="utf-8") as f:
        json.dump(db,f,ensure_ascii=False,indent=2)
print("generados")