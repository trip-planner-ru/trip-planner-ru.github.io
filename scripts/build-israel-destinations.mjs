// Builds src/data/israel_destinations.json: every scheduled nonstop destination from Israel's international
// airports, grouped country → city → airport, with IATA codes and Russian names.
//
//   npm run update:israel
//
// Sources: the "Airlines and destinations" tables on the English Wikipedia pages of Ben Gurion (TLV) and
// Ramon (ETM), and Wikidata for IATA codes, countries and Russian names. Charter-only routes are left out.

import { readFileSync, writeFileSync } from 'node:fs';
import { DOMParser } from 'linkedom';
import { parseAirlinesAndDestinations, labelMatchesCity } from '../src/lib/routeCheck.js';

globalThis.DOMParser = DOMParser;

const ORIGINS = [
  { iata: 'TLV', page: 'Ben Gurion Airport' },
  { iata: 'ETM', page: 'Ramon Airport' },
];
const OUT = new URL('../src/data/israel_destinations.json', import.meta.url);
const LOCATIONS = new URL('../src/data/locations.json', import.meta.url);
const HEADERS = { 'User-Agent': 'TripPlanner/1.0 (https://trip-planner-ru.github.io; destinations list builder)' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res.json();
    if (res.status !== 429 || attempt === 4) throw new Error(`${res.status} for ${url}`);
    await sleep(30_000 * attempt); // rate-limited: back off and retry
  }
}

async function getPage(title) {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title.replaceAll(' ', '_'))}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} for ${title}`);
  return res.text();
}

const wiki = (params) =>
  `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
