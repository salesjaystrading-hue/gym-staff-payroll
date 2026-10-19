# Gym Staff & Payroll

Staff attendance and salary management for the gyms. Next.js + Supabase (Postgres with row-level security).

## Roles
- **Admin**: all gyms; creates logins; chooses each manager's gyms and permissions.
- **Gym manager**: only assigned gyms, and only the abilities the admin switched on.
- **Staff**: own record only, from their own phone.

## Salary rules (per gym, set by admin or a manager with permission)
Cut method (daily / shift / hourly), divisor (fixed 30 by default), late marks per half day, optional overtime (off by default).
Deduction = monthly salary ÷ divisor × units missed.

## Hosting (free, GitHub Pages)
The app is one file: `docs/index.html`. It talks straight to Supabase (login, database rules, and the `team-admin` Edge Function for creating logins), so no server is needed.
1. GitHub repo > Settings > Pages > Deploy from branch `main`, folder `/docs`.
2. The site is at `https://<user>.github.io/gym-staff-payroll/`.
3. Supabase dashboard > Authentication > Sign In / Providers: turn **off** "Allow new users to sign up", and turn on leaked-password protection.
The Supabase publishable key inside the file is public by design; data is protected by row-level security. Never put the secret/service key in the repo.

The older Next.js app (`src/`) is no longer used.

The schema is in `supabase/migrations/`; the Edge Function source is `supabase/functions/team-admin/index.ts`.

## Attendance without logins
1. Manager: Attendance > Show QR > create a **display link** (valid 30-90 days, revocable). Open it once on the phone kept at the gym.
2. Manager: **PINs** page > generate a 6-digit PIN for each employee (shown once, stored only as a hash).
3. Employee: scans the QR with the phone camera, enters Employee ID + PIN. No app and no login.
The QR changes every 30 s and is checked on the server. 5 wrong PINs lock that employee for 15 minutes.

## What is in it
- **Gyms, employees, shifts, holidays**; salary rules per gym.
- **Attendance**: staff scan a QR code (changes every 30 s) with their own phone; one registered phone per person; managers can mark or correct with a written reason. Monthly register.
- **Leave**: staff request, manager approves as paid or unpaid (unpaid cuts salary).
- **Payroll**: draft per gym per month, review warnings, approve and lock, record payments, salary slip PDF, adjustments for later corrections.
- **Advances and bonus**: recovered automatically, never twice.
- Menus and abilities differ for admin, gym manager (as the admin allows) and staff.

Not built (small team): notifications, GPS, biometric devices, extra reports. Monthly register and payroll screens cover day-to-day needs.

## Notes
- Salary cut = monthly salary ÷ divisor × units missed. "Per shift" behaves like daily (one shift per day).
- Days nobody marked count as absent but are flagged before approval.
- The database functions are listed in `supabase/migrations/`. Functions avoid `DELETE` statements on purpose.
