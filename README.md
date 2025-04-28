# Project Rare One

Fully autonomously QA engineer starts here. We will come up with a real name later.

## Starter Template

This project is scaffolded using [Next.js and Supabase Starter Kit](https://github.com/vercel/next.js/tree/canary/examples/with-supabase)

### Template Features

- Works across the entire [Next.js](https://nextjs.org) stack
  - App Router
  - Pages Router
  - Middleware
  - Client
  - Server
  - It just works!
- supabase-ssr. A package to configure Supabase Auth to use cookies
- Styling with [Tailwind CSS](https://tailwindcss.com)
- Components with [shadcn/ui](https://ui.shadcn.com/)
- Optional deployment with [Supabase Vercel Integration and Vercel deploy](#deploy-your-own)
  - Environment variables automatically assigned to Vercel project

## How to run

1. Sign up for supabase account, we use it for authentication and postgres database.

2. Use [nvm](https://github.com/nvm-sh/nvm) to install node latest LTS version of node.js.

3. Rename `.env.example` to `.env` and update the following:

   ```
   NEXT_PUBLIC_SUPABASE_URL=[INSERT SUPABASE PROJECT URL]
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[INSERT SUPABASE PROJECT API ANON KEY]
   ```

   Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` can be found in [your Supabase project's API settings](https://app.supabase.com/project/_/settings/api)

4. (New Step!) Add the `DATABASE_URL` and `DIRECT_URL` connection strings from Supabase (Dashboard --> Database --> Connect --> ORM: Prisma) and don't forget to change the `[YOUR-PASSWORD]`! You must also use `.env` for your environment variables, not `.env.local`

```
# Connect to Supabase via connection pooling
DATABASE_URL="postgresql://postgres.projectABC:[YOUR-PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection to the database. Used for migrations
DIRECT_URL="postgresql://postgres.projectABC:[YOUR-PASSWORD]@aws-0-us-east-2.pooler.supabase.com:5432/postgres"
```

5. You can now run the Next.js local development server:

   ```bash
   npm run dev
   ```

   The app should now be running on [localhost:3000](http://localhost:3000/).

## Notes

If want to run supabase locally, try

> Check out [the docs for Local Development](https://supabase.com/docs/guides/getting-started/local-development) to also run Supabase locally.

# Prisma Instructions

## Before First Run

Generate prisma local files.
`npx prisma generate`

## To Run Migrations Locally

`npx prisma migrate dev`

## In Production

Use `npm run build` it will include `npx prisma migrate deploy` and `npx prisma generate`.
