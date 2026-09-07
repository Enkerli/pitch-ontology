# Claim-level rigor

The ontology distinguishes **concept records** from **claims**.

A concept record gives a situated orientation to a term or analytical object. A claim
asserts a relation between two concepts and must state, where relevant:

- **aspect** — exactly what is being compared, contrasted, or inferred;
- **limit** — where the comparison stops;
- **scope** — tradition, region, period, repertoire, institution, or language;
- **evidence** — source and evidence type;
- **claim status** — working, supported, contested, historical, or computational;
- **confidence** — low, moderate, or high.

This is especially important for cross-explanation. `ILLUMINATES_ASPECT_OF` is never
a synonym for `IS_A`, `EQUIVALENT_TO`, or `DESCENDS_FROM`.

## Example

```yaml
subject: slendro
relation: ILLUMINATES_ASPECT_OF
object: svara
aspect: >
  A named pitch organization or category need not imply one universal,
  context-independent frequency realization.
limit: >
  Sléndro and svara belong to different histories and performance systems;
  this is an analogy, not translation or genealogy.
claim_status: working
confidence: moderate
```

## Evidence policy

A source should support the *specific relation claimed*, not merely define one endpoint.
If the relation is a synthetic cross-explanation devised by the ontology authors,
mark it `working` unless the comparison is explicitly argued in the literature.

## Negative knowledge

The `limit` field is mandatory in spirit for comparative claims. It records what the
ontology is **not** claiming and helps prevent explanatory analogy from hardening into
false equivalence.
