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
