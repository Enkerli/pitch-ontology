/* Pitch Ontology — a small hash-routed browser over data.json.
 *
 * No framework, no build step. Three moving parts:
 *   DATA     the payload emitted by tools/build_site.py
 *   filters  the current concept-list state (text, domains, statuses)
 *   render*  one function per view, each returning/attaching DOM
 */

let DATA = null;
const INDEX = { concepts: new Map(), claims: new Map(), journeys: new Map(), docs: new Map() };

const filters = { text: "", domains: new Set(), statuses: new Set(), seedOnly: false };

const main = document.getElementById("main");

/* ---------------------------------------------------------------- helpers */

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
};

const humanize = (s) => String(s).replace(/_/g, " ");

const conceptLink = (id, label, cls) =>
  el("a", { href: `#/concept/${id}`, class: cls || null }, label || id);

/* A work rendered as its formatted citation, linking into the bibliography. */
const sourceLink = (id) => {
  const w = DATA.works[id];
  return el("a", { href: `#/source/${id}`, class: "source-link", html: w ? w.citation : id });
};

/* --------------------------------------------------------------- concepts */

function matchesFilters(c) {
  if (filters.seedOnly && c.review_status !== "seed") return false;
  for (const d of filters.domains) if (!c.domains.includes(d)) return false;
  for (const s of filters.statuses) if (!c.epistemic_status.includes(s)) return false;
  if (!filters.text) return true;
  const q = filters.text.toLowerCase();
  const haystack = [
    c.id,
    ...c.labels.map((l) => l.text),
    ...c.senses.map((s) => s.orientation),
    ...c.senses.flatMap((s) => s.roles || []),
    ...c.domains,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function togglePill(set, value, rerender) {
  return (ev) => {
    ev.preventDefault();
    set.has(value) ? set.delete(value) : set.add(value);
    rerender();
  };
}

function renderConcepts() {
  const rerender = () => renderConcepts();
  const matched = DATA.concepts.filter(matchesFilters);

  const search = el("input", {
    type: "search",
    placeholder: "Search labels, orientations, roles…",
    value: filters.text,
    oninput: (ev) => {
      filters.text = ev.target.value;
      const listPanel = document.getElementById("concept-results");
      if (listPanel) listPanel.replaceWith(conceptResults(DATA.concepts.filter(matchesFilters)));
    },
  });

  const sidebar = el(
    "aside",
    { class: "panel filters" },
    el("section", {}, el("h2", {}, "Search"), search),
    el(
      "section",
      {},
      el("h2", {}, "Domains"),
      el(
        "div",
        { class: "pills" },
        DATA.domains.map((d) =>
          el(
            "button",
            {
              class: "pill" + (filters.domains.has(d) ? " on" : ""),
              onclick: togglePill(filters.domains, d, rerender),
            },
            humanize(d)
          )
        )
      )
    ),
    el(
      "section",
      {},
      el("h2", {}, "Epistemic status"),
      el(
        "div",
        { class: "pills" },
        DATA.statuses.map((s) =>
          el(
            "button",
            {
              class: "pill" + (filters.statuses.has(s) ? " on" : ""),
              onclick: togglePill(filters.statuses, s, rerender),
            },
            humanize(s)
          )
        )
      )
    ),
    el(
      "section",
      {},
      el("h2", {}, "Review"),
      el(
        "div",
        { class: "pills" },
        el(
          "button",
          {
            class: "pill" + (filters.seedOnly ? " on" : ""),
            onclick: (ev) => {
              ev.preventDefault();
              filters.seedOnly = !filters.seedOnly;
              rerender();
            },
          },
          "seed only"
        )
      )
    ),
    el(
      "button",
      {
        class: "reset",
        onclick: () => {
          filters.text = "";
          filters.domains.clear();
          filters.statuses.clear();
          filters.seedOnly = false;
          rerender();
        },
      },
      "Clear all filters"
    )
  );

  main.replaceChildren(el("div", { class: "split" }, sidebar, conceptResults(matched)));
}

function conceptResults(matched) {
  const list = el(
    "ul",
    { class: "entry-list" },
    matched.map((c) => {
      const sense = c.senses[0];
      return el(
        "li",
        { class: "entry" },
        el(
          "div",
          {},
          conceptLink(c.id, c.label, "entry-title"),
          el("span", { class: "id mono" }, c.id)
        ),
        el("p", {}, sense.orientation),
        el(
          "div",
          { class: "tag-row" },
          c.domains.map((d) => el("span", { class: "tag domain" }, humanize(d))),
          c.review_status === "seed" ? el("span", { class: "tag seed" }, "seed") : null
        )
      );
    })
  );

  return el(
    "section",
    { class: "panel", id: "concept-results" },
    el(
      "p",
      { class: "count" },
      `${matched.length} of ${DATA.concepts.length} concepts`
    ),
    matched.length
      ? list
      : el("p", { class: "empty" }, "No concept matches these filters.")
  );
}

/* --------------------------------------------------- one concept, in full */

function renderConcept(id) {
  const c = INDEX.concepts.get(id);
  if (!c) return renderMissing(`No concept with id “${id}”.`);

  const altLabels = c.labels.slice(1);

  const senses = c.senses.map((sense) => {
    const byKind = new Map();
    for (const rel of sense.relations || []) {
      if (!byKind.has(rel.kind)) byKind.set(rel.kind, []);
      byKind.get(rel.kind).push(rel);
    }

    return el(
      "div",
      { class: "sense" },
      c.senses.length > 1 || sense.id !== `${c.id}.seed`
        ? el("div", { class: "sense-id" }, sense.id)
        : null,
      el("p", { class: "orientation" }, sense.orientation),

      sense.roles && sense.roles.length
        ? field("Roles", el("div", { class: "tag-row" },
            sense.roles.map((r) => el("span", { class: "tag" }, humanize(r)))))
        : null,

      field(
        "Domains",
        el("div", { class: "tag-row" },
          (sense.domains || []).map((d) => el("span", { class: "tag domain" }, humanize(d))))
      ),

      sense.cautions && sense.cautions.length
        ? el(
            "div",
            { class: "field cautions" },
            el("h3", {}, "Cautions"),
            el("ul", {}, sense.cautions.map((x) => el("li", {}, x)))
          )
        : null,

      byKind.size
        ? field(
            "Relations",
            el(
              "div",
              {},
              [...byKind.entries()].map(([kind, rels]) =>
                el(
                  "div",
                  { class: "rel-group" },
                  el("div", { class: "rel-kind" }, kind),
                  el(
                    "ul",
                    { class: "rels" },
                    rels.map((r) =>
                      el(
                        "li",
                        {},
                        el("span", { class: "rel-name" }, r.relation),
                        r.resolved
                          ? conceptLink(r.target, r.target_label)
                          : el("span", { class: "unresolved" }, r.target_label)
                      )
                    )
                  )
                )
              )
            )
          )
        : null,

      field(
        "Epistemic status",
        el("div", { class: "tag-row" },
          (sense.epistemic_status || []).map((s) => el("span", { class: "tag" }, humanize(s))))
      ),

      sense.sources && sense.sources.length
        ? field(
            "Sources",
            el(
              "ul",
              { class: "plain" },
              sense.sources.map((sid) => el("li", {}, sourceLink(sid)))
            )
          )
        : null
    );
  });

  const backlinks = c.backlinks.length
    ? field(
        "Referred to by",
        el(
          "ul",
          { class: "rels" },
          c.backlinks.map((b) =>
            el(
              "li",
              {},
              el("span", { class: "rel-name" }, b.relation),
              conceptLink(b.from, INDEX.concepts.get(b.from).label)
            )
          )
        )
      )
    : null;

  const claims = c.claims.length
    ? field(
        "Claims involving this concept",
        el("div", {}, c.claims.map((cid) => renderClaim(INDEX.claims.get(cid))))
      )
    : null;

  main.replaceChildren(
    el("a", { class: "back", href: "#/concepts" }, "← All concepts"),
    el(
      "article",
      { class: "panel detail" },
      el("h2", { class: "concept-name" }, c.label),
      el("div", { class: "id mono" }, c.id),
      altLabels.length
        ? el(
            "p",
            { class: "altlabels" },
            altLabels.flatMap((l, i) => [
              i ? "  ·  " : "",
              l.text,
              el("span", { class: "lang" }, l.script ? `${l.language}/${l.script}` : l.language),
            ])
          )
        : null,
      neighbourhood(c),
      senses,
      backlinks,
      claims,
      el(
        "p",
        { class: "count", style: "margin-top:1.4rem" },
        "Canonical record: ",
        el("a", { href: `${DATA.repo}/blob/main/${c.file}`, rel: "noopener" }, c.file)
      )
    )
  );
}

function field(title, body) {
  return el("div", { class: "field" }, el("h3", {}, title), body);
}

function renderMissing(message) {
  main.replaceChildren(
    el("section", { class: "panel" }, el("p", { class: "empty" }, message),
      el("p", {}, el("a", { href: "#/concepts" }, "Back to concepts")))
  );
}

/* ------------------------------------------- local neighbourhood, drawn */

function neighbourhood(c) {
  const outgoing = c.senses
    .flatMap((s) => s.relations || [])
    .filter((r) => r.resolved)
    .map((r) => ({
      id: r.target, label: r.target_label, relation: r.relation, dir: "out",
      href: `#/concept/${r.target}`,
    }));
  const incoming = c.backlinks.map((b) => ({
    id: b.from,
    label: INDEX.concepts.get(b.from).label,
    relation: b.relation,
    dir: "in",
    href: `#/concept/${b.from}`,
  }));

  const seen = new Set();
  const nodes = [...outgoing, ...incoming].filter((n) => {
    if (seen.has(n.id + n.relation)) return false;
    seen.add(n.id + n.relation);
    return true;
  });
  return radialDiagram(c.label, nodes, `Concepts linked to ${c.label}`);
}

/* Radial layout: no physics, just an even spread around the centre. Two rings
 * keep dense neighbourhoods from colliding. Nodes are {label, relation, dir,
 * href}; dashed edges point inward. Used for concepts and for works. */
function radialDiagram(centreLabel, nodes, ariaLabel) {
  if (!nodes.length) return null;

  // Work titles run long; SVG text does not wrap, so trim for the diagram only.
  const short = (s, n = 52) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

  const W = 860;
  const H = nodes.length <= 4 ? 230 : Math.max(300, 240 + Math.floor(nodes.length / 6) * 60);
  const cx = W / 2;
  const cy = H / 2;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", ariaLabel);

  const make = (tag, attrs, text) => {
    const n = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  };

  const perRing = Math.min(nodes.length, 10);
  nodes.forEach((n, i) => {
    const ring = Math.floor(i / perRing);
    const inRing = Math.min(perRing, nodes.length - ring * perRing);
    const angle = ((i % perRing) / inRing) * Math.PI * 2 - Math.PI / 2;
    const rx = (cx - 90) * (ring ? 0.55 : 1);
    const ry = (cy - 40) * (ring ? 0.55 : 1);
    const x = cx + Math.cos(angle) * rx;
    const y = cy + Math.sin(angle) * ry;

    svg.append(
      make("line", {
        x1: cx, y1: cy, x2: x, y2: y,
        class: "edge" + (n.dir === "in" ? " incoming" : ""),
      })
    );
    svg.append(
      make("text", {
        x: cx + (x - cx) * 0.55,
        y: cy + (y - cy) * 0.55 - 3,
        class: "edge-label",
        "text-anchor": "middle",
      }, n.relation)
    );

    const link = make("a", { href: n.href });
    link.append(make("circle", { cx: x, cy: y, r: 4, class: "dot" }));
    link.append(
      make("text", {
        x, y: y + (Math.sin(angle) >= 0 ? 17 : -10),
        class: "node-label",
        "text-anchor": x < cx - 20 ? "end" : x > cx + 20 ? "start" : "middle",
      }, short(n.label))
    );
    svg.append(link);
  });

  svg.append(make("circle", { cx, cy, r: 6, class: "dot centre" }));
  svg.append(
    make("text", { x: cx, y: cy - 14, class: "node-label centre", "text-anchor": "middle" },
      short(centreLabel, 64))
  );

  return el("div", { class: "neighbourhood" }, svg);
}

/* ----------------------------------------------------------------- claims */

function renderClaim(claim) {
  const endpoint = (id, label, resolved) =>
    resolved ? conceptLink(id, label) : el("span", { class: "unresolved" }, label);

  const scope = claim.scope
    ? Object.entries(claim.scope)
        .map(([k, v]) => `${humanize(k)}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join(" · ")
    : null;

  return el(
    "article",
    { class: "claim" },
    el(
      "div",
      { class: "claim-head" },
      endpoint(claim.subject, claim.subject_label, claim.subject_resolved),
      el("span", { class: "rel-name", style: "margin:0 .5rem" }, claim.relation),
      endpoint(claim.object, claim.object_label, claim.object_resolved)
    ),
    el(
      "dl",
      {},
      claim.aspect ? [el("dt", {}, "Aspect"), el("dd", {}, claim.aspect)] : [],
      claim.limit ? [el("dt", {}, "Limit"), el("dd", {}, claim.limit)] : [],
      scope ? [el("dt", {}, "Scope"), el("dd", {}, scope)] : [],
      claim.evidence && claim.evidence.length
        ? [
            el("dt", {}, "Evidence"),
            el(
              "dd",
              {},
              el(
                "ul",
                { class: "plain" },
                claim.evidence.map((ev) =>
                  el(
                    "li",
                    {},
                    sourceLink(ev.source),
                    ev.type ? el("span", { class: "tag" }, humanize(ev.type)) : null,
                    ev.note ? el("div", { class: "note" }, ev.note) : null
                  )
                )
              )
            ),
          ]
        : [],
      claim.notes ? [el("dt", {}, "Notes"), el("dd", {}, claim.notes)] : []
    ),
    el(
      "div",
      { class: "tag-row meta" },
      el("span", { class: "tag" }, claim.claim_status),
      claim.confidence ? el("span", { class: "tag" }, `confidence: ${claim.confidence}`) : null,
      el("span", { class: "tag" }, claim.kind)
    )
  );
}

function renderClaims() {
  main.replaceChildren(
    el(
      "section",
      { class: "prose" },
      el("h1", {}, "Claims"),
      el(
        "p",
        {},
        "Comparative and cross-cultural relations are first-class records rather than " +
          "edges asserted in passing. Each carries the aspect being compared, the limit " +
          "of the comparison, its evidence, and a confidence rating."
      ),
      el("p", { class: "count" }, `${DATA.claims.length} claims`)
    ),
    el("div", {}, DATA.claims.map(renderClaim))
  );
}

/* ------------------------------------------------------- prose collections */

function renderJourneys() {
  main.replaceChildren(
    el(
      "section",
      { class: "prose" },
      el("h1", {}, "Concept journeys"),
      el(
        "p",
        {},
        "Questions that traverse the graph rather than define a term. Each journey " +
          "walks through concepts that stress-test an apparent primitive."
      )
    ),
    el(
      "div",
      { class: "cards" },
      DATA.journeys.map((j) =>
        el(
          "a",
          { class: "card", href: `#/journey/${j.slug}` },
          el("h3", {}, j.title),
          el("p", {}, firstParagraph(j.html))
        )
      )
    )
  );
}

