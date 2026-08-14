# Praxis Bookings v2 — Accounts + Stripe-ready payments

## What changed

This version moves the product from a browser-only prototype to a real Node/Express application with:

- Business account creation
- Secure password hashing with bcrypt
- Login/logout sessions
- SQLite database
- Separate business records
- Services stored per business
- Staff stored per business
- Availability stored per business
- Public booking URLs
- Real booking records
- Server-side slot checking
- Stripe Checkout integration
- Stripe webhook handling
- Paid/confirmed booking state
- Stripe connection state on each business

## Run locally

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Set `SESSION_SECRET`.
4. For Stripe test payments, add your Stripe test secret key as `STRIPE_SECRET_KEY`.
5. Run:

npm install
npm run dev

Then open:

http://localhost:3000

## Stripe

The booking endpoint creates a Stripe Checkout Session when the business has a Stripe account connected.

For a production multi-business SaaS, use **Stripe Connect**. Each business should complete Connect onboarding and Praxis should store its connected Stripe account ID.

The intended production payment flow is:

Customer books
→ Praxis creates pending booking
→ Stripe Checkout
→ customer pays
→ Stripe sends `checkout.session.completed`
→ webhook marks booking paid + confirmed

Never mark a paid booking as paid from the browser return URL alone. The webhook is the source of truth.

### Local webhook testing

With the Stripe CLI installed:

stripe listen --forward-to localhost:3000/api/stripe/webhook

Put the generated `whsec_...` value into `STRIPE_WEBHOOK_SECRET`.

Use Stripe test card:

4242 4242 4242 4242

Any future expiry and CVC can be used in Stripe's test environment.

## Stripe Connect production addition

The current UI has a "Connect Stripe" placeholder. To make marketplace payouts production-ready, add:

- `POST /api/stripe/connect`
- Create a Stripe Express connected account
- Create an Account Link
- Redirect the business through Stripe onboarding
- Save `acct_...` to `businesses.stripe_account_id`
- Set `stripe_connected=1` only after Stripe confirms the account is ready
- Add `transfer_data.destination` / appropriate Connect charge structure to Checkout
- Handle Connect account webhooks and failed payments/refunds

This should be done server-side.

## Important production work still required

Before charging real customers:

- HTTPS
- Secure production session store
- Secure cookies
- CSRF protection where appropriate
- Rate limiting
- Email confirmation/reminders
- SMS/WhatsApp reminders
- Password reset
- Email verification
- Account deletion/export
- GDPR/privacy tooling
- Stripe Connect onboarding
- Refunds
- Rescheduling
- Double-booking protection with stronger transactional locking
- Database hosting/backups
- Proper multi-user roles
- Audit logging
- Error monitoring
- Production payment/refund testing

## Suggested SaaS pricing

Starter — £19/month
- 1 staff member
- 3 services
- Booking page
- Email confirmations

Growth — £49/month
- 5 staff
- Unlimited services
- Stripe payments
- Reminders
- Customer database

Pro — £99/month
- Unlimited staff
- Multiple locations
- Advanced reporting
- Calendar integrations
- Custom branding

Transaction fees should be disclosed separately. Stripe fees are paid to Stripe and Praxis can optionally charge its own platform fee if the commercial model and Stripe Connect setup support it.
