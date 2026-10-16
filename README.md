# Gym Staff & Payroll

Staff attendance and salary management for the gyms. Next.js + Supabase (Postgres with row-level security).

## Roles
- **Admin**: all gyms; creates logins; chooses each manager's gyms and permissions.
- **Gym manager**: only assigned gyms, and only the abilities the admin switched on.
- **Staff**: own record only, from their own phone.

## Salary rules (per gym, set by admin or a manager with permission)
Cut method (daily / shift / hourly), divisor (fixed 30 by default), late marks per half day, optional overtime (off by default).
Deduction = monthly salary ÷ divisor × units missed.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard > Project Settings > API Keys > secret key).
3. `npm run dev`, open the app, click **Create the admin account** on the login page (works only while no account exists).
4. Supabase dashboard > Authentication > Sign In / Providers: turn **off** "Allow new users to sign up". Logins are created by the admin inside the app.

The schema is in `supabase/migrations/`. It is already applied to the `gym-staff-payroll` Supabase project.

## Deploy (Vercel)
Add the three variables from `.env.example` to the Vercel project. `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only.

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