function firstParagraph(htmlString) {
  const tmp = document.createElement("div");
  tmp.innerHTML = htmlString;
  const p = tmp.querySelector("p");
  return p ? p.textContent : "";
}

function renderProse(record, backHref, backLabel) {
  if (!record) return renderMissing("That page does not exist.");
  main.replaceChildren(
    el("a", { class: "back", href: backHref }, `← ${backLabel}`),
    el("article", { class: "panel prose", html: record.html }),
    el(
      "p",
      { class: "count" },
      "Source: ",
      el("a", { href: `${DATA.repo}/blob/main/${record.source}`, rel: "noopener" }, record.source)
    )
  );
}

/* ----------------------------------------------------------- bibliography */

const sourceFilters = {
  text: "",
  kinds: new Set(),
  providers: new Set(),
  access: new Set(),
  languages: new Set(),
  uncited: false,
};

function matchesSourceFilters(w) {
  if (sourceFilters.kinds.size && !sourceFilters.kinds.has(w.kind)) return false;
  if (sourceFilters.providers.size && !sourceFilters.providers.has(w.provider)) return false;
  if (sourceFilters.access.size && !sourceFilters.access.has(w.access || "unknown")) return false;
  if (sourceFilters.languages.size && !sourceFilters.languages.has(w.language)) return false;
  if (sourceFilters.uncited && (w.cited_by_concepts.length || w.cited_by_claims.length)) {
    return false;
  }
  if (!sourceFilters.text) return true;
  const q = sourceFilters.text.toLowerCase();
  return [
    w.id, w.title, w.venue, w.publisher, w.note,
    ...(w.authors || []), w.corporate_author || "",
    ...(w.domains || []),
  ].join(" ").toLowerCase().includes(q);
}

