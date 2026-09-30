import { useTrip } from './context/TripContext';
import AirlinesTab from './components/AirlinesTab';
import HotelsTab from './components/HotelsTab';
import MapTab from './components/MapTab';
import TripTab from './components/TripTab';
import { formatDate, plural } from './lib/format';
import { cityById } from './lib/locations';

const TABS = [
  { id: 'flights', label: 'Авиакомпании', short: 'Рейсы', icon: '✈️' },
  { id: 'hotels', label: 'Жильё', short: 'Жильё', icon: '🏨' },
  { id: 'map', label: 'Карта', short: 'Карта', icon: '🗺️' },
  { id: 'trip', label: 'Моя поездка', short: 'Поездка', icon: '🧳' },
];

export default function App() {
  const { tab, setTab, search, markers } = useTrip();
  const origin = cityById(search.originCityId);
  const destination = cityById(search.destinationCityId);
  const badge = (id) => (id === 'trip' && markers.length > 0 ? markers.length : null);

  return (
    <div className="min-h-screen pb-24 text-slate-800 sm:pb-0">
      <header className="sticky top-0 z-[1000] border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-400 text-lg shadow-md shadow-indigo-500/30"
              aria-hidden
            >
              ✈️
            </div>
            <span className="text-base font-extrabold tracking-tight text-slate-900">Планировщик поездок</span>
          </div>

          <nav className="ml-auto hidden gap-1 rounded-2xl bg-slate-900/5 p-1 sm:flex" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span aria-hidden>{t.icon}</span>
                {t.label}
                {badge(t.id) && (
                  <span className="rounded-full bg-indigo-600 px-1.5 text-[11px] leading-5 text-white">{badge(t.id)}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {origin && destination && <TripHero origin={origin} destination={destination} search={search} />}
        <div key={tab} className="animate-fade-up">
          {tab === 'flights' && <AirlinesTab />}
          {tab === 'hotels' && <HotelsTab />}
          {tab === 'map' && <MapTab />}
          {tab === 'trip' && <TripTab />}
        </div>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-400">
        Программа не показывает своих цен. Настоящие цены и наличие мест — на сайтах авиакомпаний и сервисов бронирования по
        ссылкам.
      </footer>

      {/* Phones: app-style tab bar at the bottom */}
      <nav
        className="fixed inset-x-3 bottom-3 z-[1000] grid grid-cols-4 rounded-2xl border border-white/70 bg-white/85 p-1.5 shadow-[0_12px_40px_-12px_rgb(15_23_42/0.35)] backdrop-blur-xl sm:hidden"
        role="tablist"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition ${
              tab === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
            }`}
          >
            <span className="text-lg leading-none" aria-hidden>
              {t.icon}
            </span>
            {t.short}
            {badge(t.id) && (
              <span className="absolute right-3 top-0.5 rounded-full bg-indigo-600 px-1.5 text-[10px] leading-4 text-white">
                {badge(t.id)}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Big route summary at the top of every tab. */
function TripHero({ origin, destination, search }) {
  const dates =
    search.tripType === 'round'
      ? `${formatDate(search.departDate)} — ${formatDate(search.returnDate)}`
      : `${formatDate(search.departDate)} · в одну сторону`;
  const chip = 'rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25 backdrop-blur';
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500 p-5 text-white shadow-xl shadow-indigo-500/20 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-sky-300/30 blur-3xl" aria-hidden />
      <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Ваша поездка</p>
      <div className="relative mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xl font-extrabold tracking-tight sm:text-4xl">
        <span>{origin.label}</span>
        <span className="text-white/60" aria-hidden>
          ⟶
        </span>
        <span>{destination.label}</span>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2 text-sm font-medium">
        <span className={chip}>📅 {dates}</span>
        <span className={chip}>👥 {plural(search.passengers, 'человек', 'человека', 'человек')}</span>
        <span className={chip}>
          🛫 {origin.airport} → {destination.airport}
        </span>
      </div>
    </section>
  );
}
