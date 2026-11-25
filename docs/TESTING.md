# Test plan and verification record

Project: API Breaking Change Detector · Software Engineering Lab (CSMC502)
Reference: SRS sections 4, 5 and 8.

---

## 1. Strategy

| Level | What is verified | Where |
| --- | --- | --- |
| Engine acceptance tests | Parsing, validation, every comparator family, rule output, totals, CI verdict, determinism | `server/tests/engine.test.js` (`npm test`) |
| API tests (manual) | Validation responses, comparison endpoint, CI envelope, auth, ownership | Section 4 of this document |
| UI tests (manual) | Upload/paste, report rendering, filters, project flow, history | Section 5 of this document |
| Build check | Production client build and Express static serving | `npm run build` + `npm start` |

Automated tests use the sample pair in `server/samples/`. Run:

```bash
npm test
```

---

## 2. Automated test cases (acceptance criteria)

| Test | AC | Scenario | Expected result |
| --- | --- | --- | --- |
| `AC-01: valid specifications are accepted and compared` | AC-01 | Baseline 1.4.0 vs candidate 2.0.0 | Report with metadata, operations > 0, changes > 0 |
| `AC-02: invalid or unsupported specifications are rejected with issues` | AC-02 | Missing `openapi`, Swagger 2.0, YAML text, invalid status key | `valid: false` with the specific issue codes; comparison throws |
| `AC-03: added, removed and modified endpoints and methods` | AC-03 | Remove `/customers`, remove `DELETE /orders/{orderId}`, add `/invoices` | `endpoint-removed`, `method-removed`, `endpoint-added`; endpoint lists updated |
| `AC-04: parameter changes are detected` | AC-04 | `limit` becomes required, `page` removed, `tenant` added, `status` moved to header | `parameter-required-added` (breaking), `parameter-removed`, `parameter-added-optional`, `parameter-location-changed` |
| `AC-05: request/response schema and status codes` | AC-05 | Remove `Order.legacyId`, remove `400` response, `OrderInput.additionalProperties=false` + remove `legacyRef` | `response-property-removed`, `response-removed`, `request-property-removed-strict` |
| `AC-06: incompatible types and enums` | AC-06 | `Order.total` number → string, enum value swap | `response-type-changed` (breaking/high), request enum removed/added, response enum added/removed |
| `AC-06: direction-aware widening` | AC-06 | `OrderItem.quantity` integer → number | `request-type-widened` non-breaking, `response-type-widened` breaking |
| `AC-07: references and composite schemas` | AC-07 | Sample pair (shared `$ref`, circular `Customer`, `oneOf` payments) | Nested changes under shared schemas, `request-oneof-variant-added`, no `schema-reference-changed` for the circular ref, no hang |
| `AC-08: complete change records` | AC-08 | Sample pair | Every change has id, ruleId, classification, severity, path, explanation, impact, migration, oldValue, newValue |
| `AC-09: totals and migration guide` | AC-09 | Sample pair | `total = breaking + potentially + non-breaking`; migration steps count equals breaking count |
| `AC-10: CI verdict` | AC-10 | Sample pair, then a compatible-only change | `FAIL`/exit 1 with breaking changes; `PASS`/exit 0 without |
| `AC-12: determinism` | AC-12 | Two runs of the sample pair; then identical documents | Equal digests and change ids; identical documents produce 0 changes |
| `options filtering` | FR-01/BR-05 | `ignorePaths: ['/customers']`, `includeNonBreaking: false` | No changes on ignored paths; no non-breaking changes |
| `validation warnings` | AC-02/AC-13 | Remove `info.title` | Valid document with a `missing-info-title` warning, operation count 7 |

Expected sample summary: **53 changes — 27 breaking, 5 potentially breaking, 21 non-breaking** (the exact
numbers are asserted indirectly through the consistency checks, so the suite keeps passing when the sample
pair is extended).

---

## 3. Traceability — requirement → design → test

