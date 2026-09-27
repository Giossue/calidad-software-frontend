# Interfaz de coordinación de titulación

Se conectaron los contratos CT-03 a CT-09 del backend con el diseño y los
componentes existentes del frontend.

El coordinador de titulación abre **Propuestas de titulación** al iniciar
sesión. Su menú incorpora **Período y paralelos** y **Docentes de titulación**.
El administrador también puede utilizar estas herramientas. El coordinador de
carrera conserva el módulo de tutorías. El estudiante accede a **Mis
propuestas**, con resultados, asignaciones y observaciones.

Las propuestas admiten búsqueda y filtros por estado y paralelo. El detalle
permite aprobar, rechazar, añadir observaciones y cambiar pares académicos.
La aprobación requiere un tutor y al menos un par distinto; cuando faltan
docentes, la pantalla explica qué dato debe completarse. Las mutaciones
conservan el formulario ante errores y evitan envíos duplicados.

La autorización sigue en el servidor. El cliente usa el token de sesión y la
URL de API ya configurados, sin introducir credenciales ni URLs de producción
en los componentes. Los ciclos y paralelos de tutorías siguen procediendo del
catálogo administrativo, filtrados por carrera y asignatura.

Validación: 37 pruebas correctas; lint sin errores y 11 avisos preexistentes;
build correcto con la advertencia de chunk de 634 kB. Flujo completo probado
en Chromium contra Laravel real con datos aislados, incluido reemplazo de
pares, historial tras recarga, aislamiento del estudiante y vistas móviles.

La puesta en producción requiere el backend compatible y la migración
`2026_09_27_010000_align_degree_coordination_baseline`. El estado del despliegue
se documenta en el plan de titulación del repositorio backend.
