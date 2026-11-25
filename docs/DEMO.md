# Code demonstration script (10–12 minutes)

This script walks an examiner from the SRS to working behaviour. Each step names the requirement it proves.

---

## Before the demonstration

```bash
npm run install:all      # once
npm test                 # 14 engine acceptance tests
npm run build            # production client
npm start                # Express on :5000 (serves the built client)
```

For a development walkthrough use `npm run dev` instead (client on :5173, API on :5000).

Check `GET /api/health` first and note the persistence mode — say it out loud, because the SRS makes
persistence optional (BR-05).

---

## 1. Problem statement (1 minute)

> "Two versions of an API specification can differ in ways that quietly break existing clients. Text diffing
> cannot tell a compatible addition from a breaking removal, so this project compares the two specifications
> semantically and classifies every difference using deterministic rules."

Show the SRS requirements you are about to demonstrate: FR-02, FR-04 → FR-11, FR-15 → FR-22, FR-23/24.

---

## 2. Architecture and modularity (2 minutes)

Open `server/engine/` and point at the pipeline:

```
parser.js → refResolver.js → normalizer.js → comparators/ → rules.js → explain.js → report.js
```

Key sentence for the examiner: *"Comparators decide what kind of change happened; only the rule table decides
classification and severity. That is why the rules are auditable and the results are deterministic."*

Show `server/engine/rules.js` and the generated `docs/RULES.md` (63 rules with stable ids).

---

## 3. Validation (1 minute) — FR-02, AC-02

On the home page, paste an invalid document (for example, remove `"openapi"`), press **Run comparison**.

Expect: red panel listing `missing-openapi-version` with its JSON path. Nothing is compared until both
documents are valid.

---

## 4. Core comparison (3 minutes) — FR-03 → FR-19

Press **Load sample pair** and **Run comparison**.

Expected totals: **53 changes — 27 breaking, 5 potentially breaking, 21 non-breaking**, verdict `FAIL`.

Point out, in this order:

1. `GET /orders` — `Accepted enum value removed` (`cancelled`), classified **breaking**, and next to it
   `response enum value added` (`refunded`) which is **also breaking** because it widens response output.
   This is the direction-aware model the SRS asks for (BR-03).
2. `GET /orders` — `Parameter became required` and `Request constraint tightened` on `query.limit`.
3. `DELETE /orders/{orderId}` — `HTTP method removed`, severity `critical`; the path template rename to
   `/orders/{id}` is reported once as potentially breaking instead of three separate changes.
4. `POST /orders` — `New required request property added` (`currency`) and
   `Request property removed and unknown properties are rejected` (`legacyRef` with
   `additionalProperties: false`).
5. `GET /customers` — content type changed from `application/json` to `application/vnd.api+json`:
   removed (breaking) plus added (non-breaking).
6. `POST /payments` — `Accepted request variant added` (`WalletPayment`, `oneOf`), non-breaking.
7. `GET /orders/{id}` — `Response data type widened`? open the `total` change: number → string is
   `Incompatible response data type change`, breaking/high.

For any card, read the four required fields out loud: classification + severity, old definition, new
definition, impact and migration guidance (FR-17 → FR-19, AC-08).

Filter to **Breaking** and show the migration guide grouped by endpoint (AC-09).

---

## 5. Determinism (1 minute) — AC-12, NFR-02

Run the same comparison twice (or press **Run comparison** again). Compare the digest shown in the report
header: identical. Mention that timestamps are isolated in `meta.run` and the digest covers inputs, options
and sorted changes.

Terminal proof (optional):

```bash
npm test        # AC-12 test compares digests and change ids across runs
```

---

## 6. CI/CD interface (1 minute) — FR-22, AC-10

```bash
curl -s -X POST http://localhost:5000/api/compare \
  -H "Content-Type: application/json" \
  -d "{\"baseline\": $(cat server/samples/baseline.json), \"candidate\": $(cat server/samples/candidate.json)}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log('verdict:',r.verdict.status,'exit:',r.ci.exitCode,'digest:',r.ci.resultDigest.slice(0,12));})"
```

Expect: `verdict: FAIL exit: 1`. Explain that a pipeline fails the build on exit code 1 and stores the JSON
artifact (EI-07).

Optional: press **Copy CI summary** in the report to show the same information for a pull-request comment.

---

## 7. Projects, persistence and history (2 minutes) — FR-23, FR-24, AC-11

1. **Create account** → register (password hashed by passport-local-mongoose, session is an httpOnly cookie).
2. **New project** → "Acme Orders API".
3. Upload `server/samples/baseline.json` as baseline, `server/samples/candidate.json` as candidate.
   Point at version / OpenAPI / operation count extracted by the validator.
4. **Run comparison** → saved report opens.
5. Show **Comparison history** with totals, verdict and digest.
6. Sign in as a second account and try the same project URL → not found (ownership scoping, NFR-06).

If MongoDB is running, restart the server and reopen the project to prove durability. If not, state clearly
that the session is using the in-memory adapter reported by `/api/health`.

---

## 8. Requirements traceability (1 minute) — SRS section 9

Open **Docs** in the UI:

- Rule catalogue shows the 63 deterministic rules, each with a stable id, classification and severity.
- Classification model explains the request/response direction of compatibility.
- HTTP API table lists every endpoint used in the demonstration.
- Requirement-to-module mapping is kept in `docs/DESIGN.md` and `docs/TESTING.md` for the submission.

Close with the constraints: JSON-only input, Swagger 2.0 rejected, external `$ref` not fetched, `oneOf`
pairing heuristic — all deliberate boundaries recorded in `docs/DESIGN.md` and the README limitations
section (BR-01, BR-04, BR-07).

---

## 9. Likely examiner questions

**Why is adding an enum value to a request non-breaking but to a response breaking?**
Because the contract is directional: the server accepting more input does not invalidate existing requests,
while the server returning a value the consumer's enum does not know can break deserialisation.

**Why is a removed request property sometimes breaking?**
It is non-breaking by default; it becomes breaking when the candidate sets `additionalProperties: false`,
because clients that still send the field are rejected (see rule `request-property-removed-strict`).

**How do you know the result is deterministic?**
Sorted traversals, stable serialisation, deterministic ids and a SHA-256 digest over the change set — asserted
by the AC-12 test.

**Where would YAML or an AI-written migration note plug in?**
A parser adapter before `normalizer.js`; an optional post-processing step over `report.changes` that must not
change classification (BR-02).

**What happens if MongoDB is down?**
The server starts in `memory` mode, reports it through `/api/health`, and keeps projects/history for the
session. It never claims data was persisted when it was not.
