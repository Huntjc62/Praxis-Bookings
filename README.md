# Praxis Bookings v3 — Firebase Accounts + Firestore

This version replaces the local SQLite/browser storage approach with Firebase Authentication and Cloud Firestore.

## Firebase setup

1. Create a project in Firebase Console.
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Create a **Firestore Database**.
4. Add a Web App to the Firebase project.
5. Copy the Firebase web configuration into `firebase-config.js`.
6. Deploy the included `firestore.rules`.

## Run

Because Firebase modules are loaded in the browser, serve this folder over HTTP rather than opening index.html directly.

For example:

python -m http.server 8080

Then open:

http://localhost:8080

Or deploy to Firebase Hosting / Vercel / Netlify.

## Data structure

businesses/{businessId}
- ownerId
- name
- category
- email
- phone
- address
- slug
- stripeConnected

businesses/{businessId}/services/{serviceId}

businesses/{businessId}/staff/{staffId}

businesses/{businessId}/availability/{weekday}

businesses/{businessId}/settings/general

businesses/{businessId}/bookings/{bookingId}

## Authentication

The signup page uses Firebase Authentication with email/password.

Each business is tied to the authenticated Firebase UID. The dashboard only loads the current user's business.

## Stripe — important

Firebase should hold the application data, but **Stripe secret keys must never be placed in `app.js` or `firebase-config.js`**.

For production payments, use a trusted backend such as:

- Firebase Cloud Functions
- Cloud Run
- A Node/Express API

Recommended payment flow:

Customer booking
→ Firestore creates pending booking
→ HTTPS Cloud Function creates Stripe Checkout Session
→ Customer pays on Stripe
→ Stripe webhook reaches trusted backend
→ Backend verifies webhook signature
→ Firestore booking becomes paid + confirmed

For a multi-business SaaS, use **Stripe Connect** so each business can connect its own Stripe account.

The Connect flow should:
1. Create an Express connected account.
2. Generate a Stripe Account Link.
3. Send the business through Stripe onboarding.
4. Store the connected `acct_...` ID in `businesses/{businessId}`.
5. Create Checkout Sessions on behalf of the connected account / use the appropriate Connect charge structure.
6. Use webhooks for successful payments, refunds and failed payments.

## Production security

Before going live:
- Review and tighten Firestore rules.
- Do not allow unrestricted public reads of sensitive business documents.
- Separate public booking-page data from private business data.
- Add App Check.
- Add email verification.
- Add password reset.
- Add rate limiting / abuse protection.
- Validate all booking input server-side.
- Prevent race-condition double bookings using a trusted backend/transaction.
- Put Stripe operations exclusively in trusted server-side code.
- Add GDPR controls and deletion/export workflows.
- Add proper transactional email/SMS reminders.

## Current status

The UI and account/database layer are Firebase-ready and the booking flow writes to Firestore.

The Stripe button is deliberately a safe placeholder: the next production implementation should connect it to a Firebase Cloud Function / backend rather than exposing Stripe secrets in the browser.
