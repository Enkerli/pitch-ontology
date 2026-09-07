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
              sense.sources.map((sid) => {
                const w = DATA.works[sid];
                return el("li", { html: w ? w.citation : sid });
              })
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
    .map((r) => ({ id: r.target, label: r.target_label, relation: r.relation, dir: "out" }));
  const incoming = c.backlinks.map((b) => ({
    id: b.from,
    label: INDEX.concepts.get(b.from).label,
    relation: b.relation,
    dir: "in",
  }));

  const seen = new Set();
  const nodes = [...outgoing, ...incoming].filter((n) => {
    if (seen.has(n.id + n.relation)) return false;
    seen.add(n.id + n.relation);
    return true;
  });
  if (!nodes.length) return null;

  // Radial layout: no physics, just an even spread around the centre. Two
  // rings keep dense neighbourhoods from colliding.
  const W = 860;
  const H = nodes.length <= 4 ? 230 : Math.max(300, 240 + Math.floor(nodes.length / 6) * 60);
  const cx = W / 2;
  const cy = H / 2;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Concepts linked to ${c.label}`);

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

    const link = make("a", { href: `#/concept/${n.id}` });
    link.append(make("circle", { cx: x, cy: y, r: 4, class: "dot" }));
    link.append(
      make("text", {
        x, y: y + (Math.sin(angle) >= 0 ? 17 : -10),
        class: "node-label",
        "text-anchor": x < cx - 20 ? "end" : x > cx + 20 ? "start" : "middle",
      }, n.label)
    );
    svg.append(link);
  });

  svg.append(make("circle", { cx, cy, r: 6, class: "dot centre" }));
  svg.append(
    make("text", { x: cx, y: cy - 14, class: "node-label centre", "text-anchor": "middle" }, c.label)
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
                claim.evidence.map((ev) => {
                  const w = DATA.works[ev.source];
                  return el(
                    "li",
                    { html: (w ? w.citation : ev.source) + (ev.type ? ` <span class="tag">${humanize(ev.type)}</span>` : "") }
                  );
                })
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

function renderSources() {
  const works = Object.entries(DATA.works);
  main.replaceChildren(
    el(
      "section",
      { class: "prose" },
      el("h1", {}, "Sources"),
      el(
        "p",
        {},
        "Seed bibliography. Every substantial historical or ethnographic claim should " +
          "be traceable to one of these; museum and community records are provenance " +
          "types, not truth statuses."
      ),
      el("p", { class: "count" }, `${works.length} works`)
    ),
    el(
      "section",
      { class: "panel" },
      works.map(([id, w]) =>
        el(
          "div",
          { class: "source" },
          el("div", { html: w.citation }),
          el("div", { class: "sid" }, id),
          w.note ? el("div", { class: "note" }, w.note) : null
        )
      )
    )
  );
}

function renderAbout() {
  main.replaceChildren(
    el(
      "section",
      { class: "prose" },
      el("h1", {}, "About this ontology"),
      el(
        "p",
        {},
        "A situated, relational ontology and glossary for pitch: how humans and " +
          "technologies perceive, categorize, organize, tune, perform, represent and " +
          "theorize it. It treats scale, note, mode, root, cent, MIDI note, rāga, maqām, " +
          "makam, svara, sléndro, hazzāt and dynamic tuning as historically and " +
          "practically situated objects whose overlaps are described rather than " +
          "normalized away."
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
