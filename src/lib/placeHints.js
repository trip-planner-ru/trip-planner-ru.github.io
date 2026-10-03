// Suggestions for the map search box.
// 1. Known sights of each city (src/data/place_hints.json, `npm run update:places`) — instant, Russian or English.
// 2. Photon (OpenStreetMap search made for search-as-you-type) for streets, hotels, cafés typed in Latin letters;
//    it has no Russian names, so Cyrillic queries rely on the list above.
import data from '../data/place_hints.json';
import { allCities, cityById } from './locations';

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ё/g, 'е')
    .toLowerCase()
    .trim();

const placesOf = (cityId) => data.cities[cityId] ?? [];

/** 0 = name starts with the query, 1 = a word in it does, 2 = it contains the query, null = no match. */
function matchRank(place, q) {
  let best = null;
  for (const name of [place.ru, place.en]) {
    if (!name) continue;
    const n = norm(name);
    const rank = n.startsWith(q) ? 0 : n.split(/[\s\-–«»"'(),.]+/).some((w) => w.startsWith(q)) ? 1 : n.includes(q) ? 2 : null;
    if (rank !== null && (best === null || rank < best)) best = rank;
  }
  return best;
}

const toSuggestion = (place, city) => ({
  key: `${city.id}:${place.ru}`,
  name: place.ru,
  detail: [place.kind, place.en && place.en !== place.ru ? place.en : null].filter(Boolean).join(' · '),
  cityLabel: city.label,
  lat: place.lat,
  lng: place.lng,
});

/** Best-known sights of a city, for the empty search box. */
export function popularPlaces(cityId, limit = 6) {
  const city = cityById(cityId);
  return city ? placesOf(cityId).slice(0, limit).map((p) => toSuggestion(p, city)) : [];
}

/**
 * Sights matching the query: those in `cityId` first, then other cities in the app.
 * Returns { here: Suggestion[], elsewhere: Suggestion[] }.
 */
export function suggestPlaces(query, cityId, limit = 6) {
  const q = norm(query);
  if (q.length < 2) return { here: [], elsewhere: [] };
  const ranked = (city) =>
    placesOf(city.id)
      .map((p, order) => ({ p, rank: matchRank(p, q), order }))
      .filter((x) => x.rank !== null)
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .map((x) => toSuggestion(x.p, city));

  const current = cityById(cityId);
  const here = current ? ranked(current).slice(0, limit) : [];
  const elsewhere =
    here.length >= limit
      ? []
      : allCities
          .filter((c) => c.id !== cityId)
          .flatMap(ranked)
          .slice(0, Math.min(4, limit - here.length));
  return { here, elsewhere };
}

const hasCyrillic = (s) => /[а-яё]/i.test(s);

/** Streets, hotels, cafés… near the city from Photon. Latin queries of 3+ letters only. */
export async function searchNearby(query, city, signal) {
  const q = query.trim();
  if (q.length < 3 || hasCyrillic(q)) return [];
  const d = 0.35; // ~35 km box around the city centre
  const params = new URLSearchParams({
    q,
    limit: '5',
    lat: String(city.lat),
    lon: String(city.lng),
    bbox: [city.lng - d, city.lat - d, city.lng + d, city.lat + d].join(','),
  });
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!res.ok) return [];
  const { features = [] } = await res.json();
  return features
    .filter((f) => f.properties?.name)
    .map((f) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      return {
        key: `osm:${p.osm_type}${p.osm_id}`,
        name: p.name,
        detail: [p.street && [p.street, p.housenumber].filter(Boolean).join(' '), p.city ?? p.county].filter(Boolean).join(', '),
        cityLabel: null,
        lat,
        lng,
      };
    });
}

export const PLACE_HINTS_DATE = data.generatedAt;
