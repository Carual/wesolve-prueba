# WeSolve – Prueba Técnica (Bun + Express + Supabase + UI estática)

Demo en producción: https://wesolveprueba.vercel.app

Este repositorio contiene una implementación completa (backend + UI de prueba) para una plataforma simple donde:
- Un usuario puede **buscar “problemas”** con filtros
- Puede **matchear** un problema como **SOLVER** o **AFFECTED**
- Puede **desmatchear** (unmatch)
- Puede ver **todas las personas matcheadas** al mismo problema
- El “login” es intencionalmente simple: envías un `userId` y recibes un **JWT** para autenticar los demás requests

---

## 1) Tecnologías usadas

- **Runtime / Tooling**: **Bun**
- **Backend**: **Express** (TypeScript)
- **Base de datos**: **Supabase (PostgreSQL)**
- **Auth**: **JWT Bearer** (`Authorization: Bearer <token>`)
- **UI de prueba**: HTML estático con **Tailwind (CDN)**
- **Deploy**: **Vercel** (mismo dominio sirve API + UI)

---

## 2) Estructura del proyecto

> (Los nombres pueden variar si tú los moviste, pero la idea es esta)

```
backend/qa
  /public/
    index.html            # UI estática para probar todo
  /src/
  app.ts                # Express app (export default app)
  server.ts             # Solo para correr local (app.listen)
  ...                   # rutas / helpers
db
  /setup.sql
```

---

## 3) Modelo de datos (Supabase)

Tablas principales:

### `users`
- `id` (uuid, autogenerado)
- `display_name`
- `created_at`

### `problems`
- `id` (uuid, autogenerado)
- `title`, `description`
- `category`
- `location`
- `country_code`
- `created_at`

### `problem_matches`
- `user_id` (FK → `users.id`)
- `problem_id` (FK → `problems.id`)
- `role` (`SOLVER` | `AFFECTED`)
- `created_at`
- **Unique** `(user_id, problem_id)` para evitar duplicados

> Importante: **NO existe tabla “connection”**.  
> Las “conexiones”/colaboraciones se obtienen listando los usuarios que están en `problem_matches` para el mismo `problem_id`.

---

## 4) Endpoints del API

### Salud
- `GET /health`
  - Verifica que el servicio está vivo.

### Login + sesión (JWT)
- `POST /login`
  - Body: `{ "userId": "<uuid>" }`
  - Respuesta: `{ token, user }`
  - Se usa el token así:
    - Header: `Authorization: Bearer <token>`

- `GET /me` *(requiere auth)*
  - Devuelve el usuario autenticado según el JWT.

### Usuarios
- `GET /users`
  - Devuelve todos los usuarios registrados.

### Problemas (búsqueda con filtros)
- `GET /problems`
  - Query params soportados:
    - `search` (texto libre: título/descripcion)
    - `category`
    - `location`
    - `country_code`

### Match / Unmatch (por problema)
- `POST /problems/:id/match` *(requiere auth)*
  - Body: `{ "role": "SOLVER" | "AFFECTED" }`
  - Crea o actualiza el match del usuario autenticado.

- `DELETE /problems/:id/match` *(requiere auth)*
  - Elimina el match del usuario autenticado con ese problema.

### Personas matcheadas a un problema
- `GET /problems/:id/users`
  - Devuelve todos los matches del problema con:
    - usuario
    - rol
    - fecha de match

### Mis matches (server-driven)
- `GET /me/matches` *(requiere auth)*
  - Devuelve todos los problemas donde el usuario autenticado está matcheado, incluyendo:
    - `role`
    - `matched_at`
    - datos del problema

---

## 5) UI estática de prueba (`public/index.html`)

La UI se diseñó para probar todas las capacidades del backend sin necesidad de un frontend real.

Incluye:
- Listado de usuarios (botón para “usar” el UUID en el login)
- Login con JWT guardado en `localStorage`
- Búsqueda de problemas con filtros
- Botones:
  - **Match SOLVER**
  - **Match AFFECTED**
  - **Unmatch**
- Vista de “My Matches” usando `GET /me/matches` (ya no escanea problema por problema)
- Vista de “Collaborators” por problema usando `GET /problems/:id/users`
- Toasts de confirmación
- Listas con altura limitada y scroll interno (mejor UX)

> La UI usa `window.location.origin` como base URL.  
> Eso elimina hardcodes tipo `localhost` y funciona igual en local y en producción.

---

## 6) Variables de entorno (CRÍTICO)

El backend **requiere** variables de entorno.  
Si faltan, en Vercel suele aparecer:
- `500 INTERNAL_SERVER_ERROR`
- `FUNCTION_INVOCATION_FAILED`

Variables necesarias:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` *(o la key que uses en el backend)*
- `JWT_SECRET`

En Vercel se configuran en:
**Project → Settings → Environment Variables**

---

## 7) Cómo correrlo local paso a paso (con Bun)

### Paso 1: Instalar dependencias
```bash
bun install
```

### Paso 2: Crear `.env`
Crea un archivo `.env` en la raíz del proyecto:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
```

### Paso 3: Levantar el servidor
```bash
bun run dev
```

### Paso 4: Probar
- UI: `http://localhost:3001/`
- Health: `http://localhost:3001/health`

---

## 8) Deploy a Vercel (paso a paso)

### Paso 1: Subir a GitHub (o repo remoto)
Asegúrate de que el repo tenga `package.json` en el root (o ajusta Root Directory).

### Paso 2: Crear proyecto en Vercel
- Importa el repo
- Verifica **Root Directory** (si es monorepo, apunta a la carpeta del backend)

### Paso 3: Configurar variables de entorno
En **Project Settings → Environment Variables** agrega:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

### Paso 4: Deploy
Vercel construye y despliega.  
Luego valida en:
- https://wesolveprueba.vercel.app/health
- https://wesolveprueba.vercel.app (UI)

---

## 9) Qué se implementó (resumen)

✅ Esquema en Supabase con UUID autogenerados  
✅ Seed: múltiples usuarios, problemas y relaciones en `problem_matches`  
✅ API en Express (TypeScript) con:
- filtros de búsqueda
- match / unmatch con role
- listado de usuarios
- colaboradores por problema
- JWT auth por bearer token
- endpoint eficiente `/me/matches`  
✅ UI estática con Tailwind para probar todo  
✅ Deploy en Vercel en: https://wesolveprueba.vercel.app

---
