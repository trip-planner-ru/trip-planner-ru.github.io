import { useEffect, useRef, useState } from 'react';
import Map, { Layer, Marker, NavigationControl, Popup, Source } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl } from 'maplibre-gl';
// MapLibre builds its worker's address at runtime, which bundlers can't follow, so hand it a bundled copy.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useTrip } from '../context/TripContext';
import { cityById } from '../lib/locations';
import { PIN_CATEGORIES } from '../lib/pins';
import MapSearch from './MapSearch';
import RoutePlanner from './RoutePlanner';
import { Button, Card, Field, inputClass } from './ui';

setWorkerUrl(maplibreWorkerUrl);

// Free vector map with 3D buildings, no key needed (https://openfreemap.org).
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const VIEW_3D = { pitch: 60, bearing: -20 };
const VIEW_2D = { pitch: 0, bearing: 0 };

// Free OSM geocoder. Its usage policy allows on-submit search, not search-as-you-type.
async function geocode(query, signal) {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '6', 'accept-language': 'ru' });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal });
  if (!res.ok) throw new Error(`Поиск не удался (ошибка ${res.status})`);
  return res.json();
}

/** Show street and place names in Russian where the map data has them, otherwise in the local language. */
function applyRussianLabels(map) {
  for (const layer of map.getStyle().layers) {
    const text = layer.layout?.['text-field'];
    if (layer.type === 'symbol' && text && JSON.stringify(text).includes('name')) {
      map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:ru'], ['get', 'name']]);
    }
  }
}

function Pin({ category, draft = false, number }) {
  const c = PIN_CATEGORIES[category] ?? PIN_CATEGORIES.other;
  return (
    <div className="relative -translate-y-[7px] cursor-pointer">
      <div className={`pin${draft ? ' pin--draft' : ''}`} style={{ background: c.color }}>
        <span>{c.emoji}</span>
      </div>
      {number != null && <span className="route-stop">{number}</span>}
    </div>
  );
}

/** GeoJSON for the route: one feature per segment, so walking and rides can be drawn differently. */
function routeGeoJson(route) {
  return {
    type: 'FeatureCollection',
    features: route.segments.map((s) => ({
      type: 'Feature',
      properties: { kind: s.kind, color: s.color ?? '#4f46e5' },
      geometry: { type: 'LineString', coordinates: s.coords.map(([lat, lng]) => [lng, lat]) },
    })),
  };
}

