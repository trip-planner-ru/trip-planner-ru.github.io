import { airlines } from '../data/airlines.json';
import { distanceKm } from './locations';

export { airlines };

export const airlineByCode = (code) => airlines.find((a) => a.code === code) ?? null;

export const airlinesForCity = (city) => (city?.airlines ?? []).map(airlineByCode).filter(Boolean);

// A connection is only offered when flying through the hub adds less than half the direct distance.
const MAX_DETOUR = 1.5;

/**
 * Airlines that fly from `origin` to `dest`, grouped by how:
 * - nonstop:    serves both cities and one of them is its hub
 * - connecting: serves both cities and has a hub on a sensible path between them (`via` lists those hubs)
 * - lowCost:    point-to-point carrier serving both cities — the exact route must be checked
 */
export function airlinesForRoute(origin, dest) {
  const fromOrigin = new Set(origin.airlines);
  const direct = distanceKm(origin, dest);
  const groups = { nonstop: [], connecting: [], lowCost: [] };

  for (const airline of airlinesForCity(dest)) {
    if (!fromOrigin.has(airline.code)) continue;
    if (!airline.hubs) {
      groups.lowCost.push(airline);
    } else if (airline.hubs.some((h) => h.cityId === origin.id || h.cityId === dest.id)) {
      groups.nonstop.push(airline);
    } else {
      const via = airline.hubs
        .map((h) => ({ name: h.name, ratio: (distanceKm(origin, h) + distanceKm(h, dest)) / direct }))
        .filter((h) => h.ratio < MAX_DETOUR)
        .sort((a, b) => a.ratio - b.ratio)
        .map((h) => h.name);
      if (via.length) groups.connecting.push({ ...airline, via });
    }
  }

  const byName = (a, b) => a.name.localeCompare(b.name);
  groups.nonstop.sort(byName);
  groups.connecting.sort(byName);
  groups.lowCost.sort(byName);
  return groups;
}

/**
 * Combine the saved route prediction with a live nonstop check.
 * Returns { direct, notDirect, changes } where every airline carries `predicted` ('nonstop' | 'connecting' |
 * 'lowCost' | 'none') and changes lists what the check found different from the saved list.
 */
export function applyNonstopCheck(route, check) {
  const found = new Map(check.direct.filter((d) => !d.charterOnly).map((d) => [d.code ?? d.name, d]));
  const predicted = [
    ...route.nonstop.map((a) => ({ ...a, predicted: 'nonstop' })),
    ...route.connecting.map((a) => ({ ...a, predicted: 'connecting' })),
    ...route.lowCost.map((a) => ({ ...a, predicted: 'lowCost' })),
  ];
  const direct = [];
  const notDirect = [];
  const changes = [];

  for (const airline of predicted) {
    const hit = found.get(airline.code);
    if (hit) {
      found.delete(airline.code);
      direct.push({ ...airline, seasonal: hit.seasonal });
      if (airline.predicted !== 'nonstop') changes.push({ kind: 'nowDirect', airline });
    } else {
      notDirect.push(airline);
      if (airline.predicted === 'nonstop') changes.push({ kind: 'noLongerDirect', airline });
    }
  }
  // Direct airlines the saved list didn't have for this route (some aren't in our directory at all).
  for (const hit of found.values()) {
    const known = hit.code && airlineByCode(hit.code);
    const airline = known
      ? { ...known, predicted: 'none', seasonal: hit.seasonal }
      : { code: null, name: hit.name, type: 'other', color: '#64748b', predicted: 'none', seasonal: hit.seasonal };
    direct.push(airline);
    changes.push({ kind: 'added', airline });
  }

  const byName = (a, b) => a.name.localeCompare(b.name);
  return { direct: direct.sort(byName), notDirect: notDirect.sort(byName), changes };
}
