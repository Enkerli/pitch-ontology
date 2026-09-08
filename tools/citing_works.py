#!/usr/bin/env python3
"""Find recent literature that cites this bibliography, via OpenAlex.

`sources/network.yaml` records edges *between works already held here*. This
looks the other way: who has cited them since, and which of those citing works
are worth adding. It is a reading-list generator, not a validator, and it needs
network access — nothing in CI runs it.

The signal it ranks on is **how many of our works a citing paper cites at once**.
A paper that cites Jacoby and Arom & Fürniss and Bozkurt is engaging with the
seam this repository cares about; a paper that cites one of them may be citing it
for a passing methodological point. Review articles are flagged separately,
because a review is a cheap way into a literature this bibliography only samples.

    python tools/citing_works.py                     # defaults: since 2022
    python tools/citing_works.py --since 2024 --min-seeds 1
    python tools/citing_works.py --out docs/citing-work.md

Nothing is written into `sources/`. Deciding that a candidate belongs in the
bibliography is a human judgement, and `docs/references.md` says what the bar is.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.openalex.org"
UA = "pitch-ontology/0.2 (https://github.com/enkerli/pitch-ontology)"

# OpenAlex's own type vocabulary is thin on reviews, so fall back on the title.
REVIEW_TITLE = re.compile(
    r"\b(review|survey|state[ -]of[ -]the[ -]art|overview|systematic|"
    r"research agenda|retrospect|handbook)\b",
    re.I,
)

# Preprint servers mint a DOI per revision, so one paper can arrive as a dozen
# near-identical records. Repositories that version this way, in DOI-prefix form.
VERSIONED_PREFIX = ("10.31234/", "10.48550/", "10.31219/", "10.1101/", "10.21203/")

# Publishers deposit a book's front and back matter as separately-DOI'd chapters.
# They cite everything the book cites and are never themselves worth reading.
NON_WORK_TITLE = re.compile(
    r"^(references|bibliography|index|notes|contents|front ?matter|back ?matter|"
    r"acknowledg(e)?ments|appendix|glossary|preface|foreword|about the "
    r"(author|contributors)|list of (figures|tables|contributors))\b",
    re.I,
)


def doi_stem(c: dict) -> str:
    """DOI with any trailing version suffix removed, so `_v7` joins `_v8`."""
    doi = (c.get("doi") or "").replace("https://doi.org/", "").lower()
    return re.sub(r"[._-]v\d+$", "", doi)


def title_key(title: str) -> str:
    """Normalised title, for collapsing versions of the same document."""
    t = re.sub(r"[^a-z0-9 ]+", " ", (title or "").lower())
    return " ".join(t.split())


def dedupe(cands: list[dict], cites_ours: dict) -> list[dict]:
    """Collapse repeated versions of one document into its best record.

    Grouped on normalised title plus first author, which catches both the
    `_v7 … _v15` chains preprint servers produce and the preprint/published
    pair for the same paper. The survivor is the version of record if there is
    one, else the most-cited, else the latest — and it inherits the union of
    every version's citations of our works, since the ranking should not be
    split across a paper's own revision history.
    """
    # Two keys, because the two failure modes differ: a preprint server keeps one
    # DOI stem across revisions even when the title is rewritten, while a
    # preprint and its published version share a title but not a DOI.
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for c in cands:
        first = (c.get("authorships") or [{}])[0].get("author", {}).get(
            "display_name", ""
        )
        stem = doi_stem(c)
        key = ("doi", stem) if stem else ("title", title_key(c["display_name"]),
                                          first.lower())
        groups[key].append(c)

    # Second pass: fold the DOI-keyed groups together when title and author match.
    by_title: dict[tuple, list[dict]] = defaultdict(list)
    for members in groups.values():
        head = members[0]
        first = (head.get("authorships") or [{}])[0].get("author", {}).get(
            "display_name", ""
        )
        by_title[(title_key(head["display_name"]), first.lower())].extend(members)
    groups = by_title

    kept = []
    for members in groups.values():
        def rank(c: dict):
            doi = (c.get("doi") or "").replace("https://doi.org/", "")
            preprint = c.get("type") == "preprint" or doi.startswith(VERSIONED_PREFIX)
            return (preprint, -(c.get("cited_by_count") or 0),
                    -(c.get("publication_year") or 0))

        best = sorted(members, key=rank)[0]
        for m in members:  # the union, so a split revision history does not dilute
            cites_ours[best["id"]] |= cites_ours[m["id"]]
        if len(members) > 1:
            best["_versions"] = len(members)
        kept.append(best)
    return kept


def get(path: str, **params) -> dict:
    """One OpenAlex call, with a couple of retries. Returns {} on failure."""
    for attempt in range(3):
        try:
            r = requests.get(
                f"{API}/{path}", params=params, headers={"User-Agent": UA}, timeout=45
            )
            if r.ok:
                return r.json()
        except requests.RequestException:
            pass
        time.sleep(2 * (attempt + 1))
    return {}


def resolve_seeds(works: list[dict]) -> dict[str, dict]:
    """Map our work ids to OpenAlex ids, by DOI only.

    Deliberately DOI-only: a title search would need the by-hand rejection pass
    that `docs/references.md` describes, and a wrong seed here quietly poisons
    the whole ranking.
    """
    seeds = {}
    for w in works:
        doi = w.get("doi")
        if not doi:
            continue
        d = get(f"works/https://doi.org/{doi}")
        if d.get("id"):
            seeds[w["id"]] = {
                "openalex": d["id"],
                "short": d["id"].rsplit("/", 1)[-1],
                "title": w.get("title", ""),
                "cited_by_count": d.get("cited_by_count", 0),
            }
            print(
                f"  seed {w['id']:45s} {seeds[w['id']]['short']:12s} "
                f"cited by {d.get('cited_by_count', 0)}",
                file=sys.stderr,
            )
        else:
            print(f"  seed {w['id']:45s} UNRESOLVED ({doi})", file=sys.stderr)
    return seeds


def citing(short_id: str, since: int, cap: int) -> list[dict]:
    """Works published since `since` whose reference list includes `short_id`."""
    out, cursor = [], "*"
    while len(out) < cap:
        d = get(
            "works",
            filter=f"cites:{short_id},from_publication_date:{since}-01-01",
            select="id,doi,display_name,publication_year,type,open_access,"
            "authorships,primary_location,cited_by_count",
            per_page=200,
            cursor=cursor,
        )
        results = d.get("results") or []
        out.extend(results)
        cursor = (d.get("meta") or {}).get("next_cursor")
        if not cursor or not results:
            break
    return out[:cap]


def venue(w: dict) -> str:
    return ((w.get("primary_location") or {}).get("source") or {}).get(
        "display_name"
    ) or ""


def authors(w: dict, n: int = 3) -> str:
    names = [a["author"]["display_name"] for a in w.get("authorships", [])]
    if not names:
        return ""
    shown = "; ".join(names[:n])
    return shown + (" et al." if len(names) > n else "")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--since", type=int, default=2022, help="earliest publication year")
    ap.add_argument(
        "--min-seeds",
        type=int,
        default=2,
        help="only report works citing at least this many of ours",
    )
    ap.add_argument("--limit", type=int, default=40, help="max candidates to report")
    ap.add_argument(
        "--per-seed-cap", type=int, default=600, help="max citing works fetched per seed"
    )
    ap.add_argument("--out", default="docs/citing-work.md")
    args = ap.parse_args()

    works = yaml.safe_load((ROOT / "sources/works.yaml").read_text())["works"]
    held_dois = {w["doi"].lower() for w in works if w.get("doi")}

    print("resolving seeds…", file=sys.stderr)
    seeds = resolve_seeds(works)
    if not seeds:
        print("no seeds resolved; is the network reachable?", file=sys.stderr)
        return 1

    hits: dict[str, dict] = {}
    cites_ours = defaultdict(set)
    print(f"\nfetching citing works since {args.since}…", file=sys.stderr)
    for wid, seed in seeds.items():
        found = citing(seed["short"], args.since, args.per_seed_cap)
        print(f"  {wid:45s} {len(found):4d} citing works", file=sys.stderr)
        for c in found:
            doi = (c.get("doi") or "").replace("https://doi.org/", "").lower()
            if doi and doi in held_dois:
                continue  # already in the bibliography
            if NON_WORK_TITLE.match(c.get("display_name") or ""):
                continue  # a book's own reference list, not a work
            hits[c["id"]] = c
            cites_ours[c["id"]].add(wid)

    merged = dedupe(list(hits.values()), cites_ours)
    collapsed = len(hits) - len(merged)
    print(
        f"\n{len(hits)} distinct citing records, {collapsed} collapsed as repeat "
        f"versions of the same document",
        file=sys.stderr,
    )
    ranked = sorted(
        (c for c in merged if len(cites_ours[c["id"]]) >= args.min_seeds),
        key=lambda c: (
            -len(cites_ours[c["id"]]),
            -(c.get("cited_by_count") or 0),
            -(c.get("publication_year") or 0),
        ),
    )

    def is_review(c: dict) -> bool:
        return c.get("type") == "review" or bool(REVIEW_TITLE.search(c["display_name"]))

    reviews = [c for c in ranked if is_review(c)]
    lines = [
        "# Who has cited this bibliography since",
        "",
        "Generated by `tools/citing_works.py` from OpenAlex. **A candidate list, not a",
        "bibliography.** Nothing here has been read, and appearing on it is not an",
        "argument for inclusion — `docs/references.md` sets the bar: a work belongs in",
        "`sources/works.yaml` when a concept or claim actually leans on it.",
        "",
        f"Works published since {args.since} that cite at least {args.min_seeds} of the "
        f"{len(seeds)} DOI-bearing records in `sources/works.yaml`, ranked by how many "
        "they cite at once. Works already held here are excluded.",
        "",
        "Citing several of our records at once is the signal being ranked on: it marks a",
        "paper working across the same seam — measurement, perception, and computational",
        "description of pitch — rather than one citing a single record in passing.",
        "",
    ]

    if reviews:
        lines += [
            "## Reviews and surveys",
            "",
            "Flagged by OpenAlex work type or by title. A review is the cheapest way into",
            "a literature this bibliography only samples.",
            "",
        ]
        lines += [row(c, cites_ours) for c in reviews[: args.limit]]
        lines += ["", "## Everything else", ""]

    rest = [c for c in ranked if not is_review(c)][: args.limit]
    lines += [row(c, cites_ours) for c in rest]
    lines += [
        "",
        "---",
        "",
        f"{len(ranked)} candidates matched; {min(len(rest), args.limit)} listed here"
        + (
            f", plus {min(len(reviews), args.limit)} flagged as reviews"
            if reviews
            else ""
        )
        + f". Regenerate with `python tools/citing_works.py --since {args.since} "
        f"--min-seeds {args.min_seeds}`.",
        "",
    ]

    out = ROOT / args.out
    out.write_text("\n".join(lines))
    print(f"\nwrote {out} — {len(ranked)} candidates", file=sys.stderr)
    return 0


def row(c: dict, cites_ours: dict) -> str:
    doi = (c.get("doi") or "").replace("https://doi.org/", "")
    oa = "open" if (c.get("open_access") or {}).get("is_oa") else "closed"
    ours = ", ".join(f"`{x}`" for x in sorted(cites_ours[c["id"]]))
    bits = [f"**{c['display_name']}**"]
    if authors(c):
        bits.append(authors(c))
    versions = c.get("_versions")
    meta = " · ".join(
        x
        for x in (
            str(c.get("publication_year") or ""),
            venue(c),
            oa,
            f"{versions} versions" if versions else "",
        )
        if x
    )
    return (
        f"- {bits[0]}  \n"
        f"  {bits[1] if len(bits) > 1 else '—'}  \n"
        f"  {meta}"
        + (f" · [{doi}](https://doi.org/{doi})" if doi else "")
        + f"  \n  cites: {ours}"
    )


if __name__ == "__main__":
    raise SystemExit(main())
