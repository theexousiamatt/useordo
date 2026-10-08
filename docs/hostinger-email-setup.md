# Hostinger email setup for Ordo

App project: `ilvqopsvyacegotplstw`. Sender mailbox: `hello@inspirarestudio.com`.

## App invitations and notifications

The deployed `send-transactional-email` function uses Hostinger SMTP with TLS on port 465. `SMTP_HOST=smtp.hostinger.com` and `SMTP_USER=hello@inspirarestudio.com` are configured. The SMTP username is also the sender address. To activate delivery:

1. Open the project's Supabase dashboard.
2. Open **Edge Functions → Secrets**.
3. Add **SMTP_PASSWORD** with the password for the **hello@inspirarestudio.com mailbox**, not the Hostinger account password.
4. Save it. Do not paste the password into chat, frontend variables, GitHub, or a terminal command that will remain in history.

The handler validates the signed-in user and derives recipients, content, URLs, and deduplication keys from authorized database records. It handles workspace invitations, task assignments, deliverable review decisions, and the signed-in user's notification events. Unrelated/fabricated events are rejected. `dryRun: true` verifies authorization and configuration without sending a message.

Delivery tracking prevents concurrent duplicate sends and caps new messages at 50 per workspace per hour. A failed preparation can retry after one minute, up to three attempts. An SMTP attempt with an uncertain result is held for review rather than automatically resent; inspect Hostinger delivery records and `smtp_deliveries` before resolving it. Successful SMTP acceptance does not prove inbox delivery.

## Sign-up confirmations and password resets

Supabase Auth SMTP is a separate configuration; Edge Function secrets do not configure it.

Open **Authentication → Email → SMTP Settings** (or the Custom SMTP section in Authentication settings), enable Custom SMTP, and enter:

| Field | Value |
|---|---|
| Sender email | hello@inspirarestudio.com |
| Sender name | Ordo · Inspirare Studio |
| SMTP host | smtp.hostinger.com |
| SMTP port | 465 |
| SMTP username | hello@inspirarestudio.com |
| SMTP password | The mailbox password, entered privately |

Confirm the settings in Hostinger hPanel's mailbox configuration first. If the mailbox is actually on a Titan product, use the SMTP details shown by Hostinger for that mailbox instead of the Hostinger Email defaults.

## Before production cutover

Set Supabase Auth's Site URL to `https://ordo.inspirarestudio.com` and allow the actual reset/sign-in/invitation redirects used by the frontend. Keep staging/local URLs explicit. Ensure the subdomain and frontend are live before sending links to clients. Configure Google/GitHub OAuth separately if retaining those buttons.

Check Hostinger's email domain setup for SPF/DKIM. Sending limits depend on the mailbox plan; the app limit does not replace Hostinger's limits. Validate an invitation and a password-reset email using an address you control, check inbox/spam, and verify the link reaches the right Ordo screen. No real emails were sent during the code preparation; authorization checks use dry runs.

Sources:
- https://support.hostinger.com/en/articles/1575756-how-to-get-email-account-configuration-details-for-hostinger-email
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/functions/limits
