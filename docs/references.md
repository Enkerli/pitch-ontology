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
- id: kubik-african-tone-systems
  authors: [Gerhard Kubik]
  year: 1985
  title: African Tone-Systems—A Reassessment
  venue: Yearbook for Traditional Music
  volume: '17'
  doi: 10.2307/768436
  metadata_gaps: [pages]
  verified:
    method: crossref
    date: '2026-09-07'
    evidence: https://api.crossref.org/works/10.2307/768436
    note: >-
      Crossref and OpenAlex record only the first page (31) of this article, so
      `pages` stays declared as a gap rather than guessed.
```

### How the current records were verified, and how far that goes

Records carry the method that established them, and the methods are not equal:

| `verified.method` | what it means |
|---|---|
| `crossref` | the record was resolved at `api.crossref.org/works/<doi>` and its fields read from the publisher's own deposit |
| `publisher_record` | the fields were read from the publisher's article or journal page, for documents Crossref and OpenAlex do not index |
| `web_search_index` | the title, and usually the DOI, were read from a URL returned by a web search — good evidence the document exists at that identifier, weak evidence about authorship, year, volume and pages |

A `crossref` pass on 2026-09-07 upgraded every work that resolves to a DOI, and filled
the author, year, volume, issue and pagination gaps those records had been carrying.
Where an API disagreed with the record, the API won and the disagreement is stated in
`verified.note` — `merakeb-2024` was dated 2025, and `lhomme-2004-experimenter-ethnomusicologie`
was dated 2006 from OpenEdition's online date rather than the issue's own 2004.

What is *still* uncertain is named rather than smoothed over. `ellis-1885` carries a DOI
that resolves to the contemporary report in *Nature*, not to Ellis's own paper in the
*Journal of the Society of Arts*; `kubik-african-tone-systems` keeps `pages` in
`metadata_gaps` because Crossref and OpenAlex both record only its first page. Records
with no identifier at all — museum pages, liner notes, encyclopaedia entries, most of the
French-language material on OpenEdition — were checked against the publisher's page where
one exists and are otherwise unchanged.

To re-check a record yourself:

```
https://api.crossref.org/works/<doi>
https://api.openalex.org/works/https://doi.org/<doi>
```

## The network is mostly not a citation graph

`sources/network.yaml` records typed relationships between documents. Every edge states
its `basis` in prose and how it was `established_by`:

| `established_by` | meaning |
|---|---|
| `verified_reference_list` | B appears in A's reference list, checked directly |
| `stated_in_source` | one of the documents states the relationship |
| `curatorial` | this repository's reading — a hypothesis, not a citation |

Most edges are `curatorial`. That is a deliberate, stated limitation rather than an
approximation of citation data: a curatorial edge says what this repository reads as
connected, not who acknowledged whom. The `CITES` type is reserved for the second kind,
and the validator **refuses** it unless `established_by` is `verified_reference_list`.

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

### The citation edges, and why there are so few

A citation pass was run on 2026-09-07:

1. Every work was resolved to an identifier where one exists — by DOI, by arXiv id, or by
   title search against OpenAlex with the match checked by hand. Four title matches were
   *rejected*: two were published reviews of the book we hold rather than the book itself
   (`wright-1978`, `dell-elmedlaoui-2008`), and two were different documents that the search
   surfaced on subject or title overlap (`during-dastgah`, and
   `tzanetakis-2007-computational-ethnomusicology` against the 2013 JNMR editorial, which
   this bibliography holds separately). An unresolved work is better than a wrong one: the
   four are still identifierless, and the citation pass simply cannot see them from the
   citing side.
2. For each resolved work, the publisher's deposited reference list was read from
   `api.crossref.org/works/<doi>`, and OpenAlex's `referenced_works` array alongside it.
3. An edge was kept only where **both** endpoints are already in `works.yaml`. This is a
   bibliography of what the ontology reads, not a crawl of the literature.
4. Entries with no DOI were matched on author, year, venue, volume and first page, and the
   entry key is recorded on the edge in `reference_key` so the match can be re-checked.

That yields eleven `CITES` edges, written alongside the curatorial edges rather than
replacing them. Three of the eleven fall on pairs that already carried a curatorial edge:
the two kinds answer different questions, and it is worth being able to see where a reading
and an acknowledgement coincide.

Eleven is thin, and thin for a structural reason worth stating. Only 24 of 56 records carry
a DOI (three of those are arXiv DOIs, which deposit no reference list). Of the rest, most are museum catalogue records, technical specifications, UNESCO
inscriptions, liner notes and web documentation — documents that cite nothing in a machine-
readable way and that scholarly reference lists cite as URLs when they cite them at all. The
francophone material is a second gap: OpenEdition deposits reference lists for some journals
and not others, and the Cahiers d'ethnomusicologie article held here is indexed by neither
Crossref nor OpenAlex. A citation graph over this bibliography will stay sparse as long as
the bibliography keeps taking non-article documents seriously, which it should.

Rejected matches were left out rather than downgraded to curatorial edges: a reference to
Helmholtz *translated by* Ellis is not a citation of Ellis's own comparative paper, and a
citation of Sethares's 2005 book is not a citation of his 1994 article.

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