/* Tags that say where a document comes from and how far you can get to it. */
function sourceTags(w) {
  return el(
    "div",
    { class: "tag-row" },
    w.kind ? el("span", { class: "tag" }, humanize(w.kind)) : null,
    w.provider ? el("span", { class: "tag" }, humanize(w.provider)) : null,
    w.language ? el("span", { class: "tag" }, w.language) : null,
    w.access
      ? el("span", { class: "tag access " + w.access }, humanize(w.access))
      : el("span", { class: "tag access unknown" }, "access unknown"),
    w.spans === "both"
      ? el(
          "span",
          {
            class: "tag spans",
            title:
              "Treats pitch and time together — by its own domains, by the concepts " +
              "that lean on it, or both",
          },
          "pitch + time"
        )
      : null,
    (w.domains || []).map((d) => el("span", { class: "tag domain" }, humanize(d))),
    (w.metadata_gaps || []).length
      ? el("span", { class: "tag gap" }, `gaps: ${w.metadata_gaps.join(", ")}`)
      : null
  );
}

function sourceLinks(w) {
  const links = [];
  if (w.doi) links.push(["doi.org", `https://doi.org/${w.doi}`]);
  if (w.arxiv) links.push(["arXiv", `https://arxiv.org/abs/${w.arxiv}`]);
  if (w.url) links.push([w.doi || w.arxiv ? "publisher" : "link", w.url]);
  if (w.mirror_url) links.push(["free copy", w.mirror_url]);
  if (!links.length) return el("span", { class: "unretrievable" }, "no link recorded");
  return el(
    "span",
    { class: "link-row" },
    links.map(([label, href]) => el("a", { href, rel: "noopener" }, label))
  );
}

