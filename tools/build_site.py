#!/usr/bin/env python3
"""Build the browsable site (and the glossary index) from canonical YAML.

The YAML records under `ontology/` are canonical. Everything human-facing is
derived: this script emits

    site/                a self-contained static site for GitHub Pages
    site/data.json       the whole ontology as one JSON payload
    glossary/index.md    an alphabetical Markdown view

so no definition is ever maintained in two places.

Usage:  python tools/build_site.py [--out site] [--no-glossary]
"""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import sys
from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


# --------------------------------------------------------------------------
# Loading
# --------------------------------------------------------------------------

def load_yaml(rel: str):
    return yaml.safe_load((ROOT / rel).read_text())


def load_concepts() -> list[dict]:
    concepts = []
    for path in sorted((ROOT / "ontology/concepts").glob("*.yaml")):
        data = yaml.safe_load(path.read_text())
        data["_file"] = f"ontology/concepts/{path.name}"
        concepts.append(data)
    return concepts


def load_claims() -> list[dict]:
    claims = []
    for path in sorted((ROOT / "ontology/claims").glob("*.yaml")):
        data = yaml.safe_load(path.read_text())
        data["_file"] = f"ontology/claims/{path.name}"
        claims.append(data)
    return claims


def preferred_label(concept: dict) -> str:
    """First label is treated as the display form; scripts follow it."""
    labels = concept.get("labels") or []
    return labels[0]["text"] if labels else concept["id"]


# --------------------------------------------------------------------------
# A deliberately small Markdown renderer
# --------------------------------------------------------------------------
# The docs are hand-written prose with headings, lists, tables and emphasis.
# Rendering them here keeps the site dependency-free (no JS Markdown library,
# no extra Python requirement beyond PyYAML).

INLINE_PATTERNS = [
    (re.compile(r"`([^`]+)`"), r"<code>\1</code>"),
    (re.compile(r"\*\*([^*]+)\*\*"), r"<strong>\1</strong>"),
    (re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)"), r"<em>\1</em>"),
    (re.compile(r"\[([^\]]+)\]\(([^)]+)\)"), r'<a href="\2">\1</a>'),
]


def render_inline(text: str) -> str:
    out = html.escape(text, quote=False)
    for pattern, repl in INLINE_PATTERNS:
        out = pattern.sub(repl, out)
    return out


def render_markdown(text: str) -> str:
    lines = text.splitlines()
    out: list[str] = []
    i = 0
    list_stack: list[str] = []

    def close_lists(depth: int = 0) -> None:
        while len(list_stack) > depth:
            out.append(f"</{list_stack.pop()}>")

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            close_lists()
            i += 1
            continue

        # Fenced code block: content is escaped and passed through verbatim.
        if stripped.startswith("```"):
            close_lists()
            language = stripped[3:].strip()
            i += 1
            block = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                block.append(lines[i])
                i += 1
            i += 1  # closing fence
            attr = f' class="language-{html.escape(language)}"' if language else ""
            body = html.escape("\n".join(block))
            out.append(f"<pre><code{attr}>{body}</code></pre>")
            continue

        # Table: a header row followed by a separator row of dashes.
        if (
            stripped.startswith("|")
            and i + 1 < len(lines)
            and re.fullmatch(r"\|[\s:|-]+\|", lines[i + 1].strip())
        ):
            close_lists()
            header = [c.strip() for c in stripped.strip("|").split("|")]
            out.append("<div class='table-wrap'><table><thead><tr>")
            out.extend(f"<th>{render_inline(c)}</th>" for c in header)
            out.append("</tr></thead><tbody>")
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                out.append("<tr>")
                out.extend(f"<td>{render_inline(c)}</td>" for c in cells)
                out.append("</tr>")
                i += 1
            out.append("</tbody></table></div>")
            continue

        if stripped.startswith("#"):
            close_lists()
            level = len(stripped) - len(stripped.lstrip("#"))
            out.append(f"<h{level}>{render_inline(stripped[level:].strip())}</h{level}>")
            i += 1
            continue

        if stripped in ("---", "***", "___"):
            close_lists()
            out.append("<hr>")
            i += 1
            continue

        if stripped.startswith(">"):
            close_lists()
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip().lstrip(">").strip())
                i += 1
            out.append(f"<blockquote>{render_inline(' '.join(quote))}</blockquote>")
            continue

        bullet = re.match(r"^(\s*)([-*+]|\d+\.)\s+(.*)$", line)
        if bullet:
            indent, marker, content = bullet.groups()
            tag = "ul" if marker in "-*+" else "ol"
            depth = len(indent) // 2 + 1
            if depth > len(list_stack):
                while len(list_stack) < depth:
                    out.append(f"<{tag}>")
                    list_stack.append(tag)
            else:
                close_lists(depth)
                if not list_stack:
                    out.append(f"<{tag}>")
                    list_stack.append(tag)
            # Continuation lines of the same bullet.
            i += 1
            while (
                i < len(lines)
                and lines[i].strip()
                and not re.match(r"^\s*([-*+]|\d+\.)\s+", lines[i])
                and not lines[i].strip().startswith("#")
                and lines[i].startswith(" ")
            ):
                content += " " + lines[i].strip()
                i += 1
            out.append(f"<li>{render_inline(content)}</li>")
            continue

        close_lists()
        paragraph = [stripped]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(
            r"^\s*([-*+#>]|\d+\.|\|)", lines[i]
        ):
            paragraph.append(lines[i].strip())
            i += 1
        out.append(f"<p>{render_inline(' '.join(paragraph))}</p>")

    close_lists()
    return "\n".join(out)


