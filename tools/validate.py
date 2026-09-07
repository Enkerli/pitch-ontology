#!/usr/bin/env python3
from pathlib import Path
import json, sys, yaml, jsonschema

ROOT = Path(__file__).resolve().parents[1]
schema = json.loads((ROOT / "schemas/concept.schema.json").read_text())
relations = {x["id"] for x in yaml.safe_load((ROOT/"ontology/relations.yaml").read_text())["relations"]}
domains = set(yaml.safe_load((ROOT/"ontology/domains.yaml").read_text())["domains"])
statuses = set(yaml.safe_load((ROOT/"ontology/epistemic-status.yaml").read_text())["statuses"])
works = yaml.safe_load((ROOT/"sources/works.yaml").read_text())["works"]
source_ids = {x["id"] for x in works}

concepts = {}
errors = []
warnings = []

for path in sorted((ROOT/"ontology/concepts").glob("*.yaml")):
    data = yaml.safe_load(path.read_text())
    try:
        jsonschema.validate(data, schema)
    except jsonschema.ValidationError as e:
        errors.append(f"{path.name}: schema: {e.message}")
        continue
    cid = data["id"]
    if cid in concepts:
        errors.append(f"{path.name}: duplicate concept id {cid}")
    concepts[cid] = path.name

    for sense in data["senses"]:
        for d in sense.get("domains", []):
            if d not in domains:
                errors.append(f"{path.name}: unknown domain {d}")
        for s in sense.get("epistemic_status", []):
            if s not in statuses:
                errors.append(f"{path.name}: unknown epistemic status {s}")
        for src in sense.get("sources", []):
            if src not in source_ids:
                errors.append(f"{path.name}: unknown source id {src}")
        for rel in sense.get("relations", []):
            if rel["relation"] not in relations:
                errors.append(f"{path.name}: unknown relation {rel['relation']}")

# Second pass: unresolved targets are warnings because the graph may deliberately
# refer to concepts queued for later population.
for path in sorted((ROOT/"ontology/concepts").glob("*.yaml")):
    data = yaml.safe_load(path.read_text())
    for sense in data.get("senses", []):
        for rel in sense.get("relations", []):
            target = rel["target"]
            if target not in concepts:
                warnings.append(f"{path.name}: unresolved target {target}")


# Validate claim files
claim_schema = json.loads((ROOT / "schemas/claim.schema.json").read_text())
for path in sorted((ROOT/"ontology/claims").glob("*.yaml")):
    data = yaml.safe_load(path.read_text())
    try:
        jsonschema.validate(data, claim_schema)
    except jsonschema.ValidationError as e:
        errors.append(f"{path.name}: claim schema: {e.message}")
        continue
    if data["relation"] not in relations:
        errors.append(f"{path.name}: unknown claim relation {data['relation']}")
    for endpoint in ("subject","object"):
        if data[endpoint] not in concepts:
            warnings.append(f"{path.name}: unresolved claim {endpoint} {data[endpoint]}")
    for ev in data.get("evidence", []):
        if ev["source"] not in source_ids:
            errors.append(f"{path.name}: unknown claim source id {ev['source']}")

# Validate the bibliographic layer: works, then the network drawn over them.
work_schema = json.loads((ROOT / "schemas/work.schema.json").read_text())
vocab = yaml.safe_load((ROOT/"sources/source-types.yaml").read_text())
edge_types = {x["id"] for x in vocab["edge_types"]}

cited_sources = set()
for path in sorted((ROOT/"ontology/concepts").glob("*.yaml")):
    for sense in (yaml.safe_load(path.read_text()).get("senses") or []):
        cited_sources.update(sense.get("sources", []))
for path in sorted((ROOT/"ontology/claims").glob("*.yaml")):
    for ev in (yaml.safe_load(path.read_text()).get("evidence") or []):
        cited_sources.add(ev["source"])

seen_work_ids = set()
for work in works:
    wid = work.get("id", "<missing id>")
    try:
        jsonschema.validate(work, work_schema)
    except jsonschema.ValidationError as e:
        errors.append(f"works.yaml [{wid}]: work schema: {e.message}")
        continue
    if wid in seen_work_ids:
        errors.append(f"works.yaml: duplicate work id {wid}")
    seen_work_ids.add(wid)

    for field, allowed in (
        ("kind", vocab["kinds"]),
        ("provider", vocab["provider_types"]),
        ("access", vocab["access_levels"]),
        ("language", vocab["languages"]),
    ):
        if field in work and work[field] not in allowed:
            errors.append(f"works.yaml [{wid}]: unknown {field} {work[field]}")
    for d in work.get("domains", []):
        if d not in domains:
            errors.append(f"works.yaml [{wid}]: unknown domain {d}")
    for gap in work.get("metadata_gaps", []):
        if gap not in vocab["metadata_gaps"]:
            errors.append(f"works.yaml [{wid}]: unknown metadata gap {gap}")

    # Retrievability and orphan reporting: warnings, because an unretrieved
    # reference is a task, not a defect in the record.
    if not any(k in work for k in ("doi", "url", "arxiv", "handle")):
        warnings.append(f"works.yaml [{wid}]: no doi, url, arxiv or handle — not retrievable")
    if wid not in cited_sources:
        warnings.append(f"works.yaml [{wid}]: not cited by any concept or claim")

network = yaml.safe_load((ROOT/"sources/network.yaml").read_text())
for i, edge in enumerate(network.get("edges", [])):
    label = f"network.yaml [{edge.get('from', '?')} -> {edge.get('to', '?')}]"
    for endpoint in ("from", "to"):
        if edge.get(endpoint) not in seen_work_ids:
            errors.append(f"{label}: unknown work id in '{endpoint}'")
    if edge.get("type") not in edge_types:
        errors.append(f"{label}: unknown edge type {edge.get('type')}")
    if edge.get("established_by") not in vocab["edge_bases"]:
        errors.append(f"{label}: unknown established_by {edge.get('established_by')}")
    if edge.get("confidence") not in ("low", "moderate", "high"):
        errors.append(f"{label}: confidence must be low, moderate or high")
    if not edge.get("basis"):
        errors.append(f"{label}: an edge must state its basis")
    if edge.get("type") == "CITES" and edge.get("established_by") != "verified_reference_list":
        errors.append(f"{label}: CITES is reserved for verified_reference_list edges")

for x in errors: print("ERROR:", x)
for x in warnings: print("WARN:", x)
print(
    f"{len(concepts)} concepts; {len(works)} works; {len(network.get('edges', []))} "
    f"bibliographic edges; {len(errors)} errors; {len(warnings)} warnings."
)
sys.exit(1 if errors else 0)
