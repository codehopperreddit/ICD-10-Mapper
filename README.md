# ICD Mapper

A B2B SaaS that maps free-text diagnoses (single queries or bulk CSVs) to
ICD-10-CM codes using SQLite FTS5 fuzzy search.

Deployed entirely on Cloudflare:

| Layer       | Service                                          |
| ----------- | ------------------------------------------------ |
| Frontend    | Next.js 14 on Cloudflare Pages                   |
| API         | Next.js route handlers on Cloudflare Pages (edge)|
| Database    | Cloudflare D1 (SQLite + FTS5)                    |
| Storage     | Cloudflare R2                     |
| Cache / RL  | Cloudflare KV                     |
| Auth        | Clerk (edge-compatible)           |
| Payments    | Paddle (USD) + Razorpay (INR)     |

## Project layout

```
.
├── apps/
│   └── web/            Next.js 14 on Cloudflare Pages — the single deployment.
│       ├── src/app/api/      API route handlers (search, bulk-map, keys, me, admin)
│       ├── src/app/webhooks/ Paddle / Razorpay webhooks
│       ├── src/lib/server/   Server-only lib (D1 search, ingest, auth, ...)
│       ├── migrations/       D1 schema migrations
│       └── wrangler.toml      Pages config (D1 / KV / R2 bindings)
└── packages/
    └── shared/         Shared TS types and helpers
```

## Quick start

```bash
pnpm install

# 1. Provision Cloudflare resources (one-time) and paste the IDs into
#    apps/web/wrangler.toml ([[d1_databases]] / [[kv_namespaces]] / [[r2_buckets]]).
wrangler d1 create icd-mapper
wrangler kv namespace create CACHE
wrangler r2 bucket create icd-mapper-storage

# 2. Apply the D1 schema
pnpm db:migrate            # --remote ; pnpm db:migrate:local for local

# 3. Load the ICD-10-CM mappings
#    Upload the CMS "ICD-10-CM Codes, ESRD, CMS-HCC and RxHCC Models" CSV to
#    R2 under data/raw/, then (signed in as an ADMIN_EMAILS user) trigger:
#       POST /api/admin/ingest
#    from the dashboard. No cron — ingestion is admin-triggered.

# 4. Set Pages secrets (Cloudflare dashboard or `wrangler pages secret put`)
#    CLERK_SECRET_KEY  PADDLE_WEBHOOK_SECRET  RAZORPAY_KEY_SECRET
#    Set the admin allowlist via ADMIN_EMAILS in apps/web/wrangler.toml.

# 5. Local dev
pnpm dev:web    # http://localhost:3000

# 6. Deploy (single Pages project)
pnpm deploy:web
```

## Pricing tiers

| Tier | Price       | Daily req limit |
| ---- | ----------- | --------------- |
| Free | $0          | 50              |
| Pro  | $49 / mo    | 5,000           |
| API  | $99 / mo    | 10,000          |

## License

UNLICENSED — proprietary.
