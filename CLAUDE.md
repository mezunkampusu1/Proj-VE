# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Follow-Up" started as an AI-assisted Kanban task tracker and is being grown into **Mezun Kampüsü Operasyon Sistemi**, a single-workspace, multi-module internal operations system (user reports, announcements, important dates, Atlas grad-program tracking, files, daily work-flow clock-in, a real-time collaborative docs module ("Ortak Alan"), finance, and social/content/SEO). All code and comments are in Turkish; match that convention when editing existing files.

**`docs/ARCHITECTURE.md` is the source-of-truth architecture doc and must be updated before adding a new module.** Read it before doing any non-trivial structural work — it documents the schema design rules, the module roadmap/phases, and the reasoning behind conventions summarized below.

## Commands

```bash
npm run dev          # Next.js dev server
npm run build         # production build
npm run lint          # eslint
npm run db:migrate    # prisma migrate dev (creates a new migration)
npm run db:deploy     # prisma migrate deploy (applies pending migrations, used in Docker)
npm run db:studio     # prisma studio
npm run db:seed       # tsx prisma/seed.ts
```

There is no automated test suite in this repo.

Full stack via Docker (Postgres + migrate + app + collab):
```bash
docker compose up --build
```

`collab-server/` is a separate Node service (Yjs/Hocuspocus) with its own `package.json`/`tsconfig.json` and is excluded from the root `tsconfig.json`. It has no npm scripts wired into the root `package.json`; build/run it via its own `Dockerfile` or directly with `tsx`/`node` inside `collab-server/`.

## Architecture

### Single workspace over a multi-team schema
The Prisma schema still models `Team`/`TeamMember` with a many-team shape, but the product deliberately never lets a user pick or create a team. `src/lib/workspace.ts` (`getOrCreateWorkspaceTeam`) auto-creates the one "Mezun Kampüsü" team on first use and silently joins every subsequent user to it as `MEMBER`. `TeamRole.ADMIN`/`MEMBER` are the **only** role authority in the system and are surfaced in the UI as "Yönetici"/"Ekip Üyesi". Several modules (finance, content) layer a *permission override table* (e.g. `FinancePermission`, `ContentPermission`) on top of this — those are **not** a second role system, just per-user exceptions to sane `MEMBER` defaults; `ADMIN` always bypasses them (see `src/lib/finance-permissions.ts`).

### Route groups (`src/app`)
- `(app)/` — authenticated app shell (dashboard, teams, projects, and every operations module page).
- `(auth)/` — `/login`, `/register`.
- `(public)/share/[token]` — token-based public access, no session.
- `(print)/` — print-only renderings (e.g. Ortak Alan document print view).
- `api/` — App Router route handlers, organized to mirror the module list (announcements, atlas, dates, files, finance, content, daily-flow, documents, universities, institutes, tasks/projects/teams, etc.).

`src/middleware.ts` gates everything except `/login`, `/register`, `api/auth`, static assets and image extensions — auth redirects happen there, not per-page.

### API route handler pattern
Nearly every route in `src/app/api/**/route.ts` follows the same shape — replicate it for new endpoints:
```ts
try {
  const session = await auth();
  if (!session?.user) return unauthorized();
  const { xId } = await params;                    // Next 16: params is a Promise
  const { ...access } = await requireXAccess(xId, session.user.id); // src/lib/permissions.ts
  const data = xSchema.parse(await req.json());     // zod, src/lib/validations.ts
  // ...prisma call...
  await logActivity({ ... });                       // src/lib/activity.ts
  await notifyUser({ ... });                        // if relevant users should be pinged
  return NextResponse.json(...);
} catch (error) {
  return handleApiError(error);                     // src/lib/api-helpers.ts
}
```
`handleApiError` maps `ZodError` → 400, `PermissionError` → 403, `NotFoundError` → 404, `AIConfigError` → 503, everything else → logged 500.