def load_markdown_dir(rel: str) -> list[dict]:
    docs = []
    for path in sorted((ROOT / rel).glob("*.md")):
        text = path.read_text()
        first_heading = next(
            (ln.lstrip("# ").strip() for ln in text.splitlines() if ln.startswith("#")),
            path.stem.replace("-", " "),
        )
        docs.append(
            {
                "slug": path.stem,
                "title": first_heading,
                "source": f"{rel}/{path.name}",
                "html": render_markdown(text),
            }
        )
    return docs


# --------------------------------------------------------------------------
# Citations
# --------------------------------------------------------------------------

def format_work(work: dict) -> str:
    """One-line human citation; fields are sparse and vary by source type."""
    bits = []
    author = work.get("authors") or work.get("corporate_author")
    if isinstance(author, list):
        bits.append(", ".join(author))
    elif author:
        bits.append(str(author))
    if work.get("year"):
        bits.append(f"({work['year']})")
    if work.get("title"):
        bits.append(f"<em>{html.escape(work['title'])}</em>")
    tail = []
    for key in ("venue", "publisher", "collection"):
        if work.get(key):
            tail.append(str(work[key]))
    if work.get("volume"):
        vol = str(work["volume"])
        if work.get("issue"):
            vol += f"({work['issue']})"
        tail.append(vol)
    if work.get("pages"):
        tail.append(f"pp. {work['pages']}")
    if tail:
        bits.append(", ".join(tail) + ".")
    if work.get("doi"):
        doi = work["doi"]
        bits.append(f'<a href="https://doi.org/{doi}" rel="noopener">doi:{doi}</a>')
    elif work.get("arxiv"):
        arxiv = work["arxiv"]
        bits.append(
            f'<a href="https://arxiv.org/abs/{arxiv}" rel="noopener">arXiv:{arxiv}</a>'
        )
    return " ".join(bits)


