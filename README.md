# Isle Thrift (Maldives) — Production Starter

This repository contains a production-ready starter for:

- Cloudflare Pages frontend (`frontend/`)
- Cloudflare Workers API (`worker/`)
- Cloudflare D1 schema and migrations
- Cloudflare R2 photo storage
- Listings, favorites, chat polling, transactions, reviews, and Cowry Shell reputation

## 1) Cloudflare setup

1. Create D1 database: `isle_thrift`
2. Create R2 bucket: `isle-thrift-photos`
3. In `worker/wrangler.toml`, replace `database_id`
4. Set Worker secret:
   - `wrangler secret put JWT_SECRET`

## 2) Run migrations

```bash
cd worker
npm install
npm run d1:migrate
```

## 3) Deploy worker

```bash
npm run deploy
```

## 4) Frontend wiring

- Set your API base URL in frontend (where `ApiClient` is initialized)
- Deploy frontend to Cloudflare Pages

## Safety/Product Notes

- Platform is advertising-only.
- Payment handled directly between users (bank transfer).
- Advise safe public meetups and no OTP sharing.
