# References and the bibliographic network

The bibliography is a working layer of the ontology, not an appendix. Concepts point
at works, works point at each other, and both sets of pointers carry their provenance.

Three files hold it:

- `sources/works.yaml` — one record per document
- `sources/network.yaml` — typed edges between documents
- `sources/source-types.yaml` — the controlled vocabularies both use

`schemas/work.schema.json` validates the records; `tools/validate.py` checks the
vocabularies, the edges, and the two queues described at the end of this page.

## What belongs here

Literature in **French or English** that bears on how pitch is perceived, categorized,
organized, tuned, performed, represented, or theorized. Within that:

- **Academic work**, including music technology and music information research. The
  connection between ethnomusicology and computational work on audio is one this
  repository actively wants: measurement tools carry theories of what a note is.
- **Museum and library documentation** — catalogue records, classifications,
  collection databases, digitised holdings. Provenance type, not truth status; see
  `source-hubs.md`.
- **Intergovernmental and non-governmental documentation** — UNESCO instruments and
  inscriptions, ICOM/CIMCIM resources, foundations and learned societies.
- **Technical specifications** from industry bodies, when a standard is the defining
  document for a concept the ontology holds (MIDI tuning, MPE, the Scala format).
- **Community documentation**, where practitioners publish about their own tuning.

Open access is preferred and recorded rather than assumed: `access` distinguishes
`open`, `green_oa` (an author copy or repository deposit exists), `registration_required`,
`closed`, and `unknown`. `mirror_url` holds the free copy when the version of record is
paywalled. Recent open-access work is especially welcome — it can be checked by anyone
reading this repository, which closed literature cannot.

## Sparse but true

A record needs only an `id` and a `title`. Every other field is optional, and **a
missing field is preferred to a guessed one**. When a field is known to be missing or
unconfirmed, name it in `metadata_gaps` so it becomes a task rather than a silence:

```yaml
- id: plos-2017-outliers-world-music
  title: A computational study on outliers in world music
  venue: PLOS ONE
  doi: 10.1371/journal.pone.0189399
  access: open
  metadata_gaps: [authors, year]
  verified:
    method: web_search_index
    date: '2026-09-07'
    evidence: https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0189399
```

### How the current records were verified, and how far that goes

Most records added in the bibliographic pass carry `verified.method: web_search_index`.
That means: the title, and usually the DOI, were read from a publisher or repository URL
returned by a web search — the DOI appears inside the URL itself. It does **not** mean a
metadata record was retrieved from Crossref or OpenAlex, because those APIs, and
publisher pages generally, were unreachable from the environment where the pass was run.

So this level of verification is good evidence that the document exists at that
identifier, and weak evidence about authorship, year, volume and pages. Author names
were recorded only where the search output itself stated them for that specific work;
otherwise `metadata_gaps` says `authors`.

**Before citing any of these in published writing, resolve the DOI and check the record
at the source.** Where you have network access, the fastest route is:

```
https://api.crossref.org/works/<doi>
https://api.openalex.org/works/https://doi.org/<doi>
```

Then set `verified.method` to `crossref` or `openalex` with the date, and delete the
gaps you filled.

## The network is not a citation graph

`sources/network.yaml` records typed relationships between documents. Every edge states
its `basis` in prose and how it was `established_by`:

| `established_by` | meaning |
|---|---|
| `verified_reference_list` | B appears in A's reference list, checked directly |
| `stated_in_source` | one of the documents states the relationship |
| `curatorial` | this repository's reading — a hypothesis, not a citation |

Today almost every edge is `curatorial`. That is a deliberate, stated limitation rather
than an approximation of citation data: no reference list was machine-read, so no edge
claims to be one. The `CITES` type exists and the validator **refuses** it unless
`established_by` is `verified_reference_list`.

Edge types are grouped by what kind of connection they assert — historical
(`HISTORICAL_PRECURSOR_OF`), methodological (`EXTENDS_METHOD_OF`,
`SAME_RESEARCH_PROGRAMME_AS`, `PROVIDES_DATA_FOR`), critical (`REASSESSES`,
`CHALLENGES_ASSUMPTION_OF`, `CONTRASTS_WITH`), corpus (`DOCUMENTS_SAME_EVENT`),
institutional (`PROVIDES_FRAMEWORK_FOR`, `HOSTS_OR_PUBLISHES`, `PUBLISHED_IN`),
technical (`SAME_TECHNICAL_LINEAGE_AS`), and comparative (`BRIDGES_FIELD_TO`).

`BRIDGES_FIELD_TO` is the one to watch. It marks places where literatures that rarely
cite each other are addressing the same problem — a psychophysics study bearing on the
octave equivalence baked into MIDI note numbering; players filing the reeds of a
diatonic accordion and engineers designing keyboard layouts invariant under retuning.
These are the least defensible edges and the most interesting ones. Reject them freely.

### Building a real citation graph later

The honest upgrade path, when the APIs are reachable:

1. For each work with a DOI, fetch `https://api.openalex.org/works/https://doi.org/<doi>`.
2. Read `referenced_works` (OpenAlex work IDs) and `open_access` for the access field.
3. Keep only edges where **both** endpoints are already in `works.yaml` — this is a
   bibliography of what the ontology reads, not a crawl of the literature.
4. Write them as `CITES` edges with `established_by: verified_reference_list`, alongside
   the curatorial edges rather than replacing them. The two kinds answer different
   questions: who acknowledged whom, and what belongs together.

## Two queues the validator reports

Neither is an error. Both are work.

- **Not retrievable** — a work with no `doi`, `url`, `arxiv` or `handle`. Someone read
  it, but a reader of this repository cannot get to it.
- **Not cited by any concept or claim** — a work in the bibliography that no record
  leans on yet. This is the reading list: literature gathered because it looked
  consequential, not yet attached to anything.

A source is attached to a concept only when the document is *about* that concept — a
specification for the format it defines, a study of the phenomenon it names. Topical
adjacency is not evidence, and the queue is a better place for a promising work than a
`sources:` list it does not actually support.