function renderSources() {
  const rerender = () => renderSources();
  const works = Object.values(DATA.works);
  const matched = works.filter(matchesSourceFilters);
  const v = DATA.source_vocab;

  const pillSection = (title, values, set, labelFor) =>
    el(
      "section",
      {},
      el("h2", {}, title),
      el(
        "div",
        { class: "pills" },
        values.map((value) =>
          el(
            "button",
            {
              class: "pill" + (set.has(value) ? " on" : ""),
              onclick: togglePill(set, value, rerender),
            },
            labelFor ? labelFor(value) : humanize(value)
          )
        )
      )
    );

  const sidebar = el(
    "aside",
    { class: "panel filters" },
    el(
      "section",
      {},
      el("h2", {}, "Search"),
      el("input", {
        type: "search",
        placeholder: "Title, author, venue, note…",
        value: sourceFilters.text,
        oninput: (ev) => {
          sourceFilters.text = ev.target.value;
          const panel = document.getElementById("source-results");
          if (panel) panel.replaceWith(sourceResults(works.filter(matchesSourceFilters), works));
        },
      })
    ),
    pillSection("Access", v.access_levels, sourceFilters.access),
    pillSection("Provider", v.provider_types, sourceFilters.providers),
    pillSection("Kind", v.kinds, sourceFilters.kinds),
    pillSection("Language", v.languages, sourceFilters.languages),
    el(
      "section",
      {},
      el("h2", {}, "Reading queue"),
      el(
        "div",
        { class: "pills" },
        el(
          "button",
          {
            class: "pill" + (sourceFilters.uncited ? " on" : ""),
            onclick: (ev) => {
              ev.preventDefault();
              sourceFilters.uncited = !sourceFilters.uncited;
              rerender();
            },
          },
          "not yet cited"
        )
      )
    ),
    el(
      "button",
      {
        class: "reset",
        onclick: () => {
          sourceFilters.text = "";
          sourceFilters.kinds.clear();
          sourceFilters.providers.clear();
          sourceFilters.access.clear();
          sourceFilters.languages.clear();
          sourceFilters.uncited = false;
          rerender();
        },
      },
      "Clear all filters"
    )
  );

  main.replaceChildren(
    el(
      "section",
      { class: "prose" },
      el("h1", {}, "Sources"),
      el(
        "p",
        {},
        "Academic work in French and English, museum and library documentation, " +
          "intergovernmental and non-governmental records, and the technical " +
          "specifications that define some of these concepts outright. Open access is " +
          "recorded rather than assumed, and what is missing from a record is named in " +
          "it. See ",
        el("a", { href: "#/doc/references" }, "References and the bibliographic network"),
        " for how these were verified and how far that goes."
      )
    ),
    spansPanel(),
    bridgesPanel(),
    el("div", { class: "split" }, sidebar, sourceResults(matched, works))
  );
}

