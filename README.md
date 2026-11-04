# BrandCite

## Setup

### 1. Install

npm install

### 2. Environment variables

copy .env.example .env.local

Fill in .env.local:

NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key
SUPABASE_SERVICE_ROLE_KEY=service-role-key

Never commit .env.local - it is in .gitignore.

### 3. Run dev server

npm run dev

Open http://localhost:3000

### 4. Health check

curl http://localhost:3000/api/health

Expected: ok:true

### 5. Lint

npm run lint

## Dependencies

next 16.4.5 - App Router framework
react 19.3.0 - UI library
react-dom 19.3.0 - DOM renderer
@supabase/supabase-js - Supabase client
tailwindcss v4 - Utility CSS
typescript v5 - Type checking
