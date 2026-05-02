# Zanix AI — Workspace

## Overview

مشروع Zanix AI: وكيل ذكاء اصطناعي متكامل مع واجهة دردشة احترافية، بث SSE حي، وتنسيق متعدد الوكلاء.

pnpm workspace monorepo — TypeScript — Express 5 — React + Vite — PostgreSQL + Drizzle ORM

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24 | **Package manager**: pnpm | **TypeScript**: 5.9
- **Backend**: Express 5 + Drizzle ORM + PostgreSQL
- **Frontend**: React 19 + Vite 7 + Tailwind CSS v4 + Framer Motion
- **AI**: OpenAI SDK (gpt-5.2 via AI_INTEGRATIONS_OPENAI_API_KEY)
- **Auth**: Express-session + bcryptjs
- **Streaming**: SSE (Server-Sent Events) for real-time agent steps
- **Routing**: Wouter (frontend) | Express (backend)

## Artifacts

| Artifact | Path | Port | Description |
|---|---|---|---|
| `zanix-web` | `/` | 21033 | Frontend React+Vite app |
| `api-server` | `/api` | 8080 | Express backend + AI agent |

## Key Files

- `artifacts/zanix-web/src/pages/chat.tsx` — واجهة الدردشة الرئيسية مع SSE + لوحة مسار التنفيذ
- `artifacts/zanix-web/src/components/zanix-logo.tsx` — الشعار الجديد Z
- `artifacts/api-server/src/routes/agent.ts` — مسارات الوكيل + SSE stream endpoint
- `artifacts/api-server/src/agent/executor/runner.ts` — تشغيل الوكيل
- `artifacts/api-server/src/agent/executor/orchestrator.ts` — تنسيق متعدد الوكلاء
- `lib/db/src/schema/` — جداول قاعدة البيانات
- `lib/api-client-react/src/generated/api.ts` — React Query hooks

## API Endpoints

- `POST /api/agent/run/stream` — تشغيل الوكيل مع بث SSE
- `GET /api/agent/tasks/:taskId/stream` — تدفق خطوات الوكيل حيًا
- `POST /api/agent/orchestrate/sync` — تنسيق متعدد الوكلاء
- `POST /api/auth/login` | `/register` | `/logout` | `/me`

## Key Commands

```bash
pnpm --filter @workspace/db run push          # دفع مخطط قاعدة البيانات
pnpm --filter @workspace/api-spec run codegen # إعادة توليد hooks
pnpm run typecheck                             # فحص الأنواع الكاملة
```

## DB Schema Tables

agent_sessions, agent_tasks, agent_steps, agent_artifacts, agent_memory,
agent_personalities, orchestrations, sub_agent_runs, shared_memory_bus,
users, credits, credit_transactions, api_keys, integrations,
scheduled_tasks, autonomous_tasks

## Visual Identity

- Primary: `hsl(260 84% 63%)` — بنفسجي
- Background: `hsl(228 22% 4%)` — أسود داكن
- Accent: `hsl(186 100% 50%)` — سماوي كهربائي
- Logo: حرف Z مع نقطة سماوية (`zanix-logo.tsx`)
