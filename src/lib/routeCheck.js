// Live check of nonstop routes against the "Airlines and destinations" tables on Wikipedia airport pages.
// Those tables are community-maintained and list the scheduled nonstop destinations of every airline at the airport.

const PAGE_URL = 'https://en.wikipedia.org/api/rest_v1/page/html/';
const CACHE_PREFIX = 'tp.wiki.';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_GAP_MS = 400; // be gentle: Wikipedia rate-limits bursts

const normalize = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‐-―]/g, '-')
    .toLowerCase()
    .trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Parse one airport page into [{ airline, destinations: [{ label, seasonal, charter, page? }] }]. Cargo tables are skipped. */
export function parseAirlinesAndDestinations(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const heading = doc.getElementById('Airlines_and_destinations');
  const section = heading?.closest('section');
  if (!section) return [];

  const rows = [];
  for (const table of section.querySelectorAll('table')) {
    const sub = table.closest('section')?.querySelector(':scope > h2, :scope > h3, :scope > h4');
    if (sub && /cargo/i.test(sub.textContent)) continue;

    for (const tr of table.querySelectorAll('tr')) {
      const cells = tr.querySelectorAll(':scope > td');
      if (cells.length < 2) continue;
      const airlineLink = [...cells[0].querySelectorAll('a')].find((a) => !a.closest('sup'));
      const airline = (airlineLink ?? cells[0]).textContent.trim();
      if (!airline) continue;

      // Walk the destinations cell in order; bold labels ("Seasonal:", "Charter:") apply to the links after them.
      let seasonal = false;
      let charter = false;
      const destinations = [];
      for (const el of cells[1].querySelectorAll('a, b')) {
        if (el.closest('sup')) continue;
        if (el.tagName === 'B') {
          const t = el.textContent.toLowerCase();
          seasonal = t.includes('seasonal');
          charter = t.includes('charter');
        } else if (el.textContent.trim()) {
          const dest = { label: el.textContent.trim(), seasonal, charter };
          // Link target = the destination airport's Wikipedia article (used to look up its IATA code).
          const href = el.getAttribute('href');
          if (href?.startsWith('./')) dest.page = decodeURIComponent(href.slice(2).split('#')[0]).replaceAll('_', ' ');
          destinations.push(dest);
        }
      }
      rows.push({ airline, destinations });
    }
  }
  return rows;
}

function readCache(title) {
  try {
    const hit = JSON.parse(localStorage.getItem(CACHE_PREFIX + title));
    return hit && Date.now() - hit.at < CACHE_TTL_MS ? hit : null;
  } catch {
    return null;
  }
}

function writeCache(title, rows) {
  const entry = { at: Date.now(), rows };
  try {
    localStorage.setItem(CACHE_PREFIX + title, JSON.stringify(entry));
  } catch {
    /* storage full or blocked — the check still works, just without caching */
  }
  return entry;
}

async function loadAirport(title, { force, signal }) {
  const cached = !force && readCache(title);
  if (cached) return { ...cached, fromCache: true };
  const res = await fetch(PAGE_URL + encodeURIComponent(title.replaceAll(' ', '_')), { signal });
  if (!res.ok) throw new Error(res.status === 429 ? 'Википедия перегружена, попробуйте через минуту' : `Википедия ответила ошибкой ${res.status}`);
  const rows = parseAirlinesAndDestinations(await res.text());
  if (rows.length === 0) throw new Error(`на странице «${title}» нет таблицы авиакомпаний`);
  return { ...writeCache(title, rows), fromCache: false };
}

/** Does a Wikipedia destination label ("Paris–Orly", "Newark", "Tokyo–Haneda") point to this city? */
export function labelMatchesCity(label, city) {
  const l = normalize(label);
  return [city.name, ...(city.wikiNames ?? [])].map(normalize).some((n) => l === n || l.startsWith(`${n}-`) || l.startsWith(`${n}/`));
}

/** Does a Wikipedia airline name ("Swiss International Air Lines", "easyJet Europe") belong to this airline? */
export function wikiNameMatchesAirline(wikiName, airline) {
  const w = normalize(wikiName);
  return [airline.name, ...(airline.aliases ?? [])].map(normalize).some((n) => w === n || w.startsWith(`${n} `));
}

/**
 * Check which airlines fly nonstop between `origin` and `dest`.
 * A nonstop route is listed on the airport pages at both ends, and either list can have gaps, so both sides are
 * read and combined: the origin's pages are searched for the destination city and the destination's for the origin.
 * Returns { checkedAt, sources, failed, direct: [{ name, code, seasonal, charterOnly }] } — `code` is null for airlines
 * that are not in our directory; `failed` lists airport pages that could not be loaded (the rest still count).
 */
export async function checkNonstop(origin, dest, directory, { force = false, signal } = {}) {
  const found = new Map(); // key: airline code or wiki name
  const sources = [];
  const failed = [];
  let oldest = Date.now();
  const pages = [
    ...origin.wikiAirports.map((title) => ({ title, lookFor: dest })),
    ...dest.wikiAirports.map((title) => ({ title, lookFor: origin })),
  ];

  for (const [i, { title, lookFor }] of pages.entries()) {
    let page;
    try {
      page = await loadAirport(title, { force, signal });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      failed.push({ title, reason: err.message });
      continue;
    }
    if (!page.fromCache && i < pages.length - 1) await sleep(REQUEST_GAP_MS);
    sources.push(title);
    oldest = Math.min(oldest, page.at);

    for (const row of page.rows) {
      const hits = row.destinations.filter((d) => labelMatchesCity(d.label, lookFor));
      if (hits.length === 0) continue;
      const airline = directory.find((a) => wikiNameMatchesAirline(row.airline, a));
      const key = airline?.code ?? normalize(row.airline); // Wikipedia spells some names differently across pages
      const prev = found.get(key);
      const yearRound = hits.some((h) => !h.seasonal && !h.charter);
      const scheduled = hits.some((h) => !h.charter);
      found.set(key, {
        name: airline?.name ?? row.airline,
        code: airline?.code ?? null,
        seasonal: prev ? prev.seasonal && !yearRound : !yearRound,
        charterOnly: prev ? prev.charterOnly && !scheduled : !scheduled,
      });
    }
  }
  if (sources.length === 0) throw new Error(failed[0]?.reason ?? 'не удалось связаться с Википедией');
  return { checkedAt: oldest, sources, failed, direct: [...found.values()] };
}