function sourceResults(matched, works) {
  return el(
    "section",
    { class: "panel", id: "source-results" },
    el("p", { class: "count" }, `${matched.length} of ${works.length} works`),
    matched.length
      ? el(
          "ul",
          { class: "entry-list" },
          matched.map((w) =>
            el(
              "li",
              { class: "entry" },
              el("div", {}, el("a", {
                href: `#/source/${w.id}`, class: "entry-title", html: w.citation,
              })),
              el("div", { class: "sid mono" }, w.id),
              w.note ? el("p", {}, w.note) : null,
              sourceTags(w),
              el(
                "div",
                { class: "source-meta" },
                sourceLinks(w),
                w.cited_by_concepts.length || w.cited_by_claims.length
                  ? el(
                      "span",
                      { class: "cited" },
                      `cited by ${w.cited_by_concepts.length} concept` +
                        (w.cited_by_concepts.length === 1 ? "" : "s") +
                        (w.cited_by_claims.length
                          ? ` and ${w.cited_by_claims.length} claim` +
                            (w.cited_by_claims.length === 1 ? "" : "s")
                          : "")
                    )
                  : el("span", { class: "cited queue" }, "reading queue")
              )
            )
          )
        )
      : el("p", { class: "empty" }, "No work matches these filters.")
  );
}

