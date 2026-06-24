# CV Mojo

根据简历和职位描述，用 AI 生成定制版简历和求职信。支持用户注册登录、结构化档案管理、中英文生成。

## Tech stack

- **Next.js 15** (App Router) + TypeScript
- **Supabase** — Auth + PostgreSQL
- **OpenAI GPT** (`gpt-5.4` by default) — server-side only
- **Framer Motion** — onboarding transitions
- Deploy target: **Vercel**

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Enable Email auth (Authentication → Providers)
3. Run `supabase/schema.sql` in SQL Editor
4. Copy Project URL, anon key, and service_role key

### 2. Environment variables

所有配置放在项目根目录的 **`.env`** 文件中（唯一环境变量文件）：

```bash
cp .env.example .env
```

填入：

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4
```

### 3. Install & run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Routes

| Path | Description |
|------|-------------|
| `/login`, `/signup` | Auth |
| `/onboarding` | Guided profile wizard |
| `/dashboard` | Edit profile (CRUD) |
| `/generate` | Tailor resume + cover letter |

## API (server-only)

- `POST /api/parse-resume` — extract structured profile from resume text
- `POST /api/generate` — generate tailored documents
- `GET /api/profile-name` — user's name for file downloads

## Deploy (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Add all env vars from `.env.example`
4. Deploy

## Legacy

The old Vite + Express prototype is in `client/` and `server/` (ignored by Next.js build).
