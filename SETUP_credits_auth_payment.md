# CVMOJO — Setup for credits, guest trial, Google sign-in, survey, and payments

This covers everything you need to configure outside the code for the new
credit/auth/survey system, plus how to add Stripe later and the legal points to
be aware of.

---

## 1. Run the database migration (required)

Open Supabase → SQL Editor and run **`supabase/credits.sql`** (after
`schema.sql`). It adds the credit columns, the secure credit functions, the
survey table, and locks down direct credit edits so users can't give themselves
credits from the browser.

---

## 2. Enable guest (anonymous) trial — required for "3 free tries"

Supabase Dashboard → **Authentication → Sign In / Providers → Anonymous sign-ins → Enable**.

Without this, guests can't try the app; they'll be asked to sign in instead.
Anonymous users get 3 credits; when they sign up (email or Google) they get 30.

Tip: also turn on **Authentication → Attack Protection → enable CAPTCHA** later,
since anonymous sign-ins can be abused to farm free credits. Add a server-side
IP rate limit if abuse becomes a problem.

---

## 3. Google sign-in (Google OAuth)

The code is already wired (`Continue with Google` buttons + `/auth/callback`).
You just need to create Google credentials and paste them into Supabase.

1. Google Cloud Console → create/select a project.
2. **APIs & Services → OAuth consent screen** → configure (External), add your
   app name **CVMOJO**, support email, and your domain.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID →
   Web application**.
4. Under **Authorized redirect URIs**, add the callback Supabase shows you, which
   looks like:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client secret**.
6. Supabase Dashboard → **Authentication → Sign In / Providers → Google → Enable**,
   paste the Client ID and secret, Save.
7. Supabase → **Authentication → URL Configuration**: set **Site URL** to your
   real domain and add your domain (and `http://localhost:3000` for dev) to
   **Redirect URLs**. Our app redirects to `/auth/callback`, which is covered by
   the Site URL.

---

## 4. Branded confirmation / verification email ("from CVMOJO")

Yes — you can fully brand it. Two levels:

**A. Customize the email content (free, do this now)**
Supabase Dashboard → **Authentication → Emails → Templates**. Edit the
"Confirm signup" (and "Magic Link", "Reset password") templates: change the
subject to something like `Confirm your CVMOJO account` and edit the HTML body
with your CVMOJO name/logo. You can also set the **sender name** here.

**B. Send from your own domain (recommended before launch)**
By default these emails come from Supabase's shared mail server (generic
`noreply@mail.app.supabase.io`, low limits, more likely to hit spam). To have
them come from `noreply@cvmojo.com`:
Supabase Dashboard → **Project Settings → Authentication → SMTP Settings →
enable Custom SMTP**, and plug in an email provider (Resend, Postmark, SendGrid,
Mailgun, or AWS SES). You verify your domain with that provider (SPF/DKIM DNS
records), then the verification emails are sent from your CVMOJO address with
your branding. This also raises the daily email send limit, which the default
Supabase mailer caps quite low.

Note: the user-visible **app name** on Google's consent screen ("CVMOJO wants
access to…") comes from step 3.2 above, not from email settings.

---

## 5. How the credit system behaves (reference)

- Guest (anonymous): **3** credits.
- Signs up (email or Google): **30** credits (granted once).
- Completing the in-app survey: **+10** credits (once).
- Each full **generate** = 1 credit. **Refining keywords is free.**
- A credit is only spent on success; if generation errors, it's refunded.
- Out of credits: guests see "sign up", registered users see "survey or buy".

---

## 6. Stripe payments (build later)

The "Buy more credits" button is currently a stub. When you're ready, here's the
path. Tell me when your Stripe account is set up and I'll wire the code.

**Stripe dashboard**
1. Create a Stripe account, activate it (business details, bank account for
   payouts).
2. Decide the model: simplest is **one-time credit packs** (e.g. "50 credits =
   $5") via Stripe Checkout. A subscription is also possible but adds dunning,
   cancellation, proration complexity — start with packs.
3. Create a **Product** + **Price** for each pack (Products → Add product).
4. Get your API keys (Developers → API keys): **Publishable key** and **Secret
   key**. Use **test mode** keys first.
5. Create a **webhook** endpoint (Developers → Webhooks) pointing at
   `https://yourdomain.com/api/stripe/webhook`, subscribe to
   `checkout.session.completed`, and copy the **Signing secret**.

**Code I'll add when you're ready**
- `.env`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and the price IDs.
- `POST /api/checkout` → creates a Stripe Checkout Session for the chosen pack,
  with the user id in `metadata`, returns the redirect URL.
- `POST /api/stripe/webhook` → verifies the signature, and on
  `checkout.session.completed` adds the purchased credits via a new
  `add_purchased_credits(uid, n)` SECURITY DEFINER function (so it's as tamper-
  proof as the rest).
- Wire the stub "Buy more credits" button to call `/api/checkout`.

Important: credits must be granted by the **webhook**, never by the browser
success redirect (the redirect can be faked; the signed webhook can't).

---

## 7. Legal considerations (please read before charging money)

I'm not a lawyer, so treat this as a checklist to review, ideally with one:

- **Terms of Service & Privacy Policy.** Once you collect emails, resumes, and
  payments you need both. Resumes are personal data. State what you store, why,
  how long, and how users delete it. Add links in your footer and at signup.
- **GDPR / CCPA.** If you have EU or California users: lawful basis for
  processing, a way to export/delete their data, and a cookie/consent notice.
  You already store resume text and generated docs per user — include those in
  any deletion flow.
- **Payment compliance.** Don't store card numbers yourself; Stripe handles PCI.
  You will need a **refund policy** and clear pricing shown before purchase.
- **Consumer refund/cancellation rules.** Many jurisdictions require a refund/cancel
  path for digital purchases. Decide your policy (e.g. unused credits
  refundable within N days) and publish it.
- **Sales tax / VAT.** Digital goods are taxable in many places. Consider
  **Stripe Tax** to calculate and collect automatically.
- **The survey-for-credits offer.** Keep it honest: say what data you collect in
  the survey and that it's used to improve the product. Don't make completion
  feel coerced beyond the credit reward.
- **AI-generated content disclaimer.** Add a line that resumes/cover letters are
  AI-assisted drafts the user should review for accuracy; you don't guarantee
  interviews or job outcomes.
- **Email compliance (CAN-SPAM / CASL).** Any marketing email needs an
  unsubscribe link and your physical address. Transactional emails (verification)
  are exempt but keep them transactional.

A practical order: publish Terms + Privacy first (you can use a generator and
then have them reviewed), then turn on payments.
