# Interfaces administrativas del catálogo institucional

## Objetivo

Completar las interfaces React que faltan para el sprint de las semanas 5-6,
conectándolas con la API Laravel existente y manteniendo el flujo de
autenticación y autorización del administrador.

El backend ya expone las operaciones de las historias ADM-01 a ADM-18. En el
frontend ya están implementadas AUTH-01 a AUTH-03, ADM-07 a ADM-12 y el cierre
de sesión. Este plan cubre las 12 historias administrativas restantes y la
navegación mediante pestañas.

## Estado

- [x] Cliente API y tipos para los cuatro recursos administrativos.
- [x] Pestañas de usuarios, facultades, carreras, ciclos, períodos y modalidades.
- [x] CRUD frontend de ADM-01 a ADM-18.
- [x] Estados de carga, errores, confirmaciones y prevención de doble envío.
- [x] Pruebas de contrato del cliente API.
- [ ] Validación manual contra un backend levantado con datos reales.

## Alcance implementado

- ADM-01 a ADM-03: gestión de usuarios.
- ADM-04 a ADM-06: gestión de facultades.
- ADM-13 a ADM-15: gestión de períodos académicos.
- ADM-16 a ADM-18: gestión de modalidades.
- Integración de carreras y ciclos existentes dentro de la navegación
  administrativa.
- Estados de carga, errores, confirmaciones y prevención de doble envío.
- Pruebas del cliente API y de los flujos administrativos principales.

## Responsables

- **Micahel:** ADM-01 a ADM-06, usuarios y facultades.
- **Josue:** ADM-07 a ADM-12, revisión e integración de carreras y ciclos ya
  implementados.
- **Fernando:** ADM-13 a ADM-18, períodos académicos y modalidades.

## Contrato de API

### Usuarios

- `GET /api/v1/users`
- `POST /api/v1/users`
- `PATCH /api/v1/users/{user}`
- `PATCH /api/v1/users/{user}/deactivate`

Campos de alta:

- `identification`
- `name`
- `email`
- `phone`
- `role`
- `password`
- `password_confirmation`

En actualización todos los campos son opcionales y la contraseña no debe
mostrarse con su valor actual.

### Facultades

- `GET /api/v1/faculties`
- `POST /api/v1/faculties`
- `PATCH /api/v1/faculties/{faculty}`
- `PATCH /api/v1/faculties/{faculty}/deactivate`

Campo de formulario:

- `name`

### Períodos académicos

- `GET /api/v1/admin/academic-periods`
- `POST /api/v1/admin/academic-periods`
- `PATCH /api/v1/admin/academic-periods/{academicPeriod}`
- `PATCH /api/v1/admin/academic-periods/{academicPeriod}/deactivate`

Campos de formulario:

- `name`
- `start_date` con formato `YYYY-MM-DD`
- `end_date` con formato `YYYY-MM-DD`

`end_date` no puede ser anterior a `start_date`. El listado es paginado y la
interfaz debe conservar el soporte para `data`, `links` y `meta`.

### Modalidades

- `GET /api/v1/admin/modalities`
- `POST /api/v1/admin/modalities`
- `PATCH /api/v1/admin/modalities/{modality}`
- `PATCH /api/v1/admin/modalities/{modality}/deactivate`

Campo de formulario:

- `name`

## Tareas

### 1. Preparar el cliente API y los tipos compartidos

- [ ] Ampliar `User` con `phone` e `is_active`.
- [ ] Crear los tipos `AcademicPeriod` y `Modality`.
- [ ] Añadir los tipos de respuesta paginada sin perder el wrapper `data`.
- [ ] Añadir métodos API para listar, crear, actualizar y desactivar usuarios.
- [ ] Añadir métodos API para listar, crear, actualizar y desactivar facultades.
- [ ] Añadir métodos API para listar, crear, actualizar y desactivar períodos.
- [ ] Añadir métodos API para listar, crear, actualizar y desactivar modalidades.
- [ ] Mantener los nombres públicos en inglés que usa el backend.
- [ ] Convertir errores de validación a mensajes comprensibles en español.

### 2. Crear la navegación administrativa

- [ ] Crear un contenedor de administración para las seis pestañas.
- [ ] Incorporar las pestañas de usuarios, facultades, carreras, ciclos,
      períodos y modalidades.
- [ ] Mantener la administración protegida para usuarios con rol
      `administrador`.
- [ ] Integrar `AcademicPage` como las pestañas de carreras y ciclos, evitando
      duplicar su lógica.
- [ ] Definir el comportamiento al recargar o cambiar de pestaña.
- [ ] Mantener URLs o estado de pestaña recuperables si la solución elegida lo
      requiere.

### 3. Implementar gestión de usuarios — Micahel

- [ ] Crear la página o pestaña de usuarios.
- [ ] Crear listado con identificación, nombre, correo, teléfono, rol y estado.
- [ ] Crear formulario de alta con confirmación de contraseña.
- [ ] Crear formulario de edición reutilizable.
- [ ] Permitir cambio opcional de contraseña en edición.
- [ ] Añadir selección de roles válidos.
- [ ] Añadir confirmación antes de desactivar.
- [ ] Recargar el listado después de mutaciones exitosas.
- [ ] Cubrir ADM-01, ADM-02 y ADM-03.