| Requirement | Design element | Test |
| --- | --- | --- |
| FR-01, FR-02 | `parser.js`, `validateSpecification` | AC-01, AC-02 |
| FR-03 | `normalizer.js` | AC-01, AC-07 |
| FR-04, FR-05 | `comparators/operations.js` (path/method matching) | AC-03 |
| FR-06 | `comparators/operations.js` + `schema.js` | AC-04 |
| FR-07, FR-08, FR-09 | `schema.js`, `compareResponses` | AC-05 |
| FR-10, FR-11 | `compareTypes`, `compareEnums` | AC-06 |
| FR-12, FR-13 | `refResolver.js`, `flatten`, `compareVariants` | AC-07 |
| FR-14 | `isJsonMediaType`, content-type comparison | AC-07, manual MT-05 |
| FR-15, FR-16 | `rules.js` | AC-08 |
| FR-17, FR-18, FR-19 | `rules.js` impact/migration + `explain.js` | AC-08, AC-09 |
| FR-20, FR-21 | `report.js` | AC-09 |
| FR-22 | `report.ci`, `report.verdict`, `/api/compare` | AC-10 |
| FR-23, FR-24 | `data/store.js`, project routes | MT-09 |
| NFR-01 | single normalisation pass, `meta.run.durationMs` | Observation during demonstration |
| NFR-02, AC-12 | sorted traversal + digest | AC-12 |
| NFR-03 | rule semantics | AC-06 (both directions) |
| NFR-05 | module layout | Design document section 2 |
| NFR-06, AC-13 | Joi validation, passport hashing, httpOnly session cookie, ownership, upload limits | AC-02, MT-08 |

---

## 4. Manual API test cases

Start the server (`npm start` or `npm run dev`). `BASE=http://localhost:5000`.

### MT-01 — health and persistence mode

```bash
curl -s $BASE/api/health
```

Expected: `success: true`, `engineVersion`, `persistence: "mongodb"` or `"memory"`, `status: "ok"`.

### MT-02 — validation failure is explained

```bash
curl -s -X POST $BASE/api/validate -H "Content-Type: application/json" \
  -d '{"specification":{"openapi":"3.0.3","paths":{"pets":{"get":{}}}}}'
```

Expected: HTTP 422, `data.valid: false`, issue `invalid-path` for `paths.pets` and issue
`missing-responses` for `GET /pets` (the operation has no responses).

### MT-03 — successful comparison + CI envelope

```bash
curl -s -X POST $BASE/api/compare -H "Content-Type: application/json" \
  -d "{\"baseline\": $(cat server/samples/baseline.json), \"candidate\": $(cat server/samples/candidate.json)}"
```

Expected: `success: true`, `data.summary.breaking > 0`, `verdict.status: "FAIL"`,
`verdict.exitCode: 1`, `ci.resultDigest` present, `data.migrationGuide` non-empty.

### MT-04 — filtering options

Add `"options": {"ignorePaths":["/customers"],"includeNonBreaking":false}` to MT-03.

Expected: no change with `path` beginning `/customers`; `summary.nonBreaking` is 0.

### MT-05 — non-JSON content types are compared at content-type level

Compare two documents where `GET /customers` returns `application/vnd.api+json` instead of
`application/json` (sample pair).

Expected: `response-content-type-removed` (breaking) and `response-content-type-added` (non-breaking); no deep
schema changes are reported for the removed non-JSON representation.

### MT-06 — unsupported format

```bash
curl -s -X POST $BASE/api/compare -H "Content-Type: application/json" \
  -d '{"baseline":{"swagger":"2.0","paths":{}},"candidate":{"openapi":"3.0.3","paths":{}}}'
```

Expected: HTTP 422, issue `unsupported-swagger-2`.

### MT-07 — authentication

```bash
curl -s -c cookies.txt -X POST $BASE/api/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Demo User","email":"demo@example.com","password":"<choose-a-password>"}'
curl -s -b cookies.txt $BASE/api/auth/me
curl -s -X POST $BASE/api/auth/logout -b cookies.txt
curl -s $BASE/api/projects
```

