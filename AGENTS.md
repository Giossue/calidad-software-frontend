# Guía de trabajo para agentes

## Proyecto

Este repositorio contiene la SPA React del sistema Calidad Software. La API y
las reglas de negocio viven en `calidad-software-backend`.

## Convenciones

- La interfaz y los mensajes de usuario se escriben en español; el código, tipos
  y nombres internos se escriben en inglés.
- Usa React 19, TypeScript, Vite, Tailwind CSS 4 y componentes shadcn/ui.
- Reutiliza primero `src/components/ui`; compón componentes pequeños y accesibles.
- Las páginas no contienen reglas de negocio ni secretos.
- Solo las variables `VITE_*` pueden estar disponibles en el navegador.
- La URL de la API proviene de `VITE_API_URL`; no disperses URLs absolutas.
- Mantén el token de acceso en `sessionStorage`, nunca en `localStorage`.
- Toda mutación muestra estado pendiente y errores comprensibles y evita el doble envío.

## Verificación

Antes de declarar un cambio terminado ejecuta:

```bash
npm run lint
npm run test
npm run build
```

No hagas commit ni push salvo petición explícita.