### 4. Implementar gestión de facultades — Micahel

- [ ] Crear la página o pestaña de facultades.
- [ ] Crear formulario de alta y edición.
- [ ] Crear listado con estado y acciones.
- [ ] Añadir confirmación antes de desactivar.
- [ ] Actualizar los selectores de carreras cuando cambie el catálogo.
- [ ] Cubrir ADM-04, ADM-05 y ADM-06.

### 5. Revisar e integrar carreras y ciclos — Josue

- [ ] Mantener el CRUD existente de carreras y ciclos.
- [ ] Moverlo a las pestañas de administración sin duplicar componentes.
- [ ] Verificar que los selectores solo permitan facultades y carreras activas.
- [ ] Verificar los estados pendiente, error y éxito de cada mutación.
- [ ] Verificar ADM-07 a ADM-12 contra el contrato real del backend.
- [ ] Añadir o completar pruebas del cliente API para carreras y ciclos.

### 6. Implementar gestión de períodos académicos — Fernando

- [ ] Crear la página o pestaña de períodos.
- [ ] Crear listado con nombre, fechas y estado.
- [ ] Crear formulario de alta y edición con inputs de fecha.
- [ ] Validar en la interfaz que la fecha final no sea anterior a la inicial.
- [ ] Añadir navegación de páginas si el backend devuelve más de una página.
- [ ] Añadir confirmación antes de desactivar.
- [ ] Cubrir ADM-13, ADM-14 y ADM-15.

### 7. Implementar gestión de modalidades — Fernando

- [ ] Crear la página o pestaña de modalidades.
- [ ] Crear formulario de alta y edición.
- [ ] Crear listado con estado y acciones.
- [ ] Añadir navegación de páginas si el backend devuelve más de una página.
- [ ] Añadir confirmación antes de desactivar.
- [ ] Cubrir ADM-16, ADM-17 y ADM-18.

### 8. Calidad transversal y accesibilidad

- [ ] Reutilizar `Button`, `Input`, `Field`, `Alert` y `Spinner` de
      `src/components/ui`.
- [ ] Deshabilitar formularios y acciones durante una mutación.
- [ ] Evitar doble envío en todas las operaciones.
- [ ] Mostrar errores de validación por campo cuando la API los devuelva.
- [ ] Mostrar mensajes de conexión y permisos insuficientes.
- [ ] Usar etiquetas, nombres accesibles y estados `aria-invalid`.
- [ ] Confirmar desactivaciones con una interfaz consistente.
- [ ] Verificar diseño responsive en las seis pestañas.

### 9. Pruebas y verificación

- [ ] Añadir pruebas unitarias del cliente API para los cuatro recursos nuevos.
- [ ] Probar respuestas exitosas, errores de validación y errores 401/403.
- [ ] Probar que las mutaciones deshabilitan el botón mientras están pendientes.
- [ ] Probar que después de crear, actualizar o desactivar se recarga el listado.
- [ ] Ejecutar `npm run lint`.
- [ ] Ejecutar `npm run test`.
- [ ] Ejecutar `npm run build`.
- [ ] Probar manualmente login, acceso de administrador, las seis pestañas y
      cierre de sesión contra el backend.

## Verificación ejecutada

- `npm run lint` ✅
- `npm run test` ✅ — 8 pruebas.
- `npm run build` ✅
- Diagnósticos del proyecto: 0 errores; permanecen 3 advertencias preexistentes
  en `src/components/ui/field.tsx`.
- La validación manual contra el backend queda pendiente porque no se levantó
  un servidor API en este entorno.

## Orden recomendado de implementación

1. Cliente API, tipos y utilidades de errores.
2. Contenedor de administración y pestañas.
3. Usuarios y facultades.
4. Períodos y modalidades.
5. Integración de carreras y ciclos existentes.
6. Pruebas, accesibilidad y verificación completa.

## Criterios de aceptación

- Un administrador autenticado puede abrir las seis pestañas del catálogo.
- ADM-01 a ADM-18 tienen una interfaz frontend conectada al endpoint correcto.
- Crear, actualizar y desactivar muestran estado pendiente y errores claros.
- No se realizan dobles envíos durante una mutación.
- Las listas se actualizan después de cada operación exitosa.
- Los usuarios sin rol `administrador` no pueden operar el catálogo.
- `npm run lint`, `npm run test` y `npm run build` finalizan correctamente.

## Riesgos y decisiones pendientes

- El listado de facultades del backend devuelve únicamente facultades activas.
  Confirmar si la interfaz debe mostrar también facultades desactivadas; si es
  necesario, el backend tendrá que ofrecer un listado administrativo completo.
- Las rutas de usuarios y facultades usan `/api/v1/users` y
  `/api/v1/faculties`, mientras que períodos y modalidades usan el prefijo
  `/api/v1/admin`.
- La verificación automatizada del backend depende de tener PHP y Composer
  disponibles; el frontend puede avanzar con mocks o contra el entorno API
  configurado mediante `VITE_API_URL`.
