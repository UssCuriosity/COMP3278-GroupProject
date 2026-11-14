# COMP3278 Group Project - Lantern Stays

A short-stay booking web app (in the spirit of Airbnb) backed by MySQL: guests search, book, change, cancel and review stays; hosts manage their listings. A built-in SQL inspector shows the SQL behind listing and booking operations.

This repository contains two implementations of the same app, with the same core database design and hand-written SQL in both versions:

| Folder | Stack | Needs | Start here |
| --- | --- | --- | --- |
| [`lantern-stays-v2/`](lantern-stays-v2/) | TypeScript, Fastify, React (Vite), MySQL; automated tests | Node.js 22.12+ on Node 22, Node 24, or Node 26+, MySQL 8.0+ | [README](lantern-stays-v2/README.md) |
| [`lantern-stays/`](lantern-stays/) | JavaScript, Express, plain HTML/CSS/JS, MySQL; no build step | Node.js 18+, MySQL 8.0+ | [README](lantern-stays/README.md) |

Each folder is self-contained. To run one, open its README and follow the steps (`npm install`, create `.env`, `npm run db:setup`, `npm start`).

The default database is `lantern_stays_v2` for v2 and `lantern_stays` for Express. Use distinct `DB_NAME` values if you customize them. To reset either demo, stop that app and run `npm run db:setup -- --reset` in its folder.

If you already ran v2 with `DB_NAME=lantern_stays`, keep that setting to open your existing data and give Express a different database name.

## Database

- ER diagram: [`lantern-stays-v2/docs/er-diagram.png`](lantern-stays-v2/docs/er-diagram.png)
- Schema and initial data: [`lantern-stays-v2/db/schema.sql`](lantern-stays-v2/db/schema.sql), [`lantern-stays-v2/db/seed.sql`](lantern-stays-v2/db/seed.sql)
- Key SQL statements explained: [`lantern-stays-v2/docs/key-sql.md`](lantern-stays-v2/docs/key-sql.md)

![ER diagram](lantern-stays-v2/docs/er-diagram.png)
