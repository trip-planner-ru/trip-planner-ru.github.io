// Routes between saved map pins, and sharing them.
// Walking, driving, cycling: the free OpenStreetMap routing service at routing.openstreetmap.de (OSRM).
// Public transport: Transitous (see transit.js).
import { allCities, distanceKm } from './locations';
import { fetchTransitRoute, journeySummary } from './transit';

export const ROUTE_MODES = {
  foot: { label: 'Пешком', short: 'Пешком', icon: '🚶', profile: 'routed-foot', google: 'walking' },
  car: { label: 'На машине', short: 'Машина', icon: '🚗', profile: 'routed-car', google: 'driving' },
  bike: { label: 'На велосипеде', short: 'Велосипед', icon: '🚲', profile: 'routed-bike', google: 'bicycling' },
  transit: { label: 'На общественном транспорте', short: 'Транспорт', icon: '🚇', profile: null, google: 'transit' },
};

/** Google Maps directions links take an origin, a destination and up to 8 stops in between. */
export const MAX_STOPS = 10;

/** A pin belongs to the nearest city in the app within this distance. */
const CITY_RADIUS_KM = 60;

export function cityOfPin(pin) {
  let best = null;
  for (const city of allCities) {
    const d = distanceKm(pin, city);
    if (d <= CITY_RADIUS_KM && (!best || d < best.d)) best = { city, d };
  }
  return best?.city ?? null;
}

/** Pins grouped by city, in the order they were added: Map<cityId, { city, pins }>. Pins far from every city are left out. */
export function pinsByCity(pins) {
  const groups = new Map();
  for (const pin of pins) {
    const city = cityOfPin(pin);
    if (!city) continue;
    if (!groups.has(city.id)) groups.set(city.id, { city, pins: [] });
    groups.get(city.id).pins.push(pin);
  }
  return groups;
}

const coordsParam = (stops) => stops.map((s) => `${s.lng.toFixed(6)},${s.lat.toFixed(6)}`).join(';');
const BASE = 'https://routing.openstreetmap.de';

async function osrm(path, signal) {
  const res = await fetch(`${BASE}${path}`, { signal });
  if (!res.ok) throw new Error(res.status === 429 ? 'сервис маршрутов перегружен, попробуйте через минуту' : `ошибка ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error(data.code === 'NoRoute' ? 'между этими точками нет маршрута' : data.message ?? data.code);
  return data;
}

/**
 * Route through the stops in order:
 * { distance (m, null for transit), duration (s), legs: [{ distance, duration, journey? }], segments, line: [[lat, lng], …] }.
 * `departure` (Date) matters only for public transport.
 */
export async function fetchRoute(stops, mode, signal, departure = new Date()) {
  if (mode === 'transit') return fetchTransitRoute(stops, departure, signal);
  const data = await osrm(
    `/${ROUTE_MODES[mode].profile}/route/v1/driving/${coordsParam(stops)}?overview=full&geometries=geojson`,
    signal,
  );
  const [route] = data.routes;
  const line = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  return {
    distance: route.distance,
    duration: route.duration,
    legs: route.legs.map((l) => ({ distance: l.distance, duration: l.duration })),
    segments: [{ kind: 'drive', color: null, coords: line }],
    line,
  };
}

/** Same stops in the shortest visiting order, starting from the first one (transit uses walking distances). */
export async function optimizeOrder(stops, mode, signal) {
  if (stops.length < 3) return stops;
  const profile = ROUTE_MODES[mode].profile ?? ROUTE_MODES.foot.profile;
  const data = await osrm(
    `/${profile}/trip/v1/driving/${coordsParam(stops)}?source=first&destination=any&roundtrip=false&overview=false`,
    signal,
  );
  return orderFromTrip(stops, data.waypoints);
}

/** OSRM's trip answer gives each input point its position in the trip; turn that into the reordered list. */
export function orderFromTrip(stops, waypoints) {
  const ordered = [];
  waypoints.forEach((w, i) => {
    ordered[w.waypoint_index] = stops[i];
  });
  return ordered.filter(Boolean);
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} м`;
  return `${(meters / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км`;
}

export function formatTravelTime(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

/**
 * Google Maps directions link (opens the route in the app on phones).
 * Google ignores intermediate stops for public transport, so transit routes are shared leg by leg.
 */
export function googleMapsUrl(stops, mode) {
  const point = (s) => `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;
  const params = new URLSearchParams({
    api: '1',
    origin: point(stops[0]),
    destination: point(stops.at(-1)),
    travelmode: ROUTE_MODES[mode].google,
  });
  if (stops.length > 2) params.set('waypoints', stops.slice(1, -1).map(point).join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
}

export const sharesLegByLeg = (mode, stops) => mode === 'transit' && stops.length > 2;

const formatClock = (date) => new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** Text of the route for messengers. */
export function routeMessage({ city, stops, mode, route, departure }) {
  const m = ROUTE_MODES[mode];
  const total = route
    ? [route.distance != null ? formatDistance(route.distance) : null, `≈ ${formatTravelTime(route.duration)}`].filter(Boolean).join(' · ')
    : null;
  const legText = (leg) => {
    if (leg.journey) return `+≈ ${formatTravelTime(leg.duration)}: ${journeySummary(leg.journey)}`;
    return `+${formatDistance(leg.distance)} · ${formatTravelTime(leg.duration)}`;
  };
  const links = sharesLegByLeg(mode, stops)
    ? [
        'Как добраться (Google Maps):',
        ...stops.slice(1).map((s, i) => `${i + 1} → ${i + 2}: ${googleMapsUrl([stops[i], s], mode)}`),
      ]
    : ['Открыть маршрут в Google Maps:', googleMapsUrl(stops, mode)];
  const lines = [
    `🗺️ Маршрут: ${city.label} — ${m.label.toLowerCase()} ${m.icon}`,
    total,
    mode === 'transit' && departure ? `Отправление в ${formatClock(departure)}` : null,
    '',
    ...stops.map((s, i) => {
      const leg = route && i > 0 ? route.legs[i - 1] : null;
      return `${i + 1}. ${s.name}${leg ? ` (${legText(leg)})` : ''}`;
    }),
    '',
    ...links,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
