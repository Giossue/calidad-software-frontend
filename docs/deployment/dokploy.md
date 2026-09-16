# Despliegue del frontend en Dokploy

## Build

- Build Type: `Dockerfile`
- Docker File: `Dockerfile`
- Docker Context Path: `.`
- Docker Build Stage: `production`
- Puerto del dominio: `8080`
- Healthcheck: `/health`

La URL de la API se incorpora al bundle durante la compilación. Configúrala en
**Build-time Arguments**:

```text
VITE_API_URL=https://api.example.com
```

No agregues secretos ni credenciales al frontend. Cualquier variable `VITE_*`
queda visible para quien descargue el JavaScript.

Después del despliegue, verifica que una ruta interna como `/login` cargue al
abrirla directamente; Nginx está configurado con fallback hacia `index.html`.
