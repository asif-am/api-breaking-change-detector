# API Breaking Change Detector

The application compares two OpenAPI 3.x specifications, classifies every difference as **breaking**,
**potentially breaking** or **non-breaking**, and produces a report with totals, old/new definitions,
impact, migration guidance and a machine-readable CI verdict.

---

## 1. What it does

1. Accepts a baseline and a candidate specification (upload, paste, or HTTP request).
2. Validates both against the supported OpenAPI structure and reports exact issues.
3. Resolves local `$ref`s, merges `allOf`, keeps `oneOf`/`anyOf` variants and builds one canonical model.
4. Compares endpoints, methods, parameters, request/response schemas, properties, requiredness, data types,
   enums, constraints, status codes and JSON content types.
5. Applies a deterministic rule table to classify and prioritise each change.
6. Renders a web report, downloads JSON, and returns a CI result with an exit code.
7. Optionally stores projects, specifications and comparison history for the signed-in user.

Sample result for the bundled pair (`server/samples/baseline.json` → `candidate.json`):
**53 changes — 27 breaking, 5 potentially breaking, 21 non-breaking, verdict `FAIL`.**

---

## 2. Technology stack

The project follows the MERN stack and the conventions of the Apna College web development course: an MVC
Express backend, Passport session authentication, Joi validation and a React client.

| Layer | Packages | Used for |
| --- | --- | --- |
| Backend | `express` | HTTP API, routing, middleware |
| | `mongoose` | MongoDB models for users, projects, specs, comparisons |
| | `dotenv` | environment configuration |
| | `cors` | credentialed requests from the Vite dev server |
| | `express-rate-limit` | throttling for authentication and comparison endpoints |
| | `passport`, `passport-local`, `passport-local-mongoose` | email + password authentication |
| | `express-session`, `connect-mongo` | server-side session stored in MongoDB |
| | `connect-flash` | one-time flash messages |
| | `joi` | request validation in `schema.js` |
| | `multer` | in-memory `.json` specification uploads |
| | `nodemon` (dev) | server restart on change |
| Frontend | `react`, `react-dom` | UI |
| | `react-router-dom` | client-side routing |
| | `axios` | API calls |
| | `react-hot-toast` | success/error notifications |
| | `tailwindcss`, `postcss`, `autoprefixer` | styling |
| | `vite`, `@vitejs/plugin-react` (dev) | dev server and build |
| Tooling | `concurrently` (dev, root) | run server + client with one command |

The comparison engine itself has **no runtime dependency** — it is plain JavaScript modules, which keeps the
"compare two documents" logic portable and testable in isolation.

---

## 3. Getting started

### Requirements

- Node.js 18 or newer (developed on Node 24) and npm.
- MongoDB is required for accounts, sessions, projects and comparison history. Without it the comparison
  endpoints still work and `GET /api/health` reports `persistence: "memory"`.

### Install

```bash
npm run install:all
```

### Configure

`server/.env` is not committed — it is excluded by `.gitignore`. Create it from the template:

```bash
cp server/.env.example server/.env
```

Then replace `SESSION_SECRET` with a long random string, and set `DEMO_PASSWORD` if you intend to run the seed.
Variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `SESSION_SECRET` | signing secret for the session cookie (replace before deploying) |
| `CLIENT_URL` | Vite origin allowed by CORS |
| `NODE_ENV` | `development` or `production` |
| `DEMO_PASSWORD` | password given to the seeded demo account (used only by `npm run seed`) |

### Run in development

```bash
npm run dev
```

- Vite client: <http://localhost:5173> (proxies `/api` to the server)
- API: <http://localhost:5000/api/health>

### Run the production build

```bash
npm run build
npm start
```

Express serves `client/dist` and the API from <http://localhost:5000>.

### Tests

```bash
npm test
```

Runs the engine acceptance tests (`node --test`) covering AC-01 → AC-12, including determinism.

### Seed the demo account

Set `DEMO_PASSWORD` in `server/.env` to the password you want the demo account to have — the template
placeholder is rejected — then run:

```bash
npm run seed
```