/* Where literatures that rarely cite each other meet. These are the most
 * speculative edges in the network, and the ones worth arguing with. */
/* Documents that treat pitch and time as one problem.
 *
 * Computed twice over, because the two signals disagree usefully: `spans_declared`
 * reads the work's own domains, `spans_used` reads which concepts actually lean on
 * it. A work can be written as a rhythm study and end up cited by pitch records, or
 * the reverse. Either crossing puts it here. */
function spansPanel() {
  const both = Object.values(DATA.works)
    .filter((w) => w.spans === "both")
    .sort((a, b) => (a.year || 0) - (b.year || 0));
  if (!both.length) return null;
  const total = Object.keys(DATA.works).length;
  return el(
    "section",
    { class: "panel bridges" },
    el("h2", {}, "Where pitch and time meet"),
    el(
      "p",
      {},
      `${both.length} of ${total} works treat both dimensions — by their own domains, ` +
        "by the concepts that lean on them, or both. The rest of the bibliography " +
        "divides cleanly, which is the point: two literatures asking comparable " +
        "questions, and this is the whole overlap. See ",
      el("a", { href: "#/doc/pitch-and-time" }, "Pitch and time in one ontology"),
      "."
    ),
    el(
      "ul",
      { class: "plain" },
      both.map((w) =>
        el(
          "li",
          { class: "bridge" },
          el("a", {
            href: `#/source/${w.id}`,
            class: "entry-title",
            html: w.citation || w.title,
          }),
          el(
            "div",
            { class: "tag-row" },
            el(
              "span",
              { class: "tag" },
              w.spans_declared.length > 1 ? "both by domain" : "single-domain record"
            ),
            el(
              "span",
              { class: "tag" },
              w.spans_used.length > 1
                ? "leaned on from both halves"
                : "leaned on from one half"
            )
          )
        )
      )
    )
  );
}

