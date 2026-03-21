# CRM Intelsius México

CRM interno con Pipeline Kanban, MEDDIC scoring, gestión de empresas/contactos/deals, import/export CSV y soporte multimoneda.

**Stack:** React 18 + Vite + Supabase + Vercel

---

## Guía de despliegue completa

### Paso 1 — Clonar / subir a GitHub

1. Crea un repositorio nuevo en [github.com/new](https://github.com/new)  
   - Nombre sugerido: `crm-intelsius-mexico`  
   - Visibilidad: **Private** (recomendado)  
   - **No** inicialices con README

2. En tu terminal, dentro de la carpeta del proyecto:

```bash
git init
git add .
git commit -m "feat: CRM Intelsius inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/crm-intelsius-mexico.git
git push -u origin main
```

---

### Paso 2 — Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta (o inicia sesión)
2. Clic en **New Project**
3. Llena:
   - **Name:** `crm-intelsius`
   - **Database Password:** guárdala en un lugar seguro
   - **Region:** `South America (São Paulo)` — la más cercana a México
4. Espera ~2 minutos a que el proyecto se inicialice

#### Crear las tablas

5. En el dashboard de Supabase ve a **SQL Editor**
6. Copia y pega el contenido completo de `supabase_schema.sql`
7. Clic en **Run** — deberías ver "Success. No rows returned"

#### Obtener las credenciales

8. Ve a **Project Settings → API**
9. Copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public** key → `VITE_SUPABASE_ANON_KEY`

---

### Paso 3 — Desarrollo local (opcional)

```bash
# Instalar dependencias
npm install

# Crear archivo de variables de entorno
cp .env.example .env.local

# Editar .env.local con tus credenciales de Supabase
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...

# Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173)

---

### Paso 4 — Desplegar en Vercel

1. Ve a [vercel.com](https://vercel.com) y crea una cuenta con tu GitHub
2. Clic en **Add New → Project**
3. Importa el repositorio `crm-intelsius-mexico`
4. En la pantalla de configuración:
   - **Framework Preset:** Vite (se detecta automáticamente)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Expande **Environment Variables** y agrega:
   | Variable | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://TU_PROJECT_ID.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...tu_anon_key...` |
6. Clic en **Deploy**

¡En ~1 minuto tu CRM estará en vivo en una URL como `crm-intelsius-mexico.vercel.app`!

---

### CI/CD automático

Cada vez que hagas `git push origin main`, Vercel redesplegará automáticamente. No necesitas hacer nada más.

```bash
# Flujo normal de trabajo
git add .
git commit -m "feat: nueva funcionalidad"
git push
# → Vercel despliega en ~30 segundos
```

---

## Estructura del proyecto

```
crm-intelsius-mexico/
├── src/
│   ├── App.jsx              # Aplicación completa
│   ├── main.jsx             # Entry point de React
│   └── supabaseClient.js    # Cliente de Supabase
├── index.html
├── vite.config.js
├── package.json
├── vercel.json              # Rewrite rules para SPA
├── supabase_schema.sql      # SQL para crear tablas
├── .env.example             # Plantilla de variables de entorno
├── .gitignore               # Excluye .env.local y node_modules
└── README.md
```

---

## Variables de entorno

| Variable | Descripción | Requerida |
|---|---|---|
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase | Sí |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública de Supabase | Sí |

> **Nota:** Si las variables no están configuradas, el CRM funciona en modo offline usando `localStorage`.

---

## Tablas en Supabase

| Tabla | Descripción |
|---|---|
| `companies` | Empresas del CRM |
| `contacts` | Contactos vinculados a empresas |
| `deals` | Oportunidades de venta (pipeline) |
| `meddic_evals` | Historial de evaluaciones MEDDIC por deal |
| `pipeline_stages` | Stages configurables del pipeline Kanban |
