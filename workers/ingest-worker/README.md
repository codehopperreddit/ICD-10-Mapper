# icd-mapper-ingest

Standalone Cloudflare Worker that loads the latest CMS **ICD-10-CM Codes, ESRD,
CMS-HCC and RxHCC Models** mappings CSV from R2 into D1. It is intentionally
separate from the client app (`apps/web`) and is meant to be deployed as its
**own** Cloudflare project.

It shares the same D1 database (`icd-mapper`) and R2 bucket
(`icd-mapper-storage`) as the client app.

## What it does

- Scans `STORAGE/<INGEST_R2_PREFIX>` (default `data/raw/`) for the most recently
  uploaded `*.csv` and loads it into `icd10_codes` + `icd10_hcc_mappings`.
- Skips when the file's etag matches the last completed import.
- Records every run in `icd_imports`.

## Endpoints

| Method | Path        | Auth        | Description                                  |
| ------ | ----------- | ----------- | -------------------------------------------- |
| GET    | `/`         | none        | Liveness + the file that would ingest next   |
| GET    | `/imports`  | admin token | Recent run history                           |
| POST   | `/ingest`   | admin token | Run the load now (`?force=1` to ignore etag) |

It also runs on a **cron** schedule (`0 4 * * *`, see `wrangler.toml`).

## Setup (as a separate project)

```bash
cd workers/ingest-worker
pnpm install            # or npm install
pnpm db:migrate         # apply schema to the shared D1 (idempotent)
wrangler secret put ADMIN_TOKEN
pnpm deploy
```

Trigger manually:

```bash
curl -X POST "https://icd-mapper-ingest.<subdomain>.workers.dev/ingest?force=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

The client app reads these tables for search; it does not write them.
