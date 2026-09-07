# Glossary

The human-facing view of the ontology. Concept YAML under `ontology/` stays canonical;
everything here is generated.

`index.md` is written by `tools/build_site.py` — run it after editing concept records
rather than editing the table by hand. CI fails if the committed index has drifted from
the YAML.

Domain-based, historical, and cross-explanatory views can be added as further outputs of
the same build step, without duplicating definitions.
