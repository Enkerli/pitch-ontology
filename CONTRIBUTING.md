# Contributing

Contributions should make the ontology more situated, not merely larger.

## Before adding a concept

Ask:

1. Is this a locally used term, a historical theoretical term, an analyst's category,
   a perceptual/acoustical construct, or a computational abstraction?
2. In which language, place, repertoire, institution, period, or practice is the sense attested?
3. What does the concept distinguish in practice?
4. Which tempting translations are only partial?
5. What evidence supports the claim?
6. Is disagreement or variation being erased?

## Avoid

- `raga IS_A scale`-style universalization.
- Treating measured cents as the identity of a practice.
- Creating a catch-all `non-Western` domain.
- Assigning a single invariant meaning to historically mobile terms.
- Inventing indigenous terminology to fill an analytical slot.
- Inferring genealogy from conceptual similarity.

## Prefer

- `PARTIALLY_OVERLAPS`
- `ILLUMINATES_ASPECT_OF`
- `OFTEN_TRANSLATED_AS`
- `POORLY_TRANSLATED_AS`
- explicit scope and provenance
- multiple senses where historical usage differs

All substantial claims should cite a record in `sources/works.yaml`.
