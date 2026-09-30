const pad = (n) => String(n).padStart(2, '0');

export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parseISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayISO = () => toISODate(new Date());

export const addDays = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export const nightsBetween = (from, to) =>
  Math.max(0, Math.round((parseISO(to) - parseISO(from)) / 86_400_000));

export const formatDate = (iso) =>
  parseISO(iso).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });

export const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

/** Minutes since local midnight -> "HH:MM" (wraps past midnight). */
export const formatClock = (minutes) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

export const formatMoney = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

/** Hotel stay derived from the shared trip search: check-in = departure, check-out = return (one-way trips keep their own). */
export function stayFromSearch(search) {
  const checkIn = search.departDate;
  const checkOut =
    search.tripType === 'round'
      ? search.returnDate
      : search.hotelCheckOut > checkIn
        ? search.hotelCheckOut
        : addDays(checkIn, 3);
  return { checkIn, checkOut, guests: search.passengers, nights: nightsBetween(checkIn, checkOut) };
}

/** Russian plural form: plural(n, 'ночь', 'ночи', 'ночей') → '1 ночь', '2 ночи', '5 ночей'. */
export function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  return `${n} ${word}`;
}
