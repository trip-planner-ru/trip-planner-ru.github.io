// Run with: npm test   (no network needed)
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { decodePolyline, journeySummary, toJourney } from '../src/lib/transit.js';
import { routeMessage } from '../src/lib/routing.js';
import { cityById } from '../src/lib/locations.js';

test('decodes encoded polylines (Google reference example)', () => {
  const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5);
  assert.deepEqual(points, [
    [38.5, -120.2],
    [40.7, -120.95],
    [43.252, -126.453],
  ]);
});

// Shaped like a Transitous v5 itinerary
const itinerary = {
  duration: 26 * 60,
  startTime: '2026-10-06T07:00:00Z',
  endTime: '2026-10-06T07:26:00Z',
  transfers: 0,
  legs: [
    { mode: 'WALK', duration: 8 * 60, from: { name: 'START' }, to: { name: 'Champ de Mars' } },
    {
      mode: 'REGIONAL_RAIL',
      routeShortName: 'C',
      routeColor: 'ffcc30',
      duration: 10 * 60,
      from: { name: 'Champ de Mars' },
      to: { name: 'Saint-Michel' },
      legGeometry: { points: '_p~iF~ps|U_ulLnnqC', precision: 5 },
    },
    { mode: 'WALK', duration: 8 * 60, from: { name: 'Saint-Michel' }, to: { name: 'END' } },
  ],
};

test('itinerary becomes steps with line, colour and shape', () => {
  const j = toJourney(itinerary);
  assert.equal(j.steps.length, 3);
  assert.equal(j.steps[1].line, 'C');
  assert.equal(j.steps[1].color, '#ffcc30');
  assert.equal(j.steps[1].coords.length, 2);
  assert.equal(journeySummary(j), '🚶 8 мин → 🚆 C · 10 мин → 🚶 8 мин');
});

test('transit message describes each leg and links legs one by one', () => {
  const journey = toJourney(itinerary);
  const stops = [
    { name: 'Эйфелева башня', lat: 48.8584, lng: 2.2945 },
    { name: 'Нотр-Дам', lat: 48.853, lng: 2.3499 },
    { name: 'Лувр', lat: 48.8606, lng: 2.3376 },
  ];
  const route = { distance: null, duration: 52 * 60, legs: [{ duration: 26 * 60, journey }, { duration: 26 * 60, journey }] };
  const text = routeMessage({ city: cityById('paris'), stops, mode: 'transit', route, departure: new Date('2026-10-06T07:00:00Z') });
  assert.match(text, /Маршрут: Париж — на общественном транспорте 🚇/);
  assert.match(text, /^≈ 52 мин$/m);
  assert.match(text, /2\. Нотр-Дам \(\+≈ 26 мин: 🚶 8 мин → 🚆 C · 10 мин → 🚶 8 мин\)/);
  assert.match(text, /1 → 2: https:\/\/www\.google\.com\/maps\/dir\/.*travelmode=transit/);
  assert.match(text, /2 → 3: https:\/\/www\.google\.com\/maps\/dir\//);
  assert.doesNotMatch(text, /waypoints/);
});