Expected: registration 201 with the user and a session cookie; `/me` returns the user; logout destroys the
session; the last call returns 401.

### MT-08 — ownership isolation

Register a second account in a separate cookie jar, then request the first user's project id.

Expected: 404 `Project not found` — existence is not disclosed and no data leaks.

### MT-09 — project and comparison history (AC-11)

```bash
# with the first user's cookie jar
curl -s -b cookies.txt -X POST $BASE/api/projects -H "Content-Type: application/json" \
  -d '{"name":"Acme Orders","description":"v2 review"}'

curl -s -b cookies.txt -X POST $BASE/api/projects/<PROJECT_ID>/specs \
  -F "role=baseline" -F "file=@server/samples/baseline.json"

curl -s -b cookies.txt -X POST $BASE/api/projects/<PROJECT_ID>/specs \
  -F "role=candidate" -F "file=@server/samples/candidate.json"

curl -s -b cookies.txt -X POST $BASE/api/projects/<PROJECT_ID>/comparisons \
  -H "Content-Type: application/json" -d '{}'

curl -s -b cookies.txt $BASE/api/projects/<PROJECT_ID>
```

Expected: project created; both specifications stored with versions/operation counts; comparison created with
summary and digest; project detail lists the saved comparison. Restarting the server with MongoDB available
keeps the data.

### MT-10 — upload guard

Upload a `.txt` file or a file larger than 5 MB to the specs endpoint.

Expected: 400 with a multer/upload message; server keeps running.

### MT-11 — password reset (development delivery)

```bash
curl -s -X POST $BASE/api/auth/forgot-password -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com"}'
# copy data.resetToken from the response

curl -s -X POST $BASE/api/auth/reset-password -H "Content-Type: application/json" \
  -d '{"token":"<TOKEN>","password":"<new-password>"}'
```

Expected: the first call returns 200 with `data.resetToken` and `data.resetUrl` (`NODE_ENV` not `production`);
the second returns 200 and the new password signs in. Replaying the same token returns 400, an unknown email
returns the same generic message without `data`, and an expired token returns 400.

---

## 5. Manual UI test cases

| ID | Steps | Expected |
| --- | --- | --- |
| UI-01 | Open `/`, press **Load sample pair**, press **Run comparison** | Busy state, then report page with verdict `FAIL` and four summary cards |
| UI-02 | Expand any change card | Baseline/candidate definitions, explanation, impact and migration visible |
| UI-03 | Filter classification to **Breaking** | Only breaking changes listed; count text updates |
| UI-04 | Search `legacyId` | Matching change(s) only |
| UI-05 | Press **Download JSON** | A report `.json` file downloads and matches the displayed summary |
| UI-06 | Press **Copy CI summary** | Clipboard contains verdict, counts, exit code and digest |
| UI-07 | Paste one invalid document and compare | Red validation panel with issue codes; report is not generated |
| UI-08 | Register, create a project, upload both sample files | Specification cards show version, OpenAPI version, operations and size |
| UI-09 | Run comparison from the project | Saved report opens, and appears in comparison history |
| UI-10 | Open `/docs` | Requirement tables and the rule catalogue render (catalogue needs the API running) |
| UI-11 | Resize to a narrow viewport | Tables scroll horizontally; layout remains usable |
| UI-12 | Sign-in → **Forgot password?** → enter the demo email → **Continue to set a new password** → set it → sign in | Reset page accepts the link once, the new password signs in, the old one is rejected |

---

## 6. Results log (filled during the demonstration)

| Date | Build | Automated tests | Build check | Notes |
| --- | --- | --- | --- | --- |
| 2026-11-17 | Node 24 · Express 4 · MongoDB 8.3 | `npm test` — 14/14 pass | `npm run build` — 116 modules, Vite 5.4 | Sample pair: 53 changes (27 breaking / 5 potentially / 21 non-breaking), digest `3f8c6f22b4fb…`; register → project → upload → compare → history verified; unauthenticated `/api/projects` = 401; foreign project = 404; Swagger 2.0 upload = 422 with `unsupported-swagger-2` |