def build_bibliography(concepts: list[dict], claims: list[dict]) -> tuple[dict, list[dict], dict]:
    """Works, the network drawn over them, and the vocabularies both use.

    Each work carries back-references to the concepts and claims that cite it,
    so the bibliography can be read from the literature's side as well as the
    graph's.
    """
    works = load_yaml("sources/works.yaml")["works"]
    vocab = load_yaml("sources/source-types.yaml")
    network = load_yaml("sources/network.yaml").get("edges", [])
    edge_kind = {e["id"]: e["kind"] for e in vocab["edge_types"]}

    out = {
        w["id"]: {
            **w,
            "citation": format_work(w),
            "cited_by_concepts": [],
            "cited_by_claims": [],
            "edges": [],
        }
        for w in works
    }

    for concept in concepts:
        for sense in concept["senses"]:
            for sid in sense.get("sources", []):
                if sid in out and concept["id"] not in out[sid]["cited_by_concepts"]:
                    out[sid]["cited_by_concepts"].append(concept["id"])
    for claim in claims:
        for ev in claim.get("evidence", []):
            sid = ev.get("source")
            if sid in out and claim["id"] not in out[sid]["cited_by_claims"]:
                out[sid]["cited_by_claims"].append(claim["id"])

    edges = []
    for edge in network:
        resolved = {
            **edge,
            "kind": edge_kind.get(edge["type"], "other"),
            "from_title": out[edge["from"]]["title"] if edge["from"] in out else edge["from"],
            "to_title": out[edge["to"]]["title"] if edge["to"] in out else edge["to"],
        }
        edges.append(resolved)
        # Each endpoint sees the edge from its own side.
        if edge["from"] in out:
            out[edge["from"]]["edges"].append({**resolved, "direction": "out",
                                               "other": edge["to"]})
        if edge["to"] in out:
            out[edge["to"]]["edges"].append({**resolved, "direction": "in",
                                             "other": edge["from"]})

    return out, edges, vocab


# --------------------------------------------------------------------------
# Assembly
# --------------------------------------------------------------------------

def build_payload() -> dict:
    concepts = load_concepts()
    claims = load_claims()
    relations = load_yaml("ontology/relations.yaml")["relations"]
    domains = load_yaml("ontology/domains.yaml")["domains"]
    statuses = load_yaml("ontology/epistemic-status.yaml")["statuses"]
    works, network, source_vocab = build_bibliography(concepts, claims)

    by_id = {c["id"]: c for c in concepts}
    relation_kind = {r["id"]: r["kind"] for r in relations}

    # Backlinks let a concept show who points at it, not only where it points.
    backlinks: dict[str, list[dict]] = {cid: [] for cid in by_id}
    for concept in concepts:
        for sense in concept["senses"]:
            for rel in sense.get("relations", []):
                target = rel["target"]
                if target in backlinks:
                    backlinks[target].append(
                        {"from": concept["id"], "relation": rel["relation"]}
                    )

    claims_by_concept: dict[str, list[str]] = {cid: [] for cid in by_id}
    for claim in claims:
        for endpoint in ("subject", "object"):
            cid = claim[endpoint]
            if cid in claims_by_concept and claim["id"] not in claims_by_concept[cid]:
                claims_by_concept[cid].append(claim["id"])

    out_concepts = []
    for concept in concepts:
        cid = concept["id"]
        senses = concept["senses"]
        flat_domains = sorted({d for s in senses for d in s.get("domains", [])})
        flat_statuses = sorted({s_ for s in senses for s_ in s.get("epistemic_status", [])})
        review = next((s.get("review_status") for s in senses if s.get("review_status")), None)
        out_concepts.append(
            {
                "id": cid,
                "label": preferred_label(concept),
                "labels": concept.get("labels", []),
                "senses": [
                    {
                        "id": s["id"],
                        "orientation": s["orientation"],
                        "domains": s.get("domains", []),
                        "roles": s.get("roles", []),
                        "cautions": s.get("cautions", []),
                        "epistemic_status": s.get("epistemic_status", []),
                        "sources": s.get("sources", []),
                        "review_status": s.get("review_status"),
                        "relations": [
                            {
                                "relation": r["relation"],
                                "target": r["target"],
                                "kind": relation_kind.get(r["relation"], "other"),
                                "resolved": r["target"] in by_id,
                                "target_label": (
                                    preferred_label(by_id[r["target"]])
                                    if r["target"] in by_id
                                    else r["target"].replace("_", " ")
                                ),
                                "scope": r.get("scope"),
                            }
                            for r in s.get("relations", [])
                        ],
                    }
                    for s in senses
                ],
                "domains": flat_domains,
                "epistemic_status": flat_statuses,
                "review_status": review,
                "backlinks": sorted(
                    backlinks[cid], key=lambda b: (b["relation"], b["from"])
                ),
                "claims": claims_by_concept[cid],
                "file": concept["_file"],
            }
        )

    out_claims = []
    for claim in claims:
        out_claims.append(
            {
                **{k: v for k, v in claim.items() if not k.startswith("_")},
                "kind": relation_kind.get(claim["relation"], "other"),
                "subject_label": (
                    preferred_label(by_id[claim["subject"]])
                    if claim["subject"] in by_id
                    else claim["subject"].replace("_", " ")
                ),
                "object_label": (
                    preferred_label(by_id[claim["object"]])
                    if claim["object"] in by_id
                    else claim["object"].replace("_", " ")
                ),
                "subject_resolved": claim["subject"] in by_id,
                "object_resolved": claim["object"] in by_id,
                "file": claim["_file"],
            }
        )

    # Browsing order is alphabetical by display label, not by filename.
    out_concepts.sort(key=lambda c: c["label"].casefold())

    return {
        "version": load_yaml("ontology/relations.yaml").get("version", "0.2"),
        "generated": date.today().isoformat(),
        "repo": "https://github.com/enkerli/pitch-ontology",
        "domains": domains,
        "statuses": statuses,
        "relations": relations,
        "concepts": out_concepts,
        "claims": out_claims,
        "works": works,
        "network": network,
        "source_vocab": {
            "kinds": source_vocab["kinds"],
            "provider_types": source_vocab["provider_types"],
            "access_levels": source_vocab["access_levels"],
            "languages": source_vocab["languages"],
            "edge_types": source_vocab["edge_types"],
        },
        "journeys": load_markdown_dir("docs/concept-journeys"),
        "docs": [
            d
            for d in load_markdown_dir("docs")
            if d["slug"] in {
                "principles", "claim-rigor", "source-hubs", "review-queue",
                "references", "scope-and-focus", "citing-work", "pitch-and-time",
            }
        ],
    }


