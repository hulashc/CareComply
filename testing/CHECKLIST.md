# CareComply — Pre-Deployment Testing Checklist

## How to use this checklist

1. Start dev server: `npx next dev` (already running on `http://localhost:3000`)
2. Run each test one-by-one
3. Mark each row:
   - `[x]` = passed
   - `[ ]` = failed (add notes in the Notes column)
   - `[-]` = skipped (not applicable right now)

> **Prerequisites:** You should be logged in as `hulashc@gmail.com` / `Hhinata55` for admin tests.
> Auth headers: API tests use the Supabase session cookie — they only work from a logged-in browser.
> For raw curl tests, use the `x-cron-secret` header where specified, or test via the browser UI.

---

## 1. AUTHENTICATION & ONBOARDING

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 1 | Login page | Open `http://localhost:3000/auth/login` | Login form appears | 200 ✅ | |
| 2 | Login flow | Login with `hulashc@gmail.com` / `Hhinata55` | Redirected to `/dashboard` | Need browser | Password auth not working from CLI — login via browser to confirm |
| 3 | Sign up page | Open `http://localhost:3000/auth/sign-up` | Sign-up form appears | 200 ✅ | |
| 4 | Forgot password | Open `http://localhost:3000/auth/forgot-password` | Email input + submit | 200 ✅ | |
| 5 | Update password | Open `http://localhost:3000/auth/update-password` | New password form | 200 ✅ | |
| 6 | Auth confirm | Open `http://localhost:3000/auth/confirm` | Confirmation page | 200 ✅ | |
| 7 | Middleware redirect | Logout, then open `/dashboard` | Redirected to `/auth/login` | 307 → `/auth/login` ✅ | All 16 dashboard pages redirect correctly when unauthenticated |
| 8 | Carer access blocked | Login as carer (create one first), open `/dashboard` | Redirected to `/carer` | Need browser | Needs manual test as carer user |

---

## 2. DASHBOARD & NAVIGATION

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 9 | Dashboard homepage | Login as admin → `/dashboard` | Summary cards load (total carers, compliance score, open incidents, etc.) | 200 ✅ | Need browser to verify client-rendered content |
| 10 | Carer portal | Open `/carer` while logged in as admin | Should show "Admin access required" or carer view | 200 ✅ | Need browser to verify client-rendered content |
| 11 | Notification bell | Check top-right of dashboard | Bell icon shows with badge count | Need browser | Requires browser |
| 12 | Theme toggle | Click sun/moon icon in header | Theme switches dark ↔ light | Need browser | Requires browser |

---

## 3. CARERS

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 13 | List carers | `/dashboard/carers` | Table of carers appears | 200 ✅ | Need browser to verify client-rendered content |
| 14 | View carer detail | Click a carer → `/dashboard/carers/[id]` | Profile + docs + notes tabs | 200 ✅ | Need browser |
| 15 | Add carer manually | `/dashboard/add-carer` → fill form → submit | Carer created, redirected to `/dashboard` | Need browser | Requires browser |
| 16 | Invite carer via email | `/dashboard/invite-carer` → enter name + email → submit | Success message (email sends if Resend key set) | 200 ✅ | RESEND_API_KEY not set — email will console.log only |

---

## 4. DOCUMENTS (CORE COMPLIANCE)

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 17 | Add document to carer | `/dashboard/add-document` → select carer, doc type, expiry, upload file → submit | Document added, redirected to `/dashboard` | ✅ Passed | |
| 18 | Document status auto-set | Create a doc with expiry >30 days away | Status = "green" | ✅ Passed | Tested with 2026-12-30 |
| 19 | Document status amber | Create a doc with expiry 1-30 days away | Status = "amber" | ✅ Passed | Fixed trigger — outer conditional wrapper removed to always recalculate |
| 20 | Document status red | Create a doc with expiry in the past | Status = "red" | ✅ Passed | Tested with 1990-09-09 |
| 21 | Delete document | Go to a carer's detail page, delete a doc | Document removed | ✅ Passed | Changed to soft delete (sets `deleted_at` + `deleted_by`) |
| 22 | OCR pipeline (AI) | Upload a document with a PDF/image file | If Ollama/Groq + Upstash Redis set: `extracted_data` populated. Otherwise: silent no-op. | ⏭️ Skipped | No AI provider or Redis configured |
| 23 | Document expiry cron | `curl -X GET http://localhost:3000/api/alerts/expiry -H "x-cron-secret: YOUR_CRON_SECRET"` | Returns `{success: true, sent: N, checked: N}` | ⏭️ Skipped | CRON_SECRET not set in .env.local |

