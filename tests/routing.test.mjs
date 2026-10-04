// Run with: npm test   (no network needed)
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  cityOfPin,
  formatDistance,
  formatTravelTime,
  googleMapsUrl,
  orderFromTrip,
  pinsByCity,
  routeMessage,
  whatsappUrl,
} from '../src/lib/routing.js';
import { cityById } from '../src/lib/locations.js';

const eiffel = { id: 'a', name: 'Эйфелева башня', lat: 48.8584, lng: 2.2945 };
const louvre = { id: 'b', name: 'Лувр', lat: 48.8606, lng: 2.3376 };
const notreDame = { id: 'c', name: 'Нотр-Дам', lat: 48.853, lng: 2.3499 };
const colosseum = { id: 'd', name: 'Колизей', lat: 41.8902, lng: 12.4922 };
const midSea = { id: 'e', name: 'Где-то в море', lat: 38, lng: 5 };

test('pins are grouped by their nearest city; far-away pins are left out', () => {
  assert.equal(cityOfPin(eiffel).id, 'paris');
  assert.equal(cityOfPin(midSea), null);
  const groups = pinsByCity([eiffel, colosseum, louvre, midSea]);
  assert.deepEqual([...groups.keys()], ['paris', 'rome']);
  assert.deepEqual(groups.get('paris').pins.map((p) => p.id), ['a', 'b']);
});

test('trip answer is turned into the visiting order', () => {
  // input 0 stays first, input 1 is visited last, input 2 second
  const ordered = orderFromTrip([eiffel, notreDame, louvre], [{ waypoint_index: 0 }, { waypoint_index: 2 }, { waypoint_index: 1 }]);
  assert.deepEqual(ordered.map((s) => s.id), ['a', 'b', 'c']);
});

test('distances and times read naturally in Russian', () => {
  assert.equal(formatDistance(847), '850 м');
  assert.equal(formatDistance(5300), '5,3 км');
  assert.equal(formatTravelTime(25 * 60), '25 мин');
  assert.equal(formatTravelTime(71 * 60), '1 ч 11 мин');
  assert.equal(formatTravelTime(120 * 60), '2 ч');
});

test('Google Maps link has origin, destination, stops and travel mode', () => {
  const url = new URL(googleMapsUrl([eiffel, louvre, notreDame], 'foot'));
  assert.equal(url.searchParams.get('origin'), '48.858400,2.294500');
  assert.equal(url.searchParams.get('destination'), '48.853000,2.349900');
  assert.equal(url.searchParams.get('waypoints'), '48.860600,2.337600');
  assert.equal(url.searchParams.get('travelmode'), 'walking');
  assert.equal(new URL(googleMapsUrl([eiffel, louvre], 'car')).searchParams.get('waypoints'), null);
});

test('WhatsApp message lists the stops with legs and the map link', () => {
  const route = { distance: 5300, duration: 71 * 60, legs: [{ distance: 3750, duration: 50 * 60 }, { distance: 1560, duration: 21 * 60 }] };
  const text = routeMessage({ city: cityById('paris'), stops: [eiffel, louvre, notreDame], mode: 'foot', route });
  assert.match(text, /Маршрут: Париж — пешком/);
  assert.match(text, /5,3 км · ≈ 1 ч 11 мин/);
  assert.match(text, /2\. Лувр \(\+3,8 км · 50 мин\)/);
  assert.match(text, /google\.com\/maps\/dir/);
  assert.ok(whatsappUrl(text).startsWith('https://wa.me/?text=%F0%9F%97%BA'));
});
