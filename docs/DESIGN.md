# Design document — API Breaking Change Detector

Reference: SRS, Software Engineering Lab (CSMC502). This document describes how the requirements are
realised, the module boundaries, the data model and the design decisions taken during detailed design.

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ React client (Vite + Tailwind)                                       │
│  Home (compare) · Report · Projects · Project detail · Saved report   │
│  Auth pages · Documentation page                                      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ axios, JSON / multipart, httpOnly cookie
┌───────────────────────────────▼──────────────────────────────────────┐
│ Express API                                                          │
│  routes → controllers → engine / repository                          │
│                                                                      │
│  engine (pure, side-effect free)                                     │
│   parser → refResolver → normalizer → comparators → rules → report    │
│                                                                      │
│  data/store.js  ── MongoDB adapter (mongoose)                        │
│                 └─ in-memory adapter (demo fallback)                 │
└──────────────────────────────────────────────────────────────────────┘
```

The engine has no Express, Mongoose or filesystem imports, so it can be unit tested, reused from a CLI, or
called by another service (NFR-05, NFR-08).

---

## 2. Module responsibilities

| Module | Responsibility | Requirements |
| --- | --- | --- |
| `engine/parser.js` | Accept object or JSON string, validate OpenAPI version, `paths`, operations, response keys; collect warnings for missing `info` or external refs. Throws `SpecificationError` with issues. | FR-01, FR-02, AC-01, AC-02 |
| `engine/refResolver.js` | Resolve local JSON pointers; replace circular references with `{ circularRef }` markers; never fetch external documents. | FR-12, BR-01 |
| `engine/normalizer.js` | Build one operation per `METHOD /path`: merged path/operation parameters, normalised request body and responses, sorted media types and schema names. | FR-03, FR-14 |
| `engine/comparators/operations.js` | Match operations by canonical path (placeholders normalised), report path-template renames, method changes, parameter changes, request bodies, content types, responses and status codes. | FR-04 → FR-09, FR-14, FR-18 |
| `engine/comparators/schema.js` | Recursive schema diff: types, nullable, enums, formats, constraints, `additionalProperties`, properties, requiredness, array items, `allOf` merge, `oneOf`/`anyOf` variants, circular markers. | FR-06 → FR-13 |
| `engine/rules.js` | Single source of classification, severity, title, impact and migration text. 63 rules with stable ids. | FR-15 → FR-17, FR-19, BR-02, BR-06 |
| `engine/explain.js` | Convert raw events into change records with location, old/new values, explanation; deterministic sort and ids. | FR-17, AC-08 |
| `engine/report.js` | Summary totals, severity/category breakdown, endpoint summary, migration guide, CI verdict, result digest, warnings. | FR-20 → FR-22, AC-09, AC-10, AC-12 |
| `engine/index.js` | `compareSpecifications`, `validateSpecification`, `ruleCatalog`; option normalisation and filtering. | FR-01, FR-02, FR-22 |
| `data/store.js` | Repository with two adapters; serialises storage documents into API-safe plain objects; enforces owner scoping. | FR-23, FR-24, NFR-06 |
| `controllers/auth.js` | Registration/login through Passport (`passport-local-mongoose`), session login/logout, profile. | EI-01, NFR-06 |
| `controllers/comparison.js` | Public validation/compare/compare-files/health/rules/samples endpoints and saved-comparison reads. | EI-02, EI-03, EI-07 |
| `controllers/project.js` | Project CRUD, specification upload, run + list project comparisons. | FR-23, FR-24, EI-06 |
| `routes/*.js` | Thin routers: auth, project, comparison, public API; guarded by `isLoggedIn`. | EI-01 → EI-07 |
| `schema.js` | Joi schemas for every JSON request body. | EI-01 → EI-07, NFR-06 |
| `middleware.js` | `isLoggedIn`, `validate(schema)`, multer memory upload, 404 and error envelope. | FR-01, NFR-06, AC-02 |

---

## 3. Processing sequence

```
compareSpecifications({baseline, candidate, options})
  ├─ parseSpecification(baseline, 'Baseline specification')     → SpecificationError on invalid
  ├─ parseSpecification(candidate, 'Candidate specification')
  ├─ normalizeSpecification(parsed)                             → operations{}, meta
  ├─ compareOperations(ctx, baselineModel, candidateModel)      → semantic events
  ├─ decorateChanges(events)                                    → rule lookup + sort
  ├─ filter(includeNonBreaking, ignorePaths, ignoreMethods, ignoreCategories)
  ├─ assignIds(changes)                                         → CHG-001…
  └─ buildReport(...)                                           → totals, guide, digest, verdict
```

`emit()` is the only coupling between comparators and rules: comparators choose *what kind* of change
happened (`request-constraint-narrowed`), never how severe it is.

---

## 4. Canonical model

```js
{
  meta: { title, version, openapi, servers, tags, warnings, schemaNames },
  operationCount,
  operations: {
    "POST /orders": {
      key, method, path, canonicalPath, operationId, summary, deprecated,
      parameters: [{ name, in, required, deprecated, hasDefault, defaultValue, schema }],
      requestBody: { required, description, content: { "application/json": { schema } } } | null,
      responses: {
        "201": { description, content: { "application/json": { schema } }, headers: [] }
      }
    }
  }
}
```

Matching rules:

- Operations are grouped by `canonicalPath` (`{orderId}` and `{id}` → `{}`), then paired by HTTP method.
- When the raw paths differ but the shapes match, one `path-template-renamed` change is emitted and the path
  parameters are compared under their new names instead of as remove + add.
- Parameters are keyed by `in:name`. A parameter that only changed location is reported once as
  `parameter-location-changed`.

---

## 5. Rule semantics (why direction matters)

The engine asks: *what did the contract start accepting, and what did it start returning?*

| Contract | Narrowing | Widening |
| --- | --- | --- |
| Request | **breaking** (e.g. new required field, removed enum value, tighter maximum) | non-breaking (e.g. optional field, added enum value, relaxed bound) |
| Response | non-breaking (fewer values a consumer must handle) | **breaking** (e.g. removed property, added enum value, widened type) |
| Endpoint | method/path removed → **breaking** | endpoint/method added → non-breaking |

Special cases:

- `integer` → `number` is widening (accepted); `number` → `integer` is narrowing.
- A removed request property is non-breaking unless the candidate sets `additionalProperties: false`
  (rule `request-property-removed-strict`).
- `allOf` is merged before comparison (intersection); `oneOf`/`anyOf` variants are sorted by a stable key and
  paired by index, with leftover variants reported as added/removed.
- Circular `$ref`s are compared by reference name only (`schema-reference-changed`) and never expanded
  infinitely.

---

## 6. Data model

```
User        id, name, email (unique), hash + salt (passport-local-mongoose), timestamps
Project     id, owner → User, name, description, timestamps
Specification  id, project → Project, role (baseline|candidate), name, version,
               openapi, operationCount, sizeBytes, document (Mixed), timestamps
               unique index on (project, role)
Comparison  id, project → Project, owner → User,
            baselineSpec {specId, name, version}, candidateSpec {specId, name, version},
            options, summary {total, breaking, potentiallyBreaking, nonBreaking},
            resultDigest, report (Mixed), timestamps
```

Cardinality: one user → many projects; one project → one baseline + one candidate + many comparisons.
Deleting a project cascades to its specifications and comparisons in both storage adapters.

Persistence modes (BR-05):

- `mongodb` — reached at startup, durable.
- `memory` — MongoDB unreachable; data is kept for the process lifetime. `GET /api/health` and the server log
  state the mode explicitly, so a demonstration never pretends data was persisted when it was not.

---

## 7. Determinism strategy (AC-12, NFR-02)

1. Normalisation sorts parameter lists, media types and schema names; operations are traversed by sorted
   canonical path and HTTP method order.
2. Change records are sorted by `(path, method rank, pointer, code, oldValue)` and only then numbered.
3. The report digest is SHA-256 over the inputs' digests, the normalised options and the sorted change tuples.
4. Volatile values are isolated in `meta.run` (`generatedAt`, `durationMs`); everything else is reproducible.
5. `docs/TESTING.md` and `engine.test.js` compare digests across two runs of the same pair.

---

## 8. Security design (NFR-06, AC-13)

- **Authentication:** Passport local strategy with `passport-local-mongoose` salted hashes; the session is an
  httpOnly, SameSite=Lax cookie (secure in production) persisted by `connect-mongo`.
- **Authorisation:** every project/specification/comparison read is scoped by `owner` taken from the
  authenticated session; ids coming from the client are never trusted for ownership.
- **Input validation:** structure validation before any comparison; email/name/password rules; upload size and
  type limits; Mongoose schema validation.
- **Content:** React escapes all rendered text; no HTML injection surface; no `dangerouslySetInnerHTML`.
- **Data at rest:** only hashed passwords; documents are user-supplied specifications and derived reports.
- **Error responses:** validation issues are returned to the caller, but internal errors log server-side and
  return a generic message.

---

## 9. Design decisions and trade-offs

| Decision | Reason | Trade-off |
| --- | --- | --- |
| Engine as pure JS with no dependencies | Testable, portable, demonstrates module separation (NFR-05) | No third-party diff library conveniences |
| Rule table as data | Auditable, single source for docs, report and tests (BR-02) | Adding a new code requires a table entry (by design) |
| Whole-document dereference | Simple, deterministic comparison model | Very large specifications are fully materialised; mitigated by a 5 MB upload cap and depth guard |
| Repository with two adapters | Demo works without MongoDB while Mongo is used when available | Slight duplication between adapters |
| JSON-only input | Explicit constraint (BR-01); avoids a YAML dependency outside the course stack | Users must export YAML specifications as JSON |
| `oneOf` pairing by sorted key | Deterministic and dependency-free | Discriminator-aware matching is future work |
| Options filtering after decoration | Keeps ids stable and digest reproducible | Filtered changes are still computed |

---

## 10. Extensibility points (NFR-08)

1. **New formats:** add a parser adapter that returns the same normalised model; comparators stay unchanged.
2. **Custom rules:** add entries to `rules.js` with a new code and emit the code from a comparator.
3. **CI integrations:** consume `ci`/`verdict` from `POST /api/compare` (already machine readable).
4. **AI assistance:** the report's structured change list is the ideal input for an optional model that
   rewrites migration notes; no AI dependency is required today (BR-07).