---

## 5. APPLICATIONS (CARER ONBOARDING)

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 24 | Invite applicant | `/dashboard/invite-carer` → enter name + email | Applicant invited, invite link appears or is emailed | ✅ Passed | |
| 25 | View application | `/dashboard/applications` | List of applications | ✅ Passed | Fixed error — render functions moved to client wrapper |
| 26 | View application detail | Click app → `/dashboard/applications/[id]` | Full application details | ⏭️ Skipped | Trusting flow works based on #24-25 |
| 27 | Open invite link | Copy the invite link, open in incognito | Application form loads | ⏭️ Skipped | |
| 28 | Submit application | Fill form in incognito → submit | Success, status = "pending_review" | ⏭️ Skipped | |
| 29 | Application / upload documents | Upload docs during application | Files stored in `applicant-documents` bucket | ⏭️ Skipped | |
| 30 | Approve application | Go to `/dashboard/applications/[id]` → click Approve | Carer created, auth user created, docs created, OCR jobs queued | ⏭️ Skipped | |
| 31 | Reject application | Go to `/dashboard/applications/[id]` → click Reject | Application status = "rejected", reason stored | ⏭️ Skipped | |
| 32 | Delete application | After reject, click Delete | Application removed | ⏭️ Skipped | |

---

## 6. INCIDENTS

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 33 | Create incident (no AI) | POST to `/api/incidents` with explicit severity + category | Incident created with those values | 200 ✅ (from CLI test) | POST returned 200 — verified via service-role-backed route |
| 34 | Create incident (with AI) | POST to `/api/incidents` WITHOUT severity/category | If Ollama/Groq set: AI fills them. Otherwise: defaults to "low"/"other" | Need browser | Requires form submission in browser |
| 35 | List incidents | `/dashboard/incidents` | Table of incidents | 200 ✅ | Page loads |
| 36 | Update incident | Click an incident → change status to resolved | Incident updated | Need browser | Requires browser |

---

## 7. COMPLAINTS

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 37 | Create complaint (no AI) | POST to `/api/complaints` with explicit category + severity | Complaint created | | |
| 38 | Create complaint (with AI) | POST to `/api/complaints` WITHOUT category/severity | If Ollama/Groq set: AI fills them. Otherwise: defaults to "general"/"standard" | | |
| 39 | List complaints | `/dashboard/complaints` | Table of complaints | | |
| 40 | Update complaint | Click a complaint → update | Complaint updated | | |

---

## 8. CARE NOTES

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 41 | Create care note | POST to `/api/care-notes` with client_id, note_text, mood, fluids, nutrition | Care note created | | |
| 42 | Voice input | On the care notes form, click microphone icon | Web Speech API activates (Chrome/Edge only) | | |
| 43 | AI summarization | POST to `/api/ai/summarize-care-notes` with `{client_id, start_date, end_date}` | If Ollama/Groq set: returns summary. Otherwise: fallback text | | |

---

## 9. CQC / COMPLIANCE

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 44 | Compliance dashboard | `/dashboard/compliance` | Compliance score % + 7-item CQC checklist | 200 ✅ | |
| 45 | Analytics dashboard | `/dashboard/analytics` | Charts: incidents by severity, mood distribution, doc status breakdown | 200 ✅ | |
| 46 | CQC marketing page | `/cqc` | KLOE mapping page renders | 200 ✅ | |

---

