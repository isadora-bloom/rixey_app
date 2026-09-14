# Historical Migrations

These files were applied manually before the numbered migration system (`001_*.sql`, `002_*.sql`, etc.) existed. They are preserved here for reference but are not applied on deploy.

Many policies in these files were later replaced by newer migrations or dropped by hand; the canonical schema is the live Supabase project. The baseline is captured in `migrations/000_baseline.sql` (a dump of the live schema and RLS policies).

No code in the application references these files.
