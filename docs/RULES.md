# Compatibility rule catalogue

> Generated from `server/engine/rules.js` — do not edit by hand. Run `npm run docs:rules` to refresh.

Total rules: **63**. Every rule has a stable id so the report, the design document and the
demonstration script can refer to the same definition (BR-02, FR-15, FR-16).

Direction semantics:

- **Request** rules describe what the server newly *accepts*. Narrowing input (new required field,
  removed enum value, tighter bounds) breaks consumers.
- **Response** rules describe what the server newly *returns*. Widening output (new enum value,
  wider type, removed property) breaks consumers.

## Endpoint

| Rule | Code | Classification | Severity | Title |
| --- | --- | --- | --- | --- |
| R-01 | `endpoint-added` | non-breaking | info | Endpoint added |
| R-02 | `endpoint-removed` | breaking | critical | Endpoint removed |
| R-03 | `path-template-renamed` | potentially-breaking | medium | Path template parameter renamed |

## HTTP Method

| Rule | Code | Classification | Severity | Title |
| --- | --- | --- | --- | --- |
| R-04 | `method-added` | non-breaking | info | HTTP method added |
| R-05 | `method-removed` | breaking | critical | HTTP method removed |
| R-06 | `operation-deprecated` | non-breaking | low | Operation marked deprecated |

## Parameter

| Rule | Code | Classification | Severity | Title |
| --- | --- | --- | --- | --- |
| R-07 | `parameter-added-required` | breaking | high | New required parameter added |
| R-08 | `parameter-added-optional` | non-breaking | info | New optional parameter added |
| R-09 | `parameter-removed` | breaking | high | Parameter removed |
| R-10 | `parameter-required-added` | breaking | high | Parameter became required |
| R-11 | `parameter-required-removed` | non-breaking | info | Parameter became optional |
| R-12 | `parameter-location-changed` | breaking | high | Parameter moved to a different location |
| R-13 | `parameter-default-changed` | potentially-breaking | low | Parameter default value changed |

## Request Body

| Rule | Code | Classification | Severity | Title |
| --- | --- | --- | --- | --- |
| R-14 | `request-body-required-added` | breaking | high | Request body became mandatory |
| R-15 | `request-body-removed` | potentially-breaking | medium | Request body removed |
| R-16 | `request-body-added-required` | breaking | high | Required request body added |
| R-17 | `request-body-added-optional` | non-breaking | info | Optional request body added |

## Content Type

| Rule | Code | Classification | Severity | Title |
| --- | --- | --- | --- | --- |
| R-18 | `request-content-type-removed` | breaking | high | Accepted request content type removed |
| R-19 | `request-content-type-added` | non-breaking | info | New request content type accepted |
| R-42 | `response-content-type-removed` | breaking | high | Response content type removed |
| R-43 | `response-content-type-added` | non-breaking | low | Response content type added |

## Request Schema

| Rule | Code | Classification | Severity | Title |
| --- | --- | --- | --- | --- |
| R-20 | `request-property-added` | non-breaking | info | Optional request property added |
| R-21 | `request-property-added-required` | breaking | high | New required request property added |
| R-22 | `request-property-removed` | non-breaking | low | Request property removed |
| R-23 | `request-property-removed-strict` | breaking | high | Request property removed and unknown properties are rejected |
| R-24 | `request-required-added` | breaking | high | Request property became required |
| R-25 | `request-required-removed` | non-breaking | info | Request property became optional |
| R-33 | `request-constraint-narrowed` | breaking | medium | Request constraint tightened |
| R-34 | `request-constraint-widened` | non-breaking | info | Request constraint relaxed |
| R-35 | `request-nullable-removed` | breaking | medium | null no longer accepted |
| R-36 | `request-nullable-added` | non-breaking | info | null now accepted |
| R-37 | `request-additional-properties-removed` | breaking | medium | Additional request properties no longer allowed |
| R-38 | `request-oneof-variant-added` | non-breaking | info | Accepted request variant added |
| R-39 | `request-oneof-variant-removed` | breaking | high | Accepted request variant removed |

## Enumeration

| Rule | Code | Classification | Severity | Title |
| --- | --- | --- | --- | --- |
| R-26 | `request-enum-added` | breaking | medium | Closed set of accepted values introduced |
| R-27 | `request-enum-removed` | non-breaking | info | Enum restriction removed |
| R-28 | `request-enum-value-removed` | breaking | medium | Accepted enum value removed |
| R-29 | `request-enum-value-added` | non-breaking | info | New enum value accepted |
| R-48 | `response-enum-added` | non-breaking | info | Response enum restriction introduced |
| R-49 | `response-enum-removed` | breaking | medium | Response enum restriction removed |
| R-50 | `response-enum-value-added` | breaking | medium | New response enum value possible |
| R-51 | `response-enum-value-removed` | non-breaking | low | Response enum value no longer returned |

## Data Type

| Rule | Code | Classification | Severity | Title |
| --- | --- | --- | --- | --- |
| R-30 | `request-type-widened` | non-breaking | info | Request data type widened |
| R-31 | `request-type-narrowed` | breaking | high | Request data type narrowed |
| R-32 | `request-type-changed` | breaking | high | Incompatible request data type change |
| R-52 | `response-type-widened` | breaking | high | Response data type widened |
| R-53 | `response-type-narrowed` | non-breaking | info | Response data type narrowed |
| R-54 | `response-type-changed` | breaking | high | Incompatible response data type change |
| R-61 | `format-changed` | potentially-breaking | low | Format annotation changed |

## Response

| Rule | Code | Classification | Severity | Title |
| --- | --- | --- | --- | --- |
| R-40 | `response-added` | non-breaking | info | Response status code added |
| R-41 | `response-removed` | breaking | high | Response status code removed |

## Response Schema

| Rule | Code | Classification | Severity | Title |
| --- | --- | --- | --- | --- |
| R-44 | `response-property-added` | non-breaking | info | Response property added |
| R-45 | `response-property-removed` | breaking | high | Response property removed |
| R-46 | `response-required-added` | non-breaking | low | Response property marked as always present |
| R-47 | `response-required-removed` | non-breaking | info | Response property no longer guaranteed |
| R-55 | `response-constraint-widened` | potentially-breaking | low | Response constraint relaxed |
| R-56 | `response-constraint-narrowed` | non-breaking | info | Response constraint tightened |
| R-57 | `response-nullable-added` | breaking | medium | null may now be returned |
| R-58 | `response-nullable-removed` | non-breaking | info | null no longer returned |
| R-59 | `response-oneof-variant-added` | breaking | medium | New response variant possible |
| R-60 | `response-oneof-variant-removed` | potentially-breaking | medium | Response variant no longer produced |

## Schema Reference

| Rule | Code | Classification | Severity | Title |
| --- | --- | --- | --- | --- |
| R-62 | `schema-reference-changed` | potentially-breaking | medium | Schema reference changed |
| R-63 | `schema-composition-changed` | potentially-breaking | medium | Schema composition keyword changed |

## Severity scale

| Severity | Meaning |
| --- | --- |
| critical | The endpoint or method disappears; every caller fails. |
| high | A request that used to succeed is rejected, or data a caller reads disappears. |
| medium | A narrower/wider contract that breaks a meaningful subset of consumers. |
| low | Behaviour changes that usually need consumer attention but rarely crash them. |
| info | Purely additive or compatible changes, reported for completeness. |