def write_glossary(payload: dict) -> None:
    """Regenerate the alphabetical Markdown view from the same payload."""
    rows = sorted(payload["concepts"], key=lambda c: c["label"].lower())
    lines = [
        "# Glossary index",
        "",
        "Generated by `tools/build_site.py` from the canonical YAML concept records.",
        "Do not edit by hand. **Seed** entries are provisional and should be refined",
        "against specialist sources.",
        "",
        # Deliberately no build timestamp. This file is committed, and CI checks it
        # by rebuilding and diffing: a date would make that check fail whenever the
        # run happened on a later day than the commit, which says nothing about
        # whether the records changed. Git already records when it was regenerated.
        f"{len(rows)} concepts.",
        "",
        "| Term | ID | Domains | Orientation |",
        "|---|---|---|---|",
    ]
    for concept in rows:
        orientation = concept["senses"][0]["orientation"].replace("\n", " ").strip()
        lines.append(
            f"| **{concept['label']}** | `{concept['id']}` | "
            f"{', '.join(concept['domains'])} | {orientation} |"
        )
    lines.append("")
    (ROOT / "glossary/index.md").write_text("\n".join(lines))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="site", help="output directory (default: site)")
    parser.add_argument(
        "--no-glossary", action="store_true", help="skip regenerating glossary/index.md"
    )
    args = parser.parse_args()

    payload = build_payload()

    out = ROOT / args.out
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(WEB, out)
    (out / "data.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1))
    (out / ".nojekyll").write_text("")

    if not args.no_glossary:
        write_glossary(payload)

    print(
        f"Built {out.relative_to(ROOT)}/: "
        f"{len(payload['concepts'])} concepts, {len(payload['claims'])} claims, "
        f"{len(payload['journeys'])} journeys, {len(payload['works'])} works."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
