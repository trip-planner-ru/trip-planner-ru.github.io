// Routes between saved map pins, and sharing them.
// Routing: the free OpenStreetMap routing service at routing.openstreetmap.de (OSRM; foot, car and bike profiles).
import { allCities, distanceKm } from './locations';

export const ROUTE_MODES = {
  foot: { label: 'Пешком', short: 'Пешком', icon: '🚶', profile: 'routed-foot', google: 'walking' },
  car: { label: 'На машине', short: 'Машина', icon: '🚗', profile: 'routed-car', google: 'driving' },
  bike: { label: 'На велосипеде', short: 'Велосипед', icon: '🚲', profile: 'routed-bike', google: 'bicycling' },
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

/** Route through the stops in order: { distance (m), duration (s), legs: [{ distance, duration }], line: [[lat, lng], …] }. */
export async function fetchRoute(stops, mode, signal) {
  const data = await osrm(
    `/${ROUTE_MODES[mode].profile}/route/v1/driving/${coordsParam(stops)}?overview=full&geometries=geojson`,
    signal,
  );
  const [route] = data.routes;
  return {
    distance: route.distance,
    duration: route.duration,
    legs: route.legs.map((l) => ({ distance: l.distance, duration: l.duration })),
    line: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  };
}

/** Same stops in the shortest visiting order, starting from the first one. */
export async function optimizeOrder(stops, mode, signal) {
  if (stops.length < 3) return stops;
  const data = await osrm(
    `/${ROUTE_MODES[mode].profile}/trip/v1/driving/${coordsParam(stops)}?source=first&destination=any&roundtrip=false&overview=false`,
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

/** Google Maps directions link (opens the route in the app on phones). */
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

/** Text of the route for messengers. */
export function routeMessage({ city, stops, mode, route }) {
  const m = ROUTE_MODES[mode];
  const lines = [
    `🗺️ Маршрут: ${city.label} — ${m.label.toLowerCase()} ${m.icon}`,
    route ? `${formatDistance(route.distance)} · ≈ ${formatTravelTime(route.duration)}` : null,
    '',
    ...stops.map((s, i) => {
      const leg = route && i > 0 ? route.legs[i - 1] : null;
      return `${i + 1}. ${s.name}${leg ? ` (+${formatDistance(leg.distance)} · ${formatTravelTime(leg.duration)})` : ''}`;
    }),
    '',
    'Открыть маршрут в Google Maps:',
    googleMapsUrl(stops, mode),
  ];
  return lines.filter((l) => l !== null).join('\n');
}

export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
