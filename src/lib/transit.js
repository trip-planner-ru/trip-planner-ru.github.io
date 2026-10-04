// Public-transport routes from Transitous (https://transitous.org) — a free, community-run journey planner built
// on open timetables (MOTIS). Each pair of neighbouring stops is planned as its own journey; the next journey
// starts when the previous one arrives.

const API = 'https://api.transitous.org/api/v5/plan';

/** Transitous mode → icon and Russian name. */
const MODES = {
  WALK: ['🚶', 'Пешком'],
  BUS: ['🚌', 'Автобус'],
  COACH: ['🚌', 'Автобус'],
  TRAM: ['🚊', 'Трамвай'],
  SUBWAY: ['🚇', 'Метро'],
  METRO: ['🚇', 'Метро'],
  RAIL: ['🚆', 'Поезд'],
  REGIONAL_RAIL: ['🚆', 'Электричка'],
  REGIONAL_FAST_RAIL: ['🚆', 'Электричка'],
  SUBURBAN: ['🚆', 'Электричка'],
  HIGHSPEED_RAIL: ['🚄', 'Скоростной поезд'],
  LONG_DISTANCE: ['🚆', 'Поезд'],
  NIGHT_RAIL: ['🚆', 'Ночной поезд'],
  FERRY: ['⛴️', 'Паром'],
  FUNICULAR: ['🚡', 'Фуникулёр'],
  AERIAL_LIFT: ['🚡', 'Канатная дорога'],
  CABLE_CAR: ['🚡', 'Канатная дорога'],
  AIRPLANE: ['✈️', 'Самолёт'],
};
export const modeInfo = (mode) => MODES[mode] ?? ['🚍', 'Транспорт'];

/** Decode a Google-style encoded polyline (Transitous uses precision 6) into [[lat, lng], …]. */
export function decodePolyline(encoded, precision = 6) {
  const factor = 10 ** precision;
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let shift = 0;
      let result = 0;
      let byte;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push([lat / factor, lng / factor]);
  }
  return points;
}

/** One planned journey → { duration (s), departure, arrival, steps: [{ mode, line, color, from, to, duration, headsign, coords }] }. */
export function toJourney(itinerary) {
  return {
    duration: itinerary.duration,
    departure: itinerary.startTime,
    arrival: itinerary.endTime,
    transfers: itinerary.transfers ?? 0,
    steps: itinerary.legs.map((leg) => ({
      mode: leg.mode,
      line: leg.routeShortName ?? null,
      color: leg.routeColor ? `#${leg.routeColor}` : null,
      from: leg.from?.name,
      to: leg.to?.name,
      duration: leg.duration,
      headsign: leg.headsign ?? null,
      coords: leg.legGeometry?.points ? decodePolyline(leg.legGeometry.points, leg.legGeometry.precision ?? 6) : [],
    })),
  };
}

/** Earliest-arriving journey between two points leaving at `time` (ISO string). */
async function planLeg(from, to, time, signal) {
  const params = new URLSearchParams({
    fromPlace: `${from.lat},${from.lng}`,
    toPlace: `${to.lat},${to.lng}`,
    time,
  });
  const res = await fetch(`${API}?${params}`, { signal });
  if (!res.ok) throw new Error(res.status === 429 ? 'сервис транспорта перегружен, попробуйте через минуту' : `ошибка ${res.status}`);
  const data = await res.json();
  const options = [...(data.itineraries ?? []), ...(data.direct ?? [])];
  if (!options.length) throw new Error('общественный транспорт между этими точками не найден');
  const best = options.reduce((a, b) => (new Date(b.endTime) < new Date(a.endTime) ? b : a));
  return toJourney(best);
}

/**
 * Transit route through the stops, departing at `departure` (Date).
 * Same shape as walking/driving routes (duration, legs, line) plus per-leg journeys and coloured segments.
 */
export async function fetchTransitRoute(stops, departure, signal) {
  const legs = [];
  let time = departure.toISOString();
  for (let i = 0; i < stops.length - 1; i++) {
    const journey = await planLeg(stops[i], stops[i + 1], time, signal);
    legs.push({ duration: journey.duration, journey });
    time = journey.arrival;
  }
  const segments = legs.flatMap((l) =>
    l.journey.steps
      .filter((s) => s.coords.length > 1)
      .map((s) => ({ kind: s.mode === 'WALK' ? 'walk' : 'ride', color: s.color, coords: s.coords })),
  );
  return {
    duration: (new Date(time) - departure) / 1000,
    distance: null,
    legs,
    segments,
    line: segments.flatMap((s) => s.coords),
  };
}

/** Short summary of a journey: "🚶 8 мин → 🚆 C · 10 мин → 🚶 8 мин". */
export function journeySummary(journey) {
  return journey.steps
    .map((s) => {
      const [icon] = modeInfo(s.mode);
      const minutes = Math.max(1, Math.round(s.duration / 60));
      return s.mode === 'WALK' ? `${icon} ${minutes} мин` : `${icon} ${s.line ?? modeInfo(s.mode)[1]} · ${minutes} мин`;
    })
    .join(' → ');
}
