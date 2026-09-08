# Pitch Ontology

**v0.2 scaffold** · [Browse the records →](https://enkerli.github.io/pitch-ontology/)

**Preliminary work towards** a situated, relational ontology and glossary for pitch
**and rhythm**: how people and technologies perceive, categorize, organize, tune, time,
perform, represent and theorize them, with no tradition as the unmarked default.

The repository is still called *pitch-ontology* because that is where it started. The
temporal half was added second, and deliberately not as a mirror of the first: the
problems are analogous but not identical, and the sharpest rhythm concepts —
`ensemble_interlocking`, `clave_direction` — name relations between parts, which pitch
raises far less often.

It is scaffolding rather than a finished vocabulary — the schema, the relation
vocabulary and most of the records are provisional, and the point of publishing them
is to have them argued with.

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
- `sources/works.yaml` — bibliography, one record per document
- `sources/network.yaml` — typed edges between documents
- `sources/source-types.yaml` — controlled vocabularies for the bibliography
- `docs/references.md` — what belongs in the bibliography, and how it was verified
- `docs/scope-and-focus.md` — why pitch is not equally central everywhere
- `glossary/index.md` — generated alphabetical view (do not edit by hand)
- `web/` — static frontend (hand-written HTML/CSS/JS, no build step)
- `docs/citing-work.md` — generated: recent literature citing this bibliography
- `docs/pitch-and-time.md` — how the temporal half relates to the pitch half
- `tools/validate.py` — lightweight validator
- `tools/build_site.py` — generates `site/` and `glossary/index.md` from the YAML
- `tools/citing_works.py` — asks OpenAlex who has cited these works since

## Browsing and building

The YAML records are canonical; every human-facing view is derived from them.

```sh
pip install -r requirements-dev.txt
python tools/validate.py        # schema, controlled vocabularies, source ids
python tools/build_site.py      # writes site/ and refreshes glossary/index.md
python -m http.server --directory site   # then open http://localhost:8000
```

The site is a single static page over one generated `data.json`. It offers:

- **Concepts** — filter by domain, epistemic status and review state; each record shows
  its labels in their own scripts, orientation, roles, cautions, relations grouped by
  kind, backlinks, sources and a diagram of its immediate neighbourhood.
- **Claims** — comparative relations with their aspect, limit, scope, evidence and
  confidence, rather than bare edges.
- **Journeys** — the questions that traverse the graph.
- **Sources** — the bibliography, filtered by access level, provider type, kind and
  language, with a *Where fields meet* panel for the edges that connect literatures
  which rarely cite each other. Each work shows how retrievable it is, what is missing
  from its record, which concepts and claims lean on it, and its place in the network.
- **About** — methodological documents.

Unresolved relation targets are shown as *queued* rather than hidden, so the graph can
point toward concepts that have not been written yet.

`.github/workflows/pages.yml` validates, builds and publishes the site to GitHub Pages
on every push to `main`. The repository's Pages source must be set to *GitHub Actions*
(*Settings → Pages → Source*); left on *Deploy from a branch*, GitHub serves Jekyll's
render of this README instead and the site never appears.

## v0.2 goals

1. Stabilize the schema and relation vocabulary.
2. Seed 75–100 consequential concepts across acoustics, perception, performance,
   language, tuning, historical theory, liturgy, instrument practice, and computation.
3. Build 4–6 concept journeys: *What is a note?*, *What is a scale?*,
   *Where is the centre?*, *How can tuning move?*, *How does speech interact with pitch?*,
   and *Where is the one?*
4. Add cross-explanations rather than one-way translations.
5. Make every substantial historical/ethnographic claim traceable to sources.

## Status

Experimental. The schema is expected to change as concepts from different practices
stress-test its assumptions.

## v0.2 population status

Current scaffold contains **190 canonical concept records**, **31 claim records** and
**96 bibliographic records** joined by **101 typed edges**, thirty-nine of which are citations
checked against the citing work's own reference list.
Most newly populated records are marked `review_status: seed`: structurally useful,
but not a claim of final specialist verification. See `docs/review-queue.md`.

Validation checks schema conformance plus controlled domains, epistemic statuses,
relations, and source IDs. Unresolved relation targets are reported as warnings so
the graph can point toward concepts queued for later creation.

## Claim-level rigor

Cross-cultural and comparative relations are now first-class claim records with `aspect`, `limit`, `scope`, `evidence`, `claim_status`, and `confidence`. See `docs/claim-rigor.md`.

## References

The bibliography covers academic literature in French and English, museum and library
documentation, intergovernmental and non-governmental records, and the technical
specifications that define several of these concepts outright. Open access is recorded
rather than assumed, and gaps are declared rather than guessed: a record states what is
missing from it in `metadata_gaps`.

`sources/network.yaml` draws typed edges between documents — historical precursors,
methodological extensions, shared corpora, institutional frameworks, and the
`BRIDGES_FIELD_TO` edges that connect ethnomusicology to work on music technology.
**Most of these are not citation edges.** They are curatorial readings, and they say what
this repository takes to be connected rather than who acknowledged whom. The `CITES` type
is reserved for edges read out of the citing work's deposited reference list, and the
validator refuses it on any other basis: there are thirty-nine, each naming the reference
entry it came from.

Every record that resolves to a DOI has been checked against Crossref, which filled the
author, year and pagination gaps the first pass had to leave open and corrected three
dates.
What remains uncertain is still declared in `metadata_gaps` rather than guessed.
`docs/references.md` explains the method and what it does not establish.

Validation reports two queues as warnings rather than errors: works with no retrievable
identifier, and works no concept or claim leans on yet — the reading list.

`tools/citing_works.py` looks the other way down the citation graph. Where
`sources/network.yaml` records edges between works already held here, this asks OpenAlex
which recent papers cite them, and ranks candidates by how many of these records they
cite at once — a paper reaching across several is engaging with the seam this repository
cares about, where one citation may be in passing. Reviews and surveys are flagged
separately. It writes `docs/citing-work.md`, which is a candidate list and nothing more:
being on it is not an argument for inclusion. The tool needs network access and is not
run by CI.

```sh
python tools/citing_works.py --since 2022 --min-seeds 2
```
