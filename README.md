# Pitch Ontology

**v0.2 scaffold**

A situated, relational ontology and glossary for pitch: how humans and technologies
perceive, categorize, organize, tune, perform, represent, and theorize pitch.

This is **not** a catalogue of “the scales of the world.” It treats scale, note, mode,
root, cent, MIDI note, rāga, maqām, makam, svara, sléndro, hazzāt, dynamic tuning,
and related concepts as historically and practically situated objects whose overlaps
must be described rather than normalized away.

## Principles

- No tradition is the unmarked default.
- Do not reify “Western” versus “non-Western” music.
- Distinguish local practices from dominant, institutional, travelling, and synthetic systems.
- Translation is many-to-many; partial overlap is not equivalence.
- Preserve disagreement, historical change, performer variation, and uncertainty.
- Distinguish locally named/verbalized concepts from demonstrated practice,
  experimental inference, scholarly reconstruction, and computational abstraction.
- Treat tuning as both configuration and process.
- Treat contour, gesture, timbre, language, instrument, memory, and technology as
  potentially constitutive of pitch organization.
- Cents, pitch classes, staff notation, and MIDI are representational technologies,
  not neutral ontological primitives.
- Cross-explanation is encouraged: one situated concept may illuminate an aspect of
  another without claiming identity or genealogy.

## Repository map

- `ontology/concepts/` — canonical concept records (YAML)
- `ontology/relations.yaml` — controlled graph relations
- `ontology/claims/` — scoped, evidenced relations with explicit limits
- `ontology/domains.yaml` — non-exclusive analytical domains
- `ontology/epistemic-status.yaml` — provenance vocabulary
- `schemas/concept.schema.json` — validation schema
- `docs/principles.md` — methodological commitments
- `docs/concept-journeys/` — questions that traverse the graph
- `sources/works.yaml` — seed bibliography
- `glossary/` — generated/browsable human-facing material
- `tools/validate.py` — lightweight validator

## v0.2 goals

1. Stabilize the schema and relation vocabulary.
2. Seed 75–100 consequential concepts across acoustics, perception, performance,
   language, tuning, historical theory, liturgy, instrument practice, and computation.
3. Build 4–6 concept journeys: *What is a note?*, *What is a scale?*,
   *Where is the centre?*, *How can tuning move?*, and *How does speech interact with pitch?*
4. Add cross-explanations rather than one-way translations.
5. Make every substantial historical/ethnographic claim traceable to sources.

## Status

Experimental. The schema is expected to change as concepts from different practices
stress-test its assumptions.

## v0.2 population status

Current scaffold contains **124 canonical concept records**. Most newly populated
records are marked `review_status: seed`: structurally useful, but not a claim of
final specialist verification. See `docs/review-queue.md`.

Validation checks schema conformance plus controlled domains, epistemic statuses,
relations, and source IDs. Unresolved relation targets are reported as warnings so
the graph can point toward concepts queued for later creation.

## Claim-level rigor

Cross-cultural and comparative relations are now first-class claim records with `aspect`, `limit`, `scope`, `evidence`, `claim_status`, and `confidence`. See `docs/claim-rigor.md`.