Creates the demo account (`demo@example.com`) with the sample project and one saved comparison. The password is
whatever you set in `DEMO_PASSWORD`; nothing is generated and nothing is stored in this repository. Because
`server/.env` is gitignored, that file is the only place the demo password exists locally, so use the same value
to sign in. Pick a password you will remember when you create the file.

### Regenerate the rule catalogue

```bash
npm run docs:rules
```

---

## 4. Demonstration in one minute

1. Open the home page and press **Load sample pair** (or upload `server/samples/*.json`).
2. Press **Run comparison**.
3. In the report: the verdict is `FAIL`, totals are 27 breaking / 5 potentially breaking / 21 non-breaking.
4. Expand `Accepted enum value removed` on `GET /orders` to show old/new definitions, impact and migration.
5. Filter by **Breaking** and open the migration guide at the bottom.
6. Create an account, create a project, upload the same two files, run the comparison and open it from
   **Comparison history**.
7. Open **Docs** to show the 63-rule catalogue and the HTTP API reference.

The full viva script, including the CI demonstration, is in [`docs/DEMO.md`](docs/DEMO.md).

---

## 5. Project structure

```
.
├── client/                  React + Vite + Tailwind front end
│   └── src/
│       ├── api/             axios instance
│       ├── components/      navbar, spec inputs, report, change cards, badges
│       ├── context/         AuthContext
│       ├── pages/           compare, report, projects, auth, docs
│       └── utils/           formatting, downloads
├── server/
│   ├── app.js               express app, session, passport, routes, listener
│   ├── middleware.js        isLoggedIn, validate, upload, error handler
│   ├── schema.js            Joi request schemas
│   ├── config/database.js   mongoose connection
│   ├── controllers/         auth.js, project.js, comparison.js
│   ├── data/store.js        repository (MongoDB / in-memory adapters)
│   ├── engine/              comparison engine
│   │   ├── parser.js        validation
│   │   ├── refResolver.js   local $ref resolution + circular handling
│   │   ├── normalizer.js    canonical operation model
│   │   ├── comparators/     operation and schema comparison
│   │   ├── rules.js         deterministic rule table (63 rules)
│   │   ├── explain.js       change decoration (explanation, impact, migration)
│   │   ├── report.js        summary, CI verdict, digest
│   │   └── index.js         compareSpecifications / validateSpecification
│   ├── init/index.js        seed script (demo account + project)
│   ├── models/              user.js, project.js, specification.js, comparison.js
│   ├── routes/              auth.js, project.js, comparison.js, api.js
│   ├── samples/             demonstration specification pair
│   ├── scripts/             rule catalogue generator
│   └── tests/               acceptance tests
└── docs/                    design, rules, testing, demo script
```

---

## 6. Classification model

Compatibility is decided semantically, not by text comparison. Direction matters:

| Direction | Safe | Breaking |
| --- | --- | --- |
| **Request** (what the server accepts) | Widening: optional parameter added, enum value added, constraint relaxed, `integer` → `number` | Narrowing: required parameter added, enum value removed, tighter bounds, `number` → `integer`, `null` disallowed |
| **Response** (what the server returns) | Narrowing: property removed from the documented set? see rules, enum value removed, `number` → `integer` | Widening: response property removed, enum value added, type widened, new `oneOf` variant, status code removed |

Each rule is documented with its id, code, classification, severity and title in
[`docs/RULES.md`](docs/RULES.md) (generated from `server/engine/rules.js`).

Determinism (AC-12): traversal order is sorted, JSON is serialised with stable keys, and the report carries a
SHA-256 `meta.deterministic.resultDigest` computed from the changes. Timestamps and durations live only in
`meta.run`, so two runs over the same inputs and options produce the same digest.

---

## 7. HTTP API

Public:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | engine version and active persistence mode |
| GET | `/api/rules` | rule catalogue |
| GET | `/api/samples` | bundled demonstration pair |
| POST | `/api/validate` | validate one document |
| POST | `/api/compare` | compare two JSON documents |
| POST | `/api/compare/files` | compare two uploaded `.json` files |

Session (Passport, httpOnly cookie):

