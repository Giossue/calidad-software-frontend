# Calidad Software — Frontend

SPA del sistema de control de tutorías académicas y titulación. Está construida
con React 19, TypeScript, Vite, Tailwind CSS 4 y shadcn/ui, y consume la API del
repositorio `calidad-software-backend`.

## Requisitos

- Node.js 22 o superior
- npm
- Backend ejecutándose y accesible desde el navegador

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run dev
```

Configura la API en `.env`:

```dotenv
VITE_API_URL=http://localhost:8000
```

La aplicación abre en `http://localhost:5173`. No existe una página pública: la
ruta inicial muestra el inicio de sesión y, tras autenticarse, redirige al panel.

## Autenticación

La SPA envía un token Bearer de Laravel Sanctum y lo conserva únicamente durante
la pestaña/sesión del navegador mediante `sessionStorage`. Al cerrar sesión se
revoca en el backend y se elimina localmente.

Incluye registro, recuperación y restablecimiento de contraseña, verificación de
correo y desafío 2FA mediante código TOTP o código de recuperación. Passkeys y
la administración de seguridad de la cuenta permanecen deshabilitadas hasta
contar con un diseño WebAuthn probado para los dos dominios raíz.

## Verificación

```bash
npm run lint
npm run test
npm run build
```
