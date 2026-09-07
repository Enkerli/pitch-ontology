#!/usr/bin/env python3
from pathlib import Path
import json, sys, yaml, jsonschema

ROOT = Path(__file__).resolve().parents[1]
schema = json.loads((ROOT / "schemas/concept.schema.json").read_text())
relations = {x["id"] for x in yaml.safe_load((ROOT/"ontology/relations.yaml").read_text())["relations"]}
domains = set(yaml.safe_load((ROOT/"ontology/domains.yaml").read_text())["domains"])
statuses = set(yaml.safe_load((ROOT/"ontology/epistemic-status.yaml").read_text())["statuses"])
source_ids = {x["id"] for x in yaml.safe_load((ROOT/"sources/works.yaml").read_text())["works"]}

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

for x in errors: print("ERROR:", x)
for x in warnings: print("WARN:", x)
print(f"{len(concepts)} concepts; {len(errors)} errors; {len(warnings)} unresolved-target warnings.")
sys.exit(1 if errors else 0)