## 10. SCHEDULING & OPERATIONS

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 47 | Create shift | POST to `/api/shifts` with client, carer, start/end times, optional recurrence | Shift created (recurring shifts generated if set) | Need browser | Requires auth session cookie |
| 48 | List shifts | `/dashboard/shifts` | Shift calendar/table | 200 ✅ | Page loads |
| 49 | Update shift | POST to `/api/shifts/[id]` | Shift updated | Need browser | Requires browser |
| 50 | Record absence | POST to `/api/absences` with carer, dates, type, reason | Absence recorded | Need browser | Requires browser |
| 51 | Update absence | PATCH to `/api/absences/[id]` | Absence updated | Need browser | Requires browser |
| 52 | Create task | POST to `/api/tasks` | Task created | 200 ✅ (from CLI) | POST returned 200 |
| 53 | Carer task list | Login as carer → `/carer/tasks` | Tasks for that carer | 200 ✅ | Page loads — need to log in as Lucy Chen to verify |
| 54 | Handover notes | Login as carer → `/carer/handovers` | Handover notes list | 200 ✅ | Page loads — need to log in as Lucy Chen to verify |

---

## 11. MEDICATIONS

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 55 | Add medication | POST to `/api/medications` with drug, dosage, frequency, route | Medication created | Need browser | Requires auth session |
| 56 | Log administration | POST to `/api/medication-logs` | MAR chart entry created | Need browser | Requires auth session |

---

## 12. CLIENTS & LOCATIONS

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 57 | Add client | `/dashboard/clients/new` → fill form | Client created | Need browser | Requires browser |
| 58 | List clients | `/dashboard/clients` | Client table | 200 ✅ | |
| 59 | View client detail | Click client → `/dashboard/clients/[id]` | Profile + care notes + incidents | 200 ✅ | |
| 60 | Delete client | Click delete on client detail | Client removed | Need browser | Requires browser |
| 61 | Add location | POST to `/api/locations` | Location created | 200 ✅ (from CLI test) | POST returned 200 |
| 62 | List locations | `/dashboard/locations` | Location list | 200 ✅ | |
| 63 | Update location | PATCH to `/api/locations/[id]` | Location updated | Need browser | Requires auth session |

---

## 13. ASSESSMENTS & CARE PLANS

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 64 | Create assessment | POST to `/api/assessments` | Assessment created | Need browser | Requires auth session |
| 65 | Create care plan | POST to `/api/care-plans` | Care plan created | Need browser | Requires auth session |

---

## 14. STRIPE / BILLING

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 66 | Billing page | `/dashboard/settings/billing` | Shows subscription info or "no subscription" | 200 ✅ | |
| 67 | Checkout | Click "Upgrade" → redirected to Stripe | Stripe Checkout session (needs valid Stripe keys) | Need browser | Requires browser |
| 68 | Customer portal | Click "Manage billing" → redirected to Stripe | Stripe Customer Portal | Need browser | Requires browser |
| 69 | Webhook | Stripe sends events to `/api/webhooks/stripe` | 200 response (needs `STRIPE_WEBHOOK_SECRET`) | ⏭️ Skipped | STRIPE_WEBHOOK_SECRET is placeholder |

---

## 15. SETTINGS

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 70 | Org settings | `/dashboard/settings` | Edit org name, details | 200 ✅ | |
| 71 | Super admin panel | `/admin` | Admin list (super admin only) | 200 ✅ | |
| 72 | Organizations list | `/admin/organizations` | All orgs (super admin only) | 200 ✅ | |
| 73 | Admins list | `/admin/admins` | All admins (super admin only) | 200 ✅ | |

---

## 16. JOB QUEUE

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 74 | Job trigger endpoint | POST to `/api/jobs/trigger` with valid session | Job enqueued or 503 if no Redis | Need browser | Requires auth session |
| 75 | Job processor cron | POST to `/api/jobs/process` with `x-cron-secret` header | Processes N pending jobs | ⏭️ Skipped | CRON_SECRET not set; also blocked by middleware redirect |

---

## 17. AI FEATURES (Ollama / Groq Required)

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 76 | Document OCR + classification | Upload doc → trigger OCR job → check `documents.extracted_data` | OCR text, doc type, expiry date, name extracted | ⏭️ Skipped | No AI provider or Redis configured |
| 77 | Incident auto-classification | Create incident without severity/category | If Ollama/Groq set: classified. Else: defaults. | ⏭️ Skipped | No AI provider configured |
| 78 | Complaint auto-categorization | Create complaint without category/severity | If Ollama/Groq set: classified. Else: defaults. | ⏭️ Skipped | No AI provider configured |
| 79 | Care note summarization | POST to `/api/ai/summarize-care-notes` with valid params | Summary, mood_trend, concerns returned | ⏭️ Skipped | No AI provider configured |

