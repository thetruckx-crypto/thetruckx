# Database Configuration

## Connection Parameters

* **Hosted Supabase Endpoint**: Configured via `SUPABASE_URL` and `VITE_SUPABASE_URL` in `.env`.
* **Public Key**: Configured via `SUPABASE_ANON_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`.
* **Local / PostgreSQL Direct URL**: `DATABASE_URL` in `.env`.

## Applying Migrations

### Via Supabase SQL Editor
Open the Supabase Dashboard, navigate to the **SQL Editor**, and execute the migration files sequentially from `database/migrations/`.

### Via Supabase CLI
```bash
# Apply migrations to remote Supabase project
supabase db push --workdir database/

# Reset and seed local database
supabase db reset
```