function bridgesPanel() {
  const bridges = DATA.network.filter(
    (e) => e.type === "BRIDGES_FIELD_TO" || e.type === "CHALLENGES_ASSUMPTION_OF"
  );
  if (!bridges.length) return null;
  return el(
    "section",
    { class: "panel bridges" },
    el("h2", {}, "Where fields meet"),
    el(
      "ul",
      { class: "plain" },
      bridges.map((e) =>
        el(
          "li",
          { class: "bridge" },
          el(
            "div",
            {},
            el("a", { href: `#/source/${e.from}` }, e.from_title),
            el("span", { class: "rel-name", style: "margin:0 .4rem" }, e.type),
            el("a", { href: `#/source/${e.to}` }, e.to_title)
          ),
          el("p", {}, e.basis),
          el(
            "div",
            { class: "tag-row" },
            el("span", { class: "tag" }, humanize(e.established_by)),
            el("span", { class: "tag" }, `confidence: ${e.confidence}`)
          )
        )
      )
    )
  );
}

function renderSource(id) {
  const w = DATA.works[id];
  if (!w) return renderMissing(`No source with id “${id}”.`);

  const nodes = w.edges.map((e) => ({
    label: DATA.works[e.other] ? DATA.works[e.other].title : e.other,
    relation: e.type,
    dir: e.direction === "in" ? "in" : "out",
    href: `#/source/${e.other}`,
  }));

  const edgeList = w.edges.length
    ? field(
        "Bibliographic network",
        el(
          "ul",
          { class: "rels" },
          w.edges.map((e) =>
            el(
              "li",
              {},
              el("span", { class: "rel-name" },
                (e.direction === "in" ? "← " : "→ ") + e.type),
              el("a", { href: `#/source/${e.other}` },
                DATA.works[e.other] ? DATA.works[e.other].title : e.other),
              el("p", { class: "basis" }, e.basis),
              el(
                "div",
                { class: "tag-row" },
                el("span", { class: "tag" }, humanize(e.established_by)),
                el("span", { class: "tag" }, `confidence: ${e.confidence}`)
              )
            )
          )
        )
      )
    : null;

  const citedBy =
    w.cited_by_concepts.length || w.cited_by_claims.length
      ? field(
          "Leaned on by",
          el(
            "div",
            {},
            w.cited_by_concepts.length
              ? el(
                  "div",
                  { class: "tag-row" },
                  w.cited_by_concepts.map((cid) =>
                    conceptLink(cid, INDEX.concepts.get(cid).label)
                  )
                )
              : null,
            w.cited_by_claims.length
              ? el("div", {}, w.cited_by_claims.map((cid) =>
                  renderClaim(INDEX.claims.get(cid))))
              : null
          )
        )
      : el(
          "div",
          { class: "field" },
          el("h3", {}, "Leaned on by"),
          el("p", { class: "empty" },
            "Nothing yet — this work is in the reading queue.")
        );

  main.replaceChildren(
    el("a", { class: "back", href: "#/sources" }, "← All sources"),
    el(
      "article",
      { class: "panel detail" },
      el("h2", { class: "concept-name", html: w.citation }),
      el("div", { class: "id mono" }, w.id),
      w.note ? el("p", { class: "orientation" }, w.note) : null,
      sourceTags(w),
      el("div", { class: "field" }, el("h3", {}, "Retrieve"), sourceLinks(w)),
      w.licence ? field("Licence", el("p", {}, w.licence)) : null,
      radialDiagram(w.title, nodes, `Works linked to ${w.title}`),
      edgeList,
      citedBy,
      w.verified
        ? field(
            "Metadata checked",
            el(
              "div",
              {},
              el("p", {}, `${humanize(w.verified.method)}, ${w.verified.date}`),
              w.verified.note ? el("p", {}, w.verified.note) : null,
              w.verified.evidence
                ? el("p", {},
                    el("a", { href: w.verified.evidence, rel: "noopener" },
                      w.verified.evidence))
                : null
            )
          )
        : null
    )
  );
}