export default function MapTab() {
  const { search, markers, addMarker, removeMarker, mapFocus } = useTrip();
  const city = cityById(search.destinationCityId);
  const mapRef = useRef(null);
  const [is3d, setIs3d] = useState(true);
  const [popupId, setPopupId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [results, setResults] = useState([]);
  const [route, setRoute] = useState(null); // { segments, line, stopIds } drawn on the map
  const [status, setStatus] = useState({ loading: false, error: null });
  const abortRef = useRef(null);
  const draftRef = useRef(null);

  const flyTo = (lat, lng, zoom = 16) => mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 900 });

  useEffect(() => {
    if (mapFocus) flyTo(mapFocus.lat, mapFocus.lng, mapFocus.zoom);
  }, [mapFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draft) draftRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [draft?.lat, draft?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom to a newly built route (once per set of stops, not on every rebuild).
  const routeKey = route?.stopIds.join();
  useEffect(() => {
    if (!route?.line.length) return;
    const lngs = route.line.map(([, lng]) => lng);
    const lats = route.line.map(([lat]) => lat);
    mapRef.current?.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 70, maxZoom: 16, duration: 900 },
    );
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle3d() {
    const next = !is3d;
    setIs3d(next);
    mapRef.current?.easeTo({ ...(next ? VIEW_3D : VIEW_2D), duration: 800 });
  }

  async function runSearch(query) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setStatus({ loading: true, error: null });
    try {
      const found = await geocode(query, abortRef.current.signal);
      setResults(found);
      setStatus({ loading: false, error: found.length ? null : 'Ничего не найдено.' });
    } catch (err) {
      if (err.name !== 'AbortError') setStatus({ loading: false, error: err.message });
    }
  }

  function pickResult(r) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    flyTo(lat, lng);
    setDraft({ lat, lng, name: r.name || r.display_name.split(',')[0], category: 'attraction', note: '' });
  }

  function saveDraft(e) {
    e.preventDefault();
    addMarker({ ...draft, name: draft.name.trim() || 'Метка без названия' });
    setDraft(null);
  }

  const start = mapFocus ?? { lat: city.lat, lng: city.lng, zoom: 14 };
  const popupPin = markers.find((m) => m.id === popupId);
  const stopNumber = (id) => (route?.stopIds.includes(id) ? route.stopIds.indexOf(id) + 1 : null);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="relative h-[60vh] overflow-hidden lg:h-[calc(100vh-12rem)]">
        <Map
          ref={mapRef}
          mapStyle={MAP_STYLE}
          initialViewState={{ latitude: start.lat, longitude: start.lng, zoom: start.zoom ?? 15, ...VIEW_3D }}
          maxPitch={75}
          onLoad={(e) => applyRussianLabels(e.target)}
          onClick={(e) => {
            setPopupId(null);
            const { lat, lng } = e.lngLat;
            setDraft((d) => ({ name: '', category: 'attraction', note: '', ...d, lat, lng }));
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="top-left" visualizePitch />

          {route && (
            <Source id="route" type="geojson" data={routeGeoJson(route)}>
              <Layer
                id="route-casing"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 }}
              />
              <Layer
                id="route-line"
                type="line"
                filter={['!=', ['get', 'kind'], 'walk']}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-color': ['get', 'color'], 'line-width': 5 }}
              />
              <Layer
                id="route-walk"
                type="line"
                filter={['==', ['get', 'kind'], 'walk']}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-color': '#4f46e5', 'line-width': 4, 'line-dasharray': [0.2, 1.6] }}
              />
            </Source>
          )}

          {markers.map((m) => (
            <Marker
              key={m.id}
              latitude={m.lat}
              longitude={m.lng}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setPopupId(m.id);
              }}
            >
              <Pin category={m.category} number={stopNumber(m.id)} />
            </Marker>
          ))}

          {popupPin && (
            <Popup
              latitude={popupPin.lat}
              longitude={popupPin.lng}
              anchor="bottom"
              offset={44}
              closeOnClick={false}
              onClose={() => setPopupId(null)}
            >
              <p className="font-semibold">{popupPin.name}</p>
              <p className="text-xs text-slate-500">{PIN_CATEGORIES[popupPin.category]?.label}</p>
              {popupPin.note && <p className="mt-1 text-sm">{popupPin.note}</p>}
              <button
                className="mt-2 text-xs text-rose-600"
                onClick={() => {
                  removeMarker(popupPin.id);
                  setPopupId(null);
                }}
              >
                Удалить метку
              </button>
            </Popup>
          )}

          {draft && (
            <Marker latitude={draft.lat} longitude={draft.lng} anchor="bottom">
              <Pin category={draft.category} draft />
            </Marker>
          )}
        </Map>

        <button
          type="button"
          onClick={toggle3d}
          className="absolute right-3 top-3 z-10 rounded-xl bg-white/90 px-3 py-2 text-sm font-bold text-slate-800 shadow-md ring-1 ring-slate-200 backdrop-blur hover:bg-white"
          aria-pressed={is3d}
          title={is3d ? 'Плоская карта' : 'Объёмная карта'}
        >
          {is3d ? '2D' : '3D'}
        </button>
        {!draft && (
          <p className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/75 px-4 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur">
            Нажмите на карту, чтобы поставить метку · наклон и поворот — правая кнопка мыши или два пальца
          </p>
        )}
      </Card>

      <div className="space-y-4">
        {/* Raised above the cards below it, so the suggestion list isn't drawn underneath them. */}
        <Card className="relative z-20 p-4">
          <MapSearch
            city={city}
            loading={status.loading}
            onSearch={runSearch}
            onPick={({ name, lat, lng }) => {
              setResults([]);
              flyTo(lat, lng);
              setDraft({ lat, lng, name, category: 'attraction', note: '' });
            }}
          />
          {status.error && <p className="mt-2 text-sm text-rose-600">{status.error}</p>}
          {results.length > 0 && (
            <ul className="mt-3 max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm">
              {results.map((r) => (
                <li key={r.place_id}>
                  <button className="w-full px-1 py-2 text-left hover:bg-slate-50" onClick={() => pickResult(r)}>
                    <span className="font-medium">{r.name || r.display_name.split(',')[0]}</span>
                    <span className="block truncate text-xs text-slate-500">{r.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" className="mt-2 px-0" onClick={() => flyTo(city.lat, city.lng, 14)}>
            ⌖ Показать город {city.label}
          </Button>
        </Card>

        <RoutePlanner
          markers={markers}
          preferredCityId={city.id}
          onRouteChange={setRoute}
          onFocusPin={(pin) => flyTo(pin.lat, pin.lng)}
        />

        {draft && (
          <Card className="p-4 ring-2 ring-indigo-500/40">
            <form ref={draftRef} onSubmit={saveDraft} className="space-y-3">
              <h2 className="font-bold tracking-tight text-slate-900">Новая метка</h2>
              <p className="text-xs text-slate-500">
                {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
              </p>
              <Field label="Название">
                <input
                  autoFocus
                  className={inputClass}
                  value={draft.name}
                  placeholder="например, встреча у фонтана"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Тип">
                <select className={inputClass} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {Object.entries(PIN_CATEGORIES).map(([key, c]) => (
                    <option key={key} value={key}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Заметка">
                <textarea className={inputClass} rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" className="flex-1">
                  Сохранить метку
                </Button>
                <Button onClick={() => setDraft(null)}>Отмена</Button>
              </div>
            </form>
          </Card>
        )}

        <Card className="p-4">
          <h2 className="mb-2 font-bold tracking-tight text-slate-900">Сохранённые метки ({markers.length})</h2>
          {markers.length === 0 ? (
            <p className="text-sm text-slate-500">Меток пока нет. Нажмите на карту или выберите результат поиска.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {markers.map((m) => (
                <li key={m.id} className="flex items-center gap-2 py-2">
                  <button className="flex flex-1 items-center gap-2 text-left" onClick={() => flyTo(m.lat, m.lng)}>
                    <span aria-hidden>{PIN_CATEGORIES[m.category]?.emoji}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{m.name}</span>
                      {m.note && <span className="block truncate text-xs text-slate-500">{m.note}</span>}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    aria-label={`Удалить ${m.name}`}
                    onClick={() => removeMarker(m.id)}
                  >
                    ✕
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