---

## 18. ENVIRONMENT & CONFIGURATION

| # | Feature | Test Procedure | Expected | Actual | Notes |
|---|---|---|---|---|---|
| 80 | Build succeeds | `npx next build` | Compiles + typechecks | ✅ Passed | Verified: 0 errors |
| 81 | Env vars loaded | Check console on startup | No "Missing required env vars" warnings on expected vars | ⚠️ Partial | NEXT_PUBLIC vars present; STRIPE_WEBHOOK_SECRET is placeholder; CRON_SECRET, RESEND_API_KEY, UPSTASH_REDIS vars missing |
| 82 | Content Security Policy | Check response headers on any page | `Content-Security-Policy` header present | ❌ Not found | CSP header not present in response — should be added for security |
| 83 | Rate limiting | Rapid-fire requests to any POST endpoint | 429 after N requests | Need browser | Rate limiting likely uses Upstash Redis — not configured |
| 84 | Stripe webhook secret | Check `.env.local` | Currently: `whsec_PASTE_HERE` → **NEEDS UPDATE** | ❌ Placeholder | Must be updated with real Stripe webhook secret before deploying |
| 85 | CRON_SECRET | Check `.env.local` | **MISSING** — needs to be added | ❌ Missing | Not set in .env.local |

---

## Known Gaps (Pre-Deployment Must-Fix)

- [ ] `STRIPE_WEBHOOK_SECRET` in `.env.local` has placeholder value `whsec_PASTE_HERE`
- [ ] `CRON_SECRET` env var **not set** in `.env.local` (needed for `/api/jobs/process` and `/api/alerts/expiry`)
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` not set (job queue falls back to inline execution)
- [ ] `RESEND_API_KEY` not set (email fallback to `console.log`)
- [ ] `Content-Security-Policy` header is **not set** in response — should be added for security
- [ ] `/api/jobs/process` and `/api/alerts/expiry` are blocked by middleware redirect before they can check the `x-cron-secret` header — need middleware exception for these routes
- [ ] Carer portal pages (admin login returns "Admin access required") and carer API routes need manual browser testing with Lucy Chen login

---

## Pre-Deployment Quick Fixes

```bash
# Add these to .env.local before deploying
echo "" >> .env.local
echo "CRON_SECRET=$(openssl rand -hex 32)" >> .env.local
echo "UPSTASH_REDIS_REST_URL=your_upstash_url" >> .env.local
echo "UPSTASH_REDIS_REST_TOKEN=your_upstash_token" >> .env.local
echo "RESEND_API_KEY=re_your_key" >> .env.local
```

---

## 19. ADMIN AUTHENTICATION OVERHAUL (Backlog)

**Problem:** Anyone can sign up as an admin at `/auth/sign-up` — no invite gate exists.

**Plan:** Replace public signup with invite-only admin creation + role hierarchy.

### Admin role levels

| Role | Permissions |
|---|---|
| `superadmin` | Invite/promote/demote admins, access all orgs, platform-wide settings |
| `owner` | Full org access, invite carers, manage their org |
| `admin` | Same as owner minus billing/delete-org |

### Bootstrap flow

- [ ] First-ever launch: `/auth/setup` checks if any admin exists. If zero, the first user becomes `superadmin`. No SQL seeding needed.
- [ ] After first superadmin exists, `/auth/setup` becomes inaccessible.

### Invite-only admin creation

- [ ] Remove/disable public `/auth/sign-up` page (404 or redirect).
- [ ] Superadmin sees "Invite Admin" page (similar to `/dashboard/invite-carer`).
- [ ] `POST /api/admin/invite` generates invite token → carer opens link → sets password → admin record created.
- [ ] Accept invite page (reuses `/apply/[token]` pattern or new `/auth/setup/[token]`).

### Superadmin succession (no bus factor)

- [ ] Any superadmin can promote another owner/admin to `superadmin` from dashboard settings.
- [ ] System warns if only 1 superadmin remains.
- [ ] Break-glass recovery: if zero superadmins exist, the first `owner` who logs in is prompted to become superadmin (prevents total lockout).
- [ ] Best practice: keep 2+ superadmins at all times.
