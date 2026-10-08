# Ordo

Client operating system for projects, deliverables, approvals, and collaboration.

## Development

Use Node.js and npm:

```sh
npm ci
npm run dev
```

## Production

Target: https://ordo.inspirarestudio.com on Hostinger.

```sh
npm ci
npm run build
```

Deploy `dist`, with an index.html fallback for client routes. Apache hosting can use the included `.htaccess`. Production configuration targets the owned Supabase project. Server credentials belong only in Supabase secrets; never frontend build variables.

Backend setup and remaining launch checks: [backend replacement](docs/backend-replacement.md) and [Hostinger email setup](docs/hostinger-email-setup.md).
