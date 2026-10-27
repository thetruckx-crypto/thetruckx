# NECL Seed Data

This directory contains seed data files for **LOCAL DEVELOPMENT ONLY**.

## ⚠️ WARNING

**NEVER run these seed files against production or staging environments!**

These files contain sample/mock data for development and testing purposes.

## Files

- `dev_sample_data.sql` - Sample clients, vendors, vehicles, drivers, and bookings

## Usage

### Local Development

To seed your local Supabase instance:

```bash
# Using Supabase CLI (if using local setup)
supabase db reset

# Or manually with psql
psql postgresql://postgres:postgres@localhost:54322/postgres -f database/seeds/dev_sample_data.sql
```

### Production/Staging

**DO NOT** run seed files in production. Production data should come from:
- Real user registrations
- Admin portal data entry
- Data migration scripts (separate from seed data)

## Schema vs Seed

- **Schema** (`database/migrations/*.sql`) - Table definitions, constraints, indexes, RLS policies
- **Seed** (`database/seeds/*.sql`) - Sample data for development/testing only

Schema migrations are automatically applied to all environments.
Seed data must be manually loaded and only in development.
