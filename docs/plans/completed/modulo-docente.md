# Módulo Docente — DOC-01 a DOC-18

## Objetivo

Integrar las siete secciones docentes con la API Laravel, reutilizando el panel,
los estilos, componentes locales, formularios y diálogos de coordinación.

## Tareas completadas

- [x] Navegación docente y página inicial **Mis tutorías**.
- [x] Inscripción de cuentas nuevas y existentes, edición y baja de inscripción.
- [x] Notas diagnósticas y parciales, grupo del servidor e historial.
- [x] Asistencia por fecha, estados explícitos, temas vistos e historial.
- [x] Temas, actividades y metodologías con edición y bajas lógicas.
- [x] Envío y lectura de informes consolidados por el servidor.
- [x] Consulta de asignaciones propias de titulación.
- [x] Contexto de tutoría por URL, consulta de períodos/tutorías inactivos,
      carga, errores, confirmaciones y prevención de envíos duplicados.
- [x] Pruebas, compilación y revisión visual con la API real.

## Decisiones

- `src/lib/teacher-api.ts` concentra los contratos y usa la URL configurada de API.
- La escala y los grupos se obtienen del servidor. La configuración provisional
  es 0–10, con grupos Bajo, Medio y Alto; no hay clasificación en React.
- Desactivar un estudiante afecta a su inscripción, conservando la cuenta.
- El correo y la cédula son de consulta en la edición docente.
- La asistencia comienza como **Sin registrar**, exige marcar cada estudiante
  activo y permite confirmar expresamente **Todos presentes**.
- El informe se conserva y está disponible al coordinador en su supervisión.
- La autenticación, `sessionStorage`, la verificación y 2FA conservan sus flujos.

## Verificación — 2026-09-29

- `npm run lint`: correcto, sin errores; 11 advertencias previas fuera del módulo.
- `npm run test`: 64 pruebas correctas, incluidas 15 docentes.
- `npm run build`: correcto; chunk principal de 716,95 kB, con advertencia por
  superar 500 kB; gzip de 201,73 kB.
- Prueba de inscripción, diagnóstico, parcial, metodología, asistencia e informe
  con React + Laravel + SQLite temporal; consulta del informe por el coordinador.
- Siete secciones revisadas en escritorio de 1.440 px y móvil de 390 × 844,
  claro y oscuro; sin errores JavaScript ni desbordamiento de página.
- Backend compatible: 192 pruebas y 1.408 aserciones; 23 comprobaciones adicionales
  en PostgreSQL 18.6 local sobre esquema legado con datos representativos.

El manual, las historias y los contratos están en el repositorio backend,
`docs/product/features/teacher/README.md`. Por petición posterior del usuario,
la migración docente se aplicó en producción el 2026-09-29, lote 11, con 23
migraciones aplicadas y ninguna pendiente. Su registro está en el backend,
`docs/plans/completed/migracion-docente-remota.md`. La publicación de versiones
compatibles y la comprobación autenticada de las pantallas se verifican por
separado conforme al procedimiento Dokploy.
