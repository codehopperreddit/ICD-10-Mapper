# D1 migrations

Apply with:

```bash
wrangler d1 migrations apply icd-mapper             # production
wrangler d1 migrations apply icd-mapper --local     # local dev
wrangler d1 migrations apply icd-mapper-staging --env staging
```

Each new schema change should be a new file with the next sequential prefix
(e.g. `0002_add_org_table.sql`). Wrangler tracks applied migrations in a
`d1_migrations` table inside the database itself.