### Access/visibility is centralized, not per-route
`src/lib/permissions.ts` holds the single source of truth for who can see what (`requireTeamMember`, `requireTeamAdmin`, `requireProjectAccess`, `requireTaskAccess`, `projectVisibilityWhere`, `taskVisibilityWhere`, etc.). Module-specific visibility (e.g. `financeVisibilityWhere` in `src/lib/finance-permissions.ts`) follows the same pattern: one function used both by the API route **and** by any server component that queries Prisma directly for SSR. Past bugs here came from a page doing its own ad-hoc Prisma filter instead of reusing the helper — always reuse it for both the list query and the direct-by-id query, or a record ends up visible in a list but 403ing when opened (or vice versa).

### Recurring schema conventions (apply these when adding fields/modules)
- **`entryDate` vs `createdAt`**: most operational records (`Announcement`, `ImportantDate`, `AtlasProgram`, `DailyUserStat`) have a separate `entryDate` — the business day the record is *for*, defaulting to today but editable so members can backdate. Never conflate this with `createdAt`.
- **Mentions vs Tags**: tagging a *person* on a record (→ triggers a notification) is a distinct join table per module (`AnnouncementMention`, `ImportantDateMention`, `AtlasProgramMention`, `FileMention`, ...), completely separate from the category-label `Tag` system (`Tag` + one join table per module, e.g. `TaskTag`) — deliberately non-polymorphic, one join table per entity type for type safety/query performance.
- **Change logs**: field-level history (`AtlasChangeLog`, `FinanceChangeLog`, `DailyFlowEdit`) records old/new value pairs per changed field and is append-only — never delete or mutate a past entry, even when "fixing" a record.
- **`ActivityLog`**: one unified, filterable audit trail for the whole system. New modules add a nullable FK to `ActivityLog` plus a value in the `ModuleName` enum rather than creating a per-module log table.
- **Migrations are additive**: new nullable/optional columns on existing tables, never destructive renames/type changes on shipped tables (see docs/ARCHITECTURE.md "Kırılmazlık" principle).

### AI integrations
Two independent providers, both fail soft: missing API key throws `AIConfigError` → surfaced as HTTP 503 by `handleApiError`, rest of the app unaffected.
- `src/lib/ai.ts` — OpenAI (`OPENAI_API_KEY`/`OPENAI_MODEL`), used for natural-language task generation and project summaries.
- `src/lib/content-ai.ts` — Anthropic Claude (`ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`), used for Modül 10 (social/content/SEO) generation.

### File storage
`src/lib/storage.ts` wraps local-disk storage under `UPLOADS_DIR` (Docker named volume `uploads_data`) so a future move to cloud storage only touches this one file. Uploaded files are never served from `/public`; they go through session/permission-checked routes like `/api/files/[id]/download`.

### Ortak Alan (collaborative documents module)
Real-time editing is a separate Node process (`collab-server/`, Yjs + Hocuspocus, `collab-server/src/index.ts`), not part of the Next.js app. It authenticates connections via a short-lived JWT signed with a secret (`COLLAB_SECRET`) shared between the Next.js app and the collab server, talks to Postgres directly via `pg` (`collab-server/src/db.ts`), not Prisma, and persists both the raw Yjs state and a derived ProseMirror JSON snapshot (for search/word-count) plus periodic version snapshots. When editing document collaboration behavior, changes usually span both `src/lib/collab-client.ts` (Next.js side, issues tokens) and `collab-server/src/*`.

### Auth
Auth.js v5 (`next-auth@beta`) with a single Credentials provider (email/password via `src/lib/password.ts`), JWT session strategy, `trustHost: true` (required for the Docker/reverse-proxy deployment). No OAuth providers configured; `PrismaAdapter` is present for future extension only.

## Çalışma Kuralları

- Kullanıcıyla her zaman Türkçe iletişim kur; kod açıklamaları/yorumları da Türkçe olmalı.
- Herhangi bir dosyayı değiştirmeden önce: (1) ne yapılacağını açıkla, (2) değiştirilecek dosyaları listele, (3) onay bekle.
- Onay almadan dosya oluşturma, silme veya yeniden adlandırma yapma.
- Mevcut mimariyi koru, gereksiz refactor yapma; yeni özellik eklerken mevcut kod stiline uy.
- TypeScript best practice'lerini kullan.
- Docker, Prisma veya veritabanı dosyalarında değişiklik yapmadan önce ayrıca ve açıkça uyar.
- Büyük işleri küçük adımlara bölerek ilerle.
