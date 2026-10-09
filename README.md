# GhostPost 👻

A dark, purple-themed anonymous social feed built with React, Vite and Supabase.

## What is included
- Responsive mobile and desktop UI
- Latest and trending feed tabs
- Anonymous sign-in and Google sign-in entry points
- Photo/video upload UI (up to 50 MB per file with the supplied bucket setup)
- Likes and report submission
- Admin room for reviewing reports and removing posts
- Supabase schema with row-level security policies and a database-backed admin role
- Demo posts so the UI can be previewed before connecting a backend

## Important status
This is a starter implementation, not yet a live website. Supabase setup is required for publishing, uploads, reporting and admin functions. Comments UI and account-management tools are not implemented yet. Do not advertise this as a fully moderated production platform until the remaining features and safety checks are completed.

## Run locally
Install Node.js LTS, then in this folder:

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, `Copy-Item .env.example .env` can be used instead of `cp`.
Open the local address Vite prints, usually `http://localhost:5173`.

## Connect Supabase
1. Create a project at https://supabase.com.
2. Open Project Settings / API and copy the Project URL and publishable/anon key.
3. Put them in `.env`:
   - `VITE_SUPABASE_URL=...`
   - `VITE_SUPABASE_ANON_KEY=...`
4. In Supabase SQL Editor, run all of `supabase/schema.sql`.
5. In Authentication settings, enable Anonymous sign-ins.
6. Enable Google under Authentication > Sign In / Providers and configure its OAuth client in Google Cloud. Add your local and deployed URLs to the allowed redirect URLs.
7. In Storage settings, verify `post-media` bucket exists and confirm file size/MIME limits.

## Make the specified Google account an admin
1. Sign in once with `uyiosaeguagie85@gmail.com` using the Google button in GhostPost.
2. In Supabase Dashboard > Authentication > Users, locate that exact email and copy its user UUID.
3. In SQL Editor, run this with the UUID from your own dashboard:

```sql
insert into public.app_admins (user_id)
values ('PASTE_AUTH_USER_UUID_HERE')
on conflict (user_id) do nothing;
```

4. Sign out and sign in again, then open Admin room. The app checks the `app_admins` table; changing browser UI cannot grant admin access.

Do not use email text in the frontend as the source of truth for admin access. Never expose the Supabase service-role key or Google OAuth client secret in frontend code or GitHub.

## Upload to GitHub
Create a repository named `ghostpost`, then upload the contents of this folder (not the folder wrapper itself). Do not commit `.env`; `.gitignore` excludes it.

## Deploy to Vercel
1. Import the `ghostpost` GitHub repository into Vercel.
2. Framework preset: Vite; build command `npm run build`; output directory `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project environment variables.
4. Deploy, then add the deployed domain to Supabase Authentication URL configuration and Google OAuth redirect URIs.
5. Test anonymous posting, uploads, reporting, sign-in, admin access and RLS behavior before sharing widely.

## Current limitations to fix before production
- Comments are a placeholder in this first version.
- Likes currently use a simple counter and should be replaced with per-user like records to prevent repeated likes.
- The feed's public author label is pseudonymous; do not promise perfect anonymity because service operators may still process technical metadata.
- Add moderation/rate limiting, storage abuse protection, account controls and a privacy policy before public launch.
