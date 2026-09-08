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
- id: midi-tuning-standard
  corporate_author: MIDI Association
  title: MIDI Tuning (Updated Specification)
  url: https://midi.org/midi-tuning-updated-specification
  access: registration_required
  metadata_gaps: [year]
  verified:
    method: publisher_record
    date: '2026-09-07'
    evidence: https://midi.org/midi-tuning-updated-specification
    note: >-
      The MIDI Association page names the constituent documents — CA-020 and
      CA-021/RP-020 — but states no adoption date for either the original standard
      or this update, so `year` stays declared as a gap rather than guessed.
```

### How the current records were verified, and how far that goes

Records carry the method that established them, and the methods are not equal:

| `verified.method` | what it means |
|---|---|
| `crossref` | the record was resolved at `api.crossref.org/works/<doi>` and its fields read from the publisher's own deposit |
| `openalex` | resolved at `api.openalex.org`, for documents Crossref does not carry (arXiv deposits, HAL) |
| `publisher_record` | the fields were read from the publisher's, museum's or project's own page or API, for documents no index covers |
| `web_archive` | the publisher's page is no longer reachable, so the fields were read from an Internet Archive snapshot, whose date is given |
| `web_search_index` | the title, and usually the DOI, were read from a URL returned by a web search — good evidence the document exists at that identifier, weak evidence about authorship, year, volume and pages |

A `crossref` pass on 2026-09-07 upgraded every work that resolves to a DOI, and filled
the author, year, volume, issue and pagination gaps those records had been carrying.
Where an API disagreed with the record, the API won and the disagreement is stated in
`verified.note` — `merakeb-2024` was dated 2025, and `lhomme-2004-experimenter-ethnomusicologie`
was dated 2006 from OpenEdition's online date rather than the issue's own 2004.

A second pass then took the declared gaps one at a time, against whatever body actually
stands behind each document: Cambridge University Press for the pagination of a *Yearbook
for Traditional Music* article that Crossref truncates to a first page, the Met's
collection API, DOAJ, the UK funder's project page, the site's own copyright line.

**A gap can close two ways, and the difference matters.** Some were filled with a value.
Others were closed because the field does not exist for that document — the *Journal of
Interdisciplinary Music Studies* deposits no DOIs at all, so `tzanetakis-2007` is not
waiting on one; the Horniman's online catalogue and the CIMCIM resources index carry no
publication date, so `year` is inapplicable rather than unknown. Closing those as
non-existent, with the reason in `verified.note`, keeps the queue a list of real work
instead of a list of questions with no answers. Where a document is a maintained resource
rather than a dated publication, `year` records its run — `2008–` for the MBIRA site,
`2001–` for the Scala format page, `2011–2017` for CompMusic.

What is *still* uncertain is named rather than smoothed over. `ellis-1885` carries a DOI
that resolves to the contemporary report in *Nature*, not to Ellis's own paper in the
*Journal of the Society of Arts*. `midi-tuning-standard` keeps `year`, because the MIDI
Association publishes the specification with no adoption date on it — the one remaining
declared gap in the bibliography. `qdl-cairo-congress-microtones` was read from an
Internet Archive snapshot, because the Qatar Digital Library now serves a bot-verification
interstitial that this repository does not try to get around.

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

That yields nineteen `CITES` edges, written alongside the curatorial edges rather than
replacing them. Three of them fall on pairs that already carried a curatorial edge: the two
kinds answer different questions, and it is worth being able to see where a reading and an
acknowledgement coincide.

Seven of the eighteen arrived with three works added in September 2026 from the candidate
list in `citing-work.md` — McBride, Passmore & Tlusty, Papaioannou et al., and Savage. The
Savage chapter is the instructive one: it is a review of exactly this literature and it
cites **none** of the works held here, while McBride cites five of them. Subject overlap and
citation overlap are not the same measurement, which is the whole reason this file keeps
curatorial edges and citation edges apart.

Nineteen is thin, and thin for a structural reason worth stating. Only 31 of 63 records
carry a DOI (three of those are arXiv DOIs, which deposit no reference list). Of the rest, most are museum catalogue records, technical specifications, UNESCO
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