`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`,
`POST /api/auth/forgot-password`, `POST /api/auth/reset-password`,
`GET|POST /api/projects`, `GET|DELETE /api/projects/:id`, `POST /api/projects/:id/specs`,
`GET|POST /api/projects/:id/comparisons`, `GET|DELETE /api/comparisons/:id`.

### Password reset

**Forgot password?** on the sign-in page starts a token-based reset: `POST /api/auth/forgot-password` issues a
single-use token valid for 30 minutes, and `POST /api/auth/reset-password` consumes it and stores only its
SHA-256 hash. The response is identical whether or not the email has an account, so the endpoint cannot be used
to discover registered addresses.

The project has no mail provider, so while `NODE_ENV` is not `production` the response also carries
`data.resetToken` and `data.resetUrl` and the UI shows a **Continue to set a new password** button. In production
that block is omitted and the link must be delivered by email — wire a provider in `forgotPassword` in
`server/controllers/auth.js` (one function, no other changes).

Example CI call:

```bash
node -e "
  const fs = require('fs');
  fs.writeFileSync('compare-body.json', JSON.stringify({
    baseline: JSON.parse(fs.readFileSync('server/samples/baseline.json', 'utf8')),
    candidate: JSON.parse(fs.readFileSync('server/samples/candidate.json', 'utf8'))
  }));
"

curl -X POST http://localhost:5000/api/compare \
  -H "Content-Type: application/json" \
  --data-binary @compare-body.json

rm compare-body.json
```

The same call works in Git Bash on Windows, where process substitution (`<(...)`) is unreliable.

The response contains `data` (full report), `ci` (`hasBreaking`, `exitCode`, `resultDigest`) and `verdict`.
A pipeline fails the build when `verdict.exitCode` is `1`.

---

## 8. Software Engineering artefacts

| Artefact | Location |
| --- | --- |
| SRS (reference) | provided with the project submission |
| Design document | [`docs/DESIGN.md`](docs/DESIGN.md) |
| Rule catalogue | [`docs/RULES.md`](docs/RULES.md) |
| Test plan and acceptance mapping | [`docs/TESTING.md`](docs/TESTING.md) |
| Demonstration script | [`docs/DEMO.md`](docs/DEMO.md) |

---

## 9. Known limitations (and why they are out of scope)

Aligned with BR-01, BR-04 and BR-07:

- **JSON-only input.** YAML is rejected with a clear message; a YAML adapter is an extension point (NFR-08).
- **Swagger 2.0 is not supported.** It is reported as an unsupported format rather than silently converted.
- **External `$ref` documents are not fetched.** They are compared by reference name and reported as a warning
  so that results stay deterministic and the server performs no outbound requests.
- **`oneOf`/`anyOf` variants are paired by a stable sort key**, not by discriminator semantics. This is a
  documented heuristic that keeps results deterministic.
- **Impact analysis is per change**, not per consumer: the system does not invent a consumer inventory
  (BR-04).
- **No AI integration.** BR-07 lists it as an extensibility goal, not a dependency.

---

## 10. Security notes

- Passwords are hashed by passport-local-mongoose (salted hash per user); the session is an httpOnly, SameSite=Lax cookie stored in MongoDB.
- Password-reset tokens are 256-bit random values stored only as SHA-256 hashes, expire after 30 minutes and are
  cleared on use, so a reset link cannot be replayed. Reset responses do not reveal whether an account exists.
- Every project, specification and comparison read is scoped to the owner id taken from the authenticated session.
- Uploads are limited to 5 MB, accepted only as JSON, and held in memory (never written to disk).
- JSON request bodies are limited to 8 MB; malformed and oversized bodies return 400/413 instead of 500.
- `POST /api/auth/*` is rate limited to 20 requests per 15 minutes per IP, and the public comparison
  endpoints to 30 requests per minute per IP.
- Responses carry `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and a
  Content-Security-Policy; HSTS is added when `NODE_ENV=production`.
- A generated report larger than 12 MB is rejected before storage, because MongoDB documents cap at 16 MB.
- When `NODE_ENV=production` the server refuses to start without `SESSION_SECRET`.
- Input is validated structurally with JSON paths; React escapes rendered content (no `dangerouslySetInnerHTML`).
- Set a strong `SESSION_SECRET` and `NODE_ENV=production` before deploying.
