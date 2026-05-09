# ICD Mapper

A B2B SaaS that maps free-text diagnoses (single queries or bulk CSVs) to
ICD-10-CM codes using SQLite FTS5 fuzzy search.

Deployed entirely on Cloudflare:

| Layer       | Service                           |
| ----------- | --------------------------------- |
| Frontend    | Next.js 14 on Cloudflare Pages    |
| API         | Cloudflare Workers (Hono.js)      |
| Database    | Cloudflare D1 (SQLite + FTS5)     |
| Storage     | Cloudflare R2                     |
| Cache / RL  | Cloudflare KV                     |
| Auth        | Clerk (edge-compatible)           |
| Payments    | Paddle (USD) + Razorpay (INR)     |

## Project layout

```
.
├── apps/
│   ├── web/            Next.js 14 (Cloudflare Pages, edge runtime)
│   └── api/            Cloudflare Worker (Hono.js)
├── packages/
│   └── shared/         Shared TS types and helpers
├── data/               (Optional) downloaded CMS ICD-10-CM flat files
└── wrangler.toml       Worker config (D1 / KV / R2 bindings)
```

## Quick start

```bash
pnpm install

# 1. Provision Cloudflare resources (one-time)
wrangler d1 create icd-mapper
wrangler kv namespace create CACHE
wrangler r2 bucket create icd-mapper-storage
# paste IDs into wrangler.toml

# 2. Apply schema
pnpm db:migrate

# 3. Seed ICD-10-CM 2024 codes
#    Drop the CMS flat file at data/raw/icd10cm-codes-2024.txt
pnpm db:seed

# 4. Set Worker secrets
wrangler secret put CLERK_SECRET_KEY
wrangler secret put PADDLE_API_KEY
wrangler secret put PADDLE_WEBHOOK_SECRET
wrangler secret put RAZORPAY_KEY_ID
wrangler secret put RAZORPAY_KEY_SECRET

# 5. Local dev
pnpm dev:api    # http://localhost:8787
pnpm dev:web    # http://localhost:3000

# 6. Deploy
pnpm deploy:api
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
