import L from 'leaflet';

export const PIN_CATEGORIES = {
  attraction: { label: 'Достопримечательность', emoji: '⭐', color: '#f59e0b' },
  meetup: { label: 'Место встречи', emoji: '🤝', color: '#10b981' },
  hotel: { label: 'Жильё', emoji: '🏨', color: '#003580' },
  food: { label: 'Еда и напитки', emoji: '🍽️', color: '#ef4444' },
  other: { label: 'Другое', emoji: '📍', color: '#6366f1' },
};

const cache = new Map();

/** Leaflet divIcon per category — avoids Leaflet's default PNG icons, which break under bundlers. */
export function pinIcon(category, draft = false) {
  const key = `${category}-${draft}`;
  if (!cache.has(key)) {
    const c = PIN_CATEGORIES[category] ?? PIN_CATEGORIES.other;
    cache.set(
      key,
      L.divIcon({
        className: '',
        html: `<div class="pin${draft ? ' pin--draft' : ''}" style="background:${c.color}"><span>${c.emoji}</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -30],
      }),
    );
  }
  return cache.get(key);
}
