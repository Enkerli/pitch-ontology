# Research and review queue

v0.2 intentionally distinguishes **population** from **specialist verification**.

## High-priority source deepening

The following clusters have seed concepts but need stronger specialist bibliographies
and, where appropriate, locally authored / community-controlled sources:

- South Asian historical senses of `śruti`, `svara`, `vādī`, `samvādī`, `nyāsa`,
  `āroha/avaroha`, `gamaka`, and `pakad`.
- Ottoman/Turkish `makam`, `seyir`, `perde`, `karar`, `güçlü`, and `çeşni`,
  including historical change across Ottoman and Republican theory.
- Arabic `maqām`, `jins`, `sayr`, `ghammāz`, and `qarār`, with regional and
  historical senses rather than a single pedagogical normalization.
- Chinese `lǜ`, `Huángzhōng`, `gōng`, and `wǔshēng`, with textual chronology,
  material pitch standards, court/state metrology, and later practice kept distinct.
- Indonesian `laras`, `sléndro`, `pélog`, `pathet`, and `embat`, separated by
  Javanese, Sundanese, Balinese, ensemble, and historical context.
- Uyghur `muqam` and other Central Asian maqom/mugham/muqam traditions.
- Community-specific Indigenous Australian song concepts. The current
  `songline_pitch_context` node is explicitly an analytical guardrail, not an
  Indigenous lexical substitute.
- Sámi joik: replace umbrella-level orientation with region/language/community-specific
  senses before making pitch-generalizations.
- Andean `ira/arka` spelling, role terminology, and regional variation.

## Conceptual research

- What constitutes a stable pitch category perceptually?
- When is octave equivalence behaviorally relevant rather than analytically imposed?
- Pitch/timbre entanglement in bells, drums, speech, multiphonics, and growled/rough voice.
- Lexical tone and song: preservation, compromise, neutralization, and genre-specific rules.
- Dynamic tuning as relational ontology rather than frequency-table mutation.
- Historical influence paths: conquest, migration, liturgy, trade, instrument diffusion,
  court theory, colonial schooling, recording, conservatories, and software.

## Data-model questions

- Should claims, rather than senses, become first-class objects carrying date/scope/source?
- How should contested claims be represented without a single `confidence` scalar?
- Should `ILLUMINATES_ASPECT_OF` carry an explicit `aspect` plus a `limit`?
- How should historical cognates be separated from structural analogies?
- When should unresolved relation targets be concepts versus typed literals?

## Contrastive organology pass

- Locate the early-1990s **bala/balafon** study remembered as approximately equipentatonic /
  near 5-EDO; do not identify it with exact 5-EDO before finding the primary source.
- **Nyckelharpa**: historical tangent/key systems, sympathetic-string tuning, temperament, and modernization.
- **Shofar**: individual horn acoustics, resonance sets, and ritual signal categories.
- **Mbira**: compare historical measurements with community documentation of multiple tunings.
- **Amazigh**: split Tashlhiyt aḥwash/rways, Tuareg imẓad, Rif, Atlas, and diaspora cases.
- **Horn of Africa**: separate local terms, etic modal models, urban pedagogy, acoustic corpora, and instruments.
- **Xylophone/marimba family**: equipentatonic/equiheptatonic/isotonic are etic descriptors
  carrying empirical dispersion and tuning procedure, not aliases for EDO.

## Bibliographic pass

- Resolve every DOI added in the bibliographic pass against Crossref or OpenAlex, then
  raise `verified.method` from `web_search_index` and clear the filled `metadata_gaps`.
  Authorship is the most common gap: it was recorded only where a search result named it.
- The French-language entries mostly lack author names and years. They were located
  through OpenEdition, HAL and Persée, where full metadata is available directly.
- 19 works carry no DOI, URL, arXiv id or handle. Someone read them; a reader of this
  repository cannot reach them.
- Works in the reading queue (cited by no concept or claim) are either waiting to be
  attached or should be dropped. Attach only where the document is *about* the concept.
- Test the `curatorial` edges in `sources/network.yaml` against real reference lists, and
  promote or delete them. `BRIDGES_FIELD_TO` edges are the most speculative by design.
- Look for francophone work on museum organology and on Maghrebi and Horn of Africa
  repertoires; the current bibliography leans anglophone outside the Central African and
  Amazigh material.
