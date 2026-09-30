import { useTrip } from '../context/TripContext';
import { formatDate, plural, stayFromSearch } from '../lib/format';
import { cityById } from '../lib/locations';
import { PIN_CATEGORIES } from '../lib/pins';
import { Button, Card, EmptyState, SectionTitle } from './ui';

export default function TripTab() {
  const { search, markers, removeMarker, showOnMap, clearTrip, setTab } = useTrip();
  const origin = cityById(search.originCityId);
  const dest = cityById(search.destinationCityId);
  const { nights } = stayFromSearch(search);
  const isEmpty = markers.length === 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Маршрут" value={`${origin.label} → ${dest.label}`} />
        <Stat
          label="Даты"
          value={
            search.tripType === 'round'
              ? `${formatDate(search.departDate)} – ${formatDate(search.returnDate)}`
              : `${formatDate(search.departDate)} (в одну сторону)`
          }
        />
        <Stat label="Путешественники" value={plural(search.passengers, 'человек', 'человека', 'человек')} />
        <Stat label="Ночей" value={nights} />
      </div>

      {isEmpty ? (
        <EmptyState icon="📍" title="Пока ничего не сохранено">
          Ставьте метки на карте (что посмотреть, где встретиться, где жить) — они появятся здесь и сохранятся после перезагрузки.
        </EmptyState>
      ) : (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            className="text-rose-600"
            onClick={() => window.confirm('Удалить все сохранённые метки?') && clearTrip()}
          >
            Очистить всё
          </Button>
        </div>
      )}

      <Section title="Метки на карте" count={markers.length} onAdd={() => setTab('map')}>
        <Card className="divide-y divide-slate-100">
          {markers.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span aria-hidden className="text-lg">
                {PIN_CATEGORIES[m.category]?.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {PIN_CATEGORIES[m.category]?.label}
                  {m.note && ` · ${m.note}`}
                </p>
              </div>
              <Button onClick={() => showOnMap(m.lat, m.lng)}>Показать</Button>
              <Button variant="ghost" onClick={() => removeMarker(m.id)}>
                ✕
              </Button>
            </div>
          ))}
        </Card>
      </Section>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

function Section({ title, count, onAdd, children }) {
  if (count === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle count={count}>{title}</SectionTitle>
        <Button variant="ghost" onClick={onAdd}>
          + Добавить
        </Button>
      </div>
      {children}
    </section>
  );
}