function renderAbout() {
  main.replaceChildren(
    el(
      "section",
      { class: "prose" },
      el("h1", {}, "About this project"),
      el(
        "p",
        {},
        "Preliminary work towards a situated, relational ontology and glossary for " +
          "pitch: how people and technologies perceive, categorize, organize, tune, " +
          "perform, represent and theorize it, with no tradition as the unmarked " +
          "default. It treats scale, note, mode, root, cent, MIDI note, rāga, maqām, " +
          "makam, svara, sléndro, hazzāt and dynamic tuning as historically and " +
          "practically situated objects whose overlaps are described rather than " +
          "normalized away."
      ),
      el(
        "p",
        {},
        "It is scaffolding, not a finished vocabulary. Most records are marked " +
          "seed: structurally useful, not specialist-verified. Read what follows as " +
          "a set of claims put up to be argued with."
      ),
      el(
        "p",
        {},
        `Version ${DATA.version}. ${DATA.concepts.length} concept records, ` +
          `${DATA.claims.length} claims, ${Object.keys(DATA.works).length} works, ` +
          `${DATA.journeys.length} journeys. Site generated ${DATA.generated}.`
      )
    ),
    el(
      "div",
      { class: "cards" },
      DATA.docs.map((d) =>
        el(
          "a",
          { class: "card", href: `#/doc/${d.slug}` },
          el("h3", {}, d.title),
          el("p", {}, firstParagraph(d.html))
        )
      )
    ),
    el(
      "section",
      { class: "prose", style: "margin-top:2rem" },
      el("h2", {}, "Relation vocabulary"),
      el(
        "div",
        { class: "pills" },
        DATA.relations.map((r) =>
          el("span", { class: "pill static", title: r.kind }, r.id)
        )
      )
    )
  );
}

/* ----------------------------------------------------------------- router */

const ROUTES = [
  [/^#?\/?$/, () => renderConcepts()],
  [/^#\/concepts$/, () => renderConcepts()],
  [/^#\/concept\/(.+)$/, (m) => renderConcept(m[1])],
  [/^#\/claims$/, () => renderClaims()],
  [/^#\/journeys$/, () => renderJourneys()],
  [/^#\/journey\/(.+)$/, (m) => renderProse(INDEX.journeys.get(m[1]), "#/journeys", "All journeys")],
  [/^#\/sources$/, () => renderSources()],
  [/^#\/source\/(.+)$/, (m) => renderSource(m[1])],
  [/^#\/about$/, () => renderAbout()],
  [/^#\/doc\/(.+)$/, (m) => renderProse(INDEX.docs.get(m[1]), "#/about", "About")],
];

function activeView(hash) {
  if (hash.startsWith("#/concept")) return "concepts";
  if (hash.startsWith("#/claim")) return "claims";
  if (hash.startsWith("#/journey")) return "journeys";
  if (hash.startsWith("#/source")) return "sources";
  if (hash.startsWith("#/about") || hash.startsWith("#/doc")) return "about";
  return "concepts";
}

function route() {
  const hash = location.hash || "#/concepts";
  const view = activeView(hash);
  for (const link of document.querySelectorAll("#tabs a")) {
    link.classList.toggle("active", link.dataset.view === view);
  }
  for (const [pattern, handler] of ROUTES) {
    const match = hash.match(pattern);
    if (match) {
      handler(match);
      window.scrollTo({ top: 0 });
      return;
    }
  }
  renderMissing("Unknown page.");
}

/* ------------------------------------------------------------------ boot */

fetch("data.json")
  .then((r) => r.json())
  .then((data) => {
    DATA = data;
    data.concepts.forEach((c) => INDEX.concepts.set(c.id, c));
    data.claims.forEach((c) => INDEX.claims.set(c.id, c));
    data.journeys.forEach((j) => INDEX.journeys.set(j.slug, j));
    data.docs.forEach((d) => INDEX.docs.set(d.slug, d));

    document.getElementById("footer-stats").textContent =
      `v${data.version} · ${data.concepts.length} concepts · ${data.claims.length} claims · ` +
      `${Object.keys(data.works).length} works · built ${data.generated}`;
    document.getElementById("repo-link").href = data.repo;

    window.addEventListener("hashchange", route);
    route();
  })
  .catch((err) => {
    main.replaceChildren(
      el("section", { class: "panel" },
        el("p", {}, "Could not load data.json: " + err.message),
        el("p", { class: "count" },
          "If you are viewing this from the filesystem, serve the directory instead: " ,
          el("code", {}, "python -m http.server --directory site")))
    );
  });