const wikidata = (params) =>
  `https://www.wikidata.org/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
const claimId = (entity, prop) => entity?.claims?.[prop]?.find((c) => c.rank !== 'deprecated')?.mainsnak?.datavalue?.value?.id;
const claimText = (entity, prop) => entity?.claims?.[prop]?.find((c) => c.rank !== 'deprecated')?.mainsnak?.datavalue?.value;
const label = (entity, lang) => entity?.labels?.[lang]?.value;

// 1. Destinations listed on each Israeli airport page ---------------------------------------------------------
const routes = new Map(); // article title → { labels, from:Set, airlines:Set, yearRound:bool }
for (const origin of ORIGINS) {
  const rows = parseAirlinesAndDestinations(await getPage(origin.page));
  console.log(`${origin.page}: ${rows.length} airlines`);
  for (const row of rows) {
    for (const d of row.destinations) {
      if (!d.page || d.charter) continue;
      const r = routes.get(d.page) ?? { label: d.label, from: new Set(), airlines: new Set(), yearRound: false };
      r.from.add(origin.iata);
      r.airlines.add(row.airline);
      r.yearRound ||= !d.seasonal;
      routes.set(d.page, r);
    }
  }
  await sleep(2000);
}
console.log(`${routes.size} destination articles`);

// 2. Article titles → Wikidata items (resolving redirects) ------------------------------------------------------
async function wikidataIds(titles) {
  const ids = new Map();
  for (const batch of chunks(titles, 50)) {
    // The API may answer in parts ("continue"); keep asking until every page has come back.
    const params = { action: 'query', redirects: '1', prop: 'pageprops', ppprop: 'wikibase_item', titles: batch.join('|') };
    let res = await getJson(wiki(params));
    const q = res.query;
    while (res.continue) {
      await sleep(1000);
      res = await getJson(wiki({ ...params, ...res.continue }));
      for (const p of res.query.pages) {
        const known = q.pages.find((x) => x.title === p.title);
        if (known && p.pageprops) known.pageprops = { ...known.pageprops, ...p.pageprops };
      }
    }
    const finalTitle = (t) => {
      const n = q.normalized?.find((x) => x.from === t)?.to ?? t;
      return q.redirects?.find((x) => x.from === n)?.to ?? n;
    };
    for (const t of batch) {
      const page = q.pages.find((p) => p.title === finalTitle(t));
      if (page?.pageprops?.wikibase_item) ids.set(t, page.pageprops.wikibase_item);
    }
    await sleep(1000);
  }
  return ids;
}
const itemByTitle = await wikidataIds([...routes.keys()]);

// Wikidata silently drops entities when an answer gets too big (country items are huge), so ask in small
// batches and then once more for anything that is still missing.
async function entities(ids, props, batchSize = 10) {
  const out = {};
  const fetchBatch = async (batch) => {
    Object.assign(out, (await getJson(wikidata({ action: 'wbgetentities', ids: batch.join('|'), props, languages: 'en|ru' }))).entities);
    await sleep(1000);
  };
  const wanted = [...new Set(ids)];
  for (const batch of chunks(wanted, batchSize)) await fetchBatch(batch);
  for (const id of wanted.filter((id) => !out[id])) await fetchBatch([id]);
  return out;
}

// 3. Airports: IATA code, country, city served -----------------------------------------------------------------
const airports = await entities([...itemByTitle.values()], 'claims|labels');
const claimIds = (entity, prop) => (entity?.claims?.[prop] ?? []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
const countryIds = Object.values(airports).map((a) => claimId(a, 'P17')).filter(Boolean);
const countries = await entities(countryIds, 'claims|labels');
const cities = await entities(Object.values(airports).flatMap((a) => claimIds(a, 'P931')), 'labels');

const norm = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// City name as the destination tables write it: "Paris–Orly" → "Paris", "Basel/Mulhouse" → "Basel".
const cityNameOf = (text) => text.split(/\s*[–\-/]\s*/)[0].trim();

// Russian city name: the "place served" item named exactly like the table's city ("Washington, D.C." counts for
// "Washington", "Washington metropolitan area" does not); failing that, the item of the English Wikipedia
// article with the city's name.
const ruByCityName = new Map();
for (const [title, r] of routes) {
  const name = cityNameOf(r.label);
  if (ruByCityName.get(name)) continue;
  const n = norm(name);
  const match = claimIds(airports[itemByTitle.get(title)], 'P931')
    .map((id) => cities[id])
    .find((c) => {
      const en = norm(label(c, 'en') ?? '');
      return en === n || en.startsWith(`${n},`);
    });
  if (label(match, 'ru')) ruByCityName.set(name, label(match, 'ru'));
}
const unmatched = [...new Set([...routes.values()].map((r) => cityNameOf(r.label)))].filter((n) => !ruByCityName.has(n));
const cityItemByName = await wikidataIds(unmatched);
const cityItems = await entities([...cityItemByName.values()], 'labels');
for (const [name, id] of cityItemByName) if (label(cityItems[id], 'ru')) ruByCityName.set(name, label(cityItems[id], 'ru'));

// 4. Group into country → city → airport ------------------------------------------------------------------------
const appCountries = JSON.parse(readFileSync(LOCATIONS, 'utf8')).countries;
const appCities = appCountries.flatMap((c) => c.cities);
const byCountry = new Map();
const skipped = [];
for (const [title, r] of routes) {
  const airport = airports[itemByTitle.get(title)];
  const iata = claimText(airport, 'P238');
  const country = countries[claimId(airport, 'P17')];
  if (!iata || !country) {
    skipped.push(title);
    continue;
  }
  // ISO code; a few countries (e.g. the Netherlands) are filed under a "Kingdom of …" item without one.
  const appCountry = appCountries.find((c) => c.nameRu === label(country, 'ru'));
  const code = claimText(country, 'P297') ?? appCountry?.code ?? claimId(airport, 'P17');
  const cityName = cityNameOf(r.label);
  const appCity = appCities.find((c) => labelMatchesCity(r.label, c));

  const entry = byCountry.get(code) ?? {
    code,
    name: appCountry?.name ?? label(country, 'en'),
    nameRu: appCountry?.nameRu ?? label(country, 'ru'),
    cities: new Map(),
  };
  // Airports of one app city (e.g. JFK and Newark for New York) are grouped together.
  const key = appCity?.id ?? cityName;
  const city = entry.cities.get(key) ?? {
    name: appCity?.name ?? cityName,
    nameRu: appCity?.nameRu ?? ruByCityName.get(cityName) ?? cityName,
    ...(appCity ? { cityId: appCity.id } : {}),
    airports: [],
  };
  // The same airport can be linked under several article titles; merge them by IATA code.
  const known = city.airports.find((a) => a.iata === iata);
  if (known) {
    known.from = [...new Set([...known.from, ...r.from])].sort().reverse();
    known.seasonal &&= !r.yearRound;
    known.airlines = [...new Set([...known.airlines, ...r.airlines])].sort((a, b) => a.localeCompare(b));
  } else {
    city.airports.push({
      iata,
      name: label(airport, 'en') ?? title,
      nameRu: label(airport, 'ru') ?? label(airport, 'en') ?? title,
      from: [...r.from].sort().reverse(), // TLV before ETM
      seasonal: !r.yearRound,
      airlines: [...r.airlines].sort((a, b) => a.localeCompare(b)),
    });
  }
  entry.cities.set(key, city);
  byCountry.set(code, entry);
}

const byRu = (a, b) => a.nameRu.localeCompare(b.nameRu, 'ru');
const result = {
  _note:
    'Generated by scripts/build-israel-destinations.mjs from Wikipedia "Airlines and destinations" tables (TLV, ETM) and Wikidata. Scheduled nonstop routes only; charters are excluded. Re-run with: npm run update:israel',
  generatedAt: new Date().toISOString().slice(0, 10),
  origins: { TLV: 'Ben Gurion Airport', ETM: 'Ramon Airport' },
  countries: [...byCountry.values()]
    .map((c) => ({
      ...c,
      cities: [...c.cities.values()].map((city) => ({ ...city, airports: city.airports.sort((a, b) => a.iata.localeCompare(b.iata)) })).sort(byRu),
    }))
    .sort(byRu),
};
writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

const nCities = result.countries.reduce((n, c) => n + c.cities.length, 0);
console.log(`Wrote ${result.countries.length} countries, ${nCities} cities.`);
if (skipped.length) console.log(`Skipped (no IATA code or country on Wikidata): ${skipped.join(', ')}`);
