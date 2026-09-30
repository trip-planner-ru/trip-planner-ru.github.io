import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { addDays, todayISO } from '../lib/format';

const TripContext = createContext(null);
const TAB_IDS = ['flights', 'hotels', 'map', 'trip'];

// A tab named in the address wins over the one remembered from last time.
if (typeof window !== 'undefined' && TAB_IDS.includes(window.location.hash.slice(1))) {
  try {
    localStorage.setItem('tp.tab', JSON.stringify(window.location.hash.slice(1)));
  } catch {
    /* storage blocked — the remembered tab is used */
  }
}

const defaultSearch = () => ({
  originCityId: 'tel-aviv',
  destinationCityId: 'paris',
  tripType: 'round',
  departDate: addDays(todayISO(), 14),
  returnDate: addDays(todayISO(), 21),
  passengers: 2,
});

export function TripProvider({ children }) {
  const [tab, setTab] = useLocalStorage('tp.tab', 'flights');

  // Each tab has its own address (#flights, #hotels, #map, #trip), so a tab can be bookmarked or opened directly.
  // The address on page load is applied before the app starts (see below); this handles later changes.
  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (TAB_IDS.includes(id)) setTab(id);
    };
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [setTab]);
  useEffect(() => {
    if (window.location.hash.slice(1) !== tab) window.history.replaceState(null, '', `#${tab}`);
  }, [tab]);
  const [search, setSearch] = useLocalStorage('tp.search', defaultSearch);
  const [markers, setMarkers] = useLocalStorage('tp.markers', []);
  const [mapFocus, setMapFocus] = useState(null);

  // Dates restored from an old session may be in the past.
  useEffect(() => {
    if (search.departDate < todayISO()) {
      const { departDate, returnDate } = defaultSearch();
      setSearch((s) => ({ ...s, departDate, returnDate }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => {
    return {
      tab,
      setTab,
      search,
      updateSearch: (patch) => setSearch((s) => ({ ...s, ...patch })),

      markers,
      addMarker: (m) => setMarkers((list) => [...list, { ...m, id: crypto.randomUUID(), createdAt: Date.now() }]),
      removeMarker: (id) => setMarkers((list) => list.filter((m) => m.id !== id)),

      mapFocus,
      showOnMap: (lat, lng, zoom = 16) => {
        setMapFocus({ lat, lng, zoom, at: Date.now() });
        setTab('map');
      },

      clearTrip: () => {
        setMarkers([]);
      },
    };
  }, [tab, search, markers, mapFocus, setTab, setSearch, setMarkers]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export const useTrip = () => useContext(TripContext);
