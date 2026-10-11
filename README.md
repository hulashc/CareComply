# CareComply

Care home compliance management platform. Built with Next.js 16, TypeScript, Supabase, and Tailwind CSS.

## Getting Started

```bash
npm install
cp .env.example .env.local
# Fill in your Supabase credentials in .env.local
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `NEXT_PUBLIC_APP_URL` | Yes | Application URL (e.g. http://localhost:3000) |
| `RESEND_API_KEY` | No | Resend API key for email notifications |

## Scripts

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
npm run types     # Regenerate Supabase database types
```

## Database

The database schema is managed via Supabase. Migration files are in `supabase/migrations/`.

To regenerate TypeScript types after schema changes:

```bash
npm run types
```

## Architecture

```
app/
├── dashboard/         # Admin dashboard pages
│   ├── clients/       # Client management
│   ├── carers/        # Carer management
│   ├── applications/  # Application processing
│   ├── shifts/        # Rostering & scheduling
│   ├── incidents/     # Incident reporting
│   ├── handovers/     # Shift handover notes
│   ├── absences/      # Absence management
│   ├── analytics/     # Analytics & trends
│   ├── compliance/    # CQC compliance report
│   ├── carer-portal/  # Mobile-friendly carer view
│   └── settings/      # Organisation settings
├── api/               # API routes
├── apply/             # Carer application form
├── auth/              # Authentication pages
└── forms/             # Form link system

lib/
├── database.types.ts  # Auto-generated Supabase types
├── services/          # Business logic layer
├── schemas/           # Zod validation schemas
└── supabase/          # Supabase client configs

components/
├── ui/                # shadcn/ui components
└── shared/            # App-specific components
```

## Rostering API (phase 1)

Data model and API only (no UI yet). A roster item is a **visit**: a row in `shifts`. Migration
`023_rostering.sql` adds multi-carer visits (double-ups), recurring series, draft/published state,
skills, client preferences/exclusions, carer attributes and availability, and org matching weights.
All endpoints are admin-only and scoped to the admin's organisation. Dates and times are London
calendar dates and wall-clock times (`YYYY-MM-DD`, `HH:mm`), never naive ISO strings.

| Endpoint | Purpose |
|---|---|
| `GET /api/roster/visits?from&to` | List by date range (max 62 days); filters `client_id carer_id location_id status roster_state series_id skill unassigned` |
| `POST /api/roster/visits` | Create a visit, or a recurring series when `recurrence` is given |
| `GET / PATCH / DELETE /api/roster/visits/[id]` | Read; edit or delete with `scope` = `this` / `following` / `all` |
| `POST /api/roster/visits/[id]/assignments` | Assign a carer (eligibility-checked; `force` overrides soft rules only) |
| `DELETE /api/roster/visits/[id]/assignments/[carerId]` | Unassign |
| `POST /api/roster/visits/bulk` | `assign unassign set_status publish unpublish update delete` over `ids` or a `filter`, with `dry_run` |
| `GET /api/roster/availability?from&to` | Working hours, leave and unavailability per carer |
| `PUT /api/roster/carers/[id]/working-hours`, `POST/DELETE .../unavailability` | Weekly hours and part-day blocks (leave stays on `/api/absences`) |
| `GET/PUT /api/roster/carers/[id]/attributes` | Skills, languages, gender, transport, max weekly hours, home location |
| `GET/PUT /api/roster/clients/[id]/preferences` | Gender preference, language, pets, non-smoker, preferred and do-not-pair carers |
| `GET/POST /api/roster/skills`, `PATCH .../skills/[id]` | Org skills catalogue |
| `GET/PUT /api/roster/settings` | Matching weights (defaults merged with the org's overrides) |

Assignment rules: **blocked** (never allowed): do-not-pair carer, approved leave/sick, inactive carer,
required gender. **Overridable with `force`**: overlapping visit, unavailability, missing skill, pet
allergy, over weekly hours. **Warnings**: outside working hours, soft preferences. Visit status
(`unassigned / assigned / confirmed / in_progress / completed / cancelled`) is derived from staffing
by a database trigger, so the older `/api/shifts` endpoints stay consistent.

```bash
npm run seed:roster -- --list                 # find your organisation id
npm run seed:roster -- --org <id> --dry-run   # preview the demo data
npm run seed:roster -- --org <id>             # seed 15 carers, 25 clients, 2 weeks of visits
npm run seed:roster -- --org <id> --clean     # remove exactly what the seed created
```

## Roster calendar (phase 2, read-only)

`/dashboard/roster`: Day, Week, Month, Timeline (carers as rows) and Clients views over the roster API,
with filters (carer, client, team/area, visit type, status, skills), search, an unassigned-visits tray
(soonest first), per-carer day/week hours, leave and unavailability as striped blocks, and a mobile
agenda. View, date, filters and zoom persist in the URL and localStorage. Keyboard: D/W/M/T/C switch
view, `[` `]` move, `.` is today, arrows move between visits, Enter opens details.

Built as custom grids on `@tanstack/react-virtual` (rows and columns windowed); see the decision note at the
top of `components/roster/roster-calendar.tsx`. For performance testing:
`npm run seed:roster -- --org <id> --reset --scale 100` (100 carers, 75 clients, ~1,000 visits a week).

## Features

- **Client Management** — Profiles, care plans, assessments, MAR charts, care notes with voice input
- **Carer Management** — Profiles, qualifications, compliance scoring, absence tracking
- **Rostering** — List/week/month views, recurring shifts, conflict detection
- **Compliance** — Document tracking with auto-status, expiry alerts, CQC reports
- **Operations** — Task management, handover notes, incident reporting
- **Analytics** — Compliance trends, incident charts, mood distribution
- **Security** — Admin role guards, PII masking, audit logging, RLS policies
- **UX** — Command palette (⌘K), keyboard shortcuts, dark mode, toast notifications

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS, shadcn/ui
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React
- **Email**: Resend
