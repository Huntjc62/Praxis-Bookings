# Praxis Bookings

A polished front-end prototype for a lightweight local-business booking platform.

## Included

- Business dashboard
- Booking management
- Calendar
- Services with price, duration and buffer time
- Staff management
- Availability controls
- Public customer booking flow
- Automatic staff assignment
- Booking confirmation
- Payment state (simulated)
- Booking reminders setting (UI)
- Local persistence using browser localStorage
- Responsive mobile layout

## Run it

Open `index.html` in a modern browser.

No build step is required.

## Demo flow

1. Open the dashboard.
2. Click **View booking page**.
3. Choose a service.
4. Pick a date and time.
5. Enter customer details.
6. Confirm the booking.
7. Return to the dashboard and see the new booking.

## Turning this into a production SaaS

The current version deliberately runs entirely in the browser so it is immediately testable. For a live product, replace localStorage with a backend/database and connect:

- Stripe Checkout / Payment Intents
- Transactional email (Resend, Postmark, SendGrid or similar)
- SMS/WhatsApp reminders
- Authentication
- Multi-business tenancy
- Real calendar integrations
- Webhooks
- GDPR tooling
- Audit logging
- Server-side availability locking

Suggested stack:

- Next.js / React
- PostgreSQL
- Prisma
- Stripe
- Resend
- Vercel

Suggested SaaS plans:

Starter £19/month
- 1 staff member
- 3 services
- Online bookings
- Email confirmations

Growth £49/month
- 5 staff
- Unlimited services
- Payments
- Reminders
- Customer database

Pro £99/month
- Unlimited staff
- Multiple locations
- Advanced reporting
- Calendar integrations
- Custom branding
