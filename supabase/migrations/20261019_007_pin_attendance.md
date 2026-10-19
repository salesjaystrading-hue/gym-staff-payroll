# PIN attendance and display links (applied to Supabase as three migrations)

Applied migrations: `pin_attendance_and_display_links`, `attempts_use_clock_timestamp`, `challenge_gym_and_pin_unlock`
(see the project's migration history for the full SQL).

Tables: `employee_pins` (bcrypt hash only, no policies), `attendance_attempts` (throttling), `display_tokens` (sha256 hash, per gym, expiring, revocable).
Functions: `private.mark_attendance`, `qr_check_in` (one-phone rule removed), `display_refresh(token)`, `challenge_gym(challenge)`,
`pin_check_in(challenge, code, pin)` (anon + authenticated; 5 wrong PINs = 15 min lock, 25 wrong per gym per 5 min = pause),
`set_employee_pin`, `employees_with_pin`, `create_display_token`, `revoke_display_token` (managers only).
