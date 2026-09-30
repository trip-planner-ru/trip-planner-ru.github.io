// Accommodation search sites. None of them expose prices to us without a partner account, so the app shows no
// prices of its own: each tool opens the site's live search for the chosen place and dates.
//
// fills: what the link pre-fills on the site — 'all' (place, dates, guests), 'place' (dates set on the site),
// 'none' (opens the home page; type the city there).

const q = (params) => new URLSearchParams(params).toString();

export const STAY_GROUPS = [
  {
    id: 'booking',
    title: 'Сайты бронирования',
    hint: 'Номер бронируется прямо на сайте. Цены там настоящие, на ваши даты.',
  },
  {
    id: 'homes',
    title: 'Квартиры и дома',
    hint: 'Квартиры целиком или комнаты у частных хозяев — удобно для семей и долгих поездок.',
  },
  {
    id: 'compare',
    title: 'Сравнение цен',
    hint: 'Сами номера не продают: сравнивают цену одной гостиницы на многих сайтах и отправляют туда, где дешевле.',
  },
  {
    id: 'budget',
    title: 'Бюджетно',
    hint: 'Хостелы и самые дешёвые кровати.',
  },
];

export const STAY_TOOLS = [
  {
    id: 'booking',
    group: 'booking',
    name: 'Booking.com',
    color: '#003580',
    what: 'Самый большой сайт бронирования: гостиницы, апартаменты и гостевые дома почти везде.',
    bestFor: 'Самый широкий выбор в Европе. Многие номера можно отменить бесплатно и оплатить в гостинице.',
    note: 'Ищите отметку «Бесплатная отмена» и проверяйте, входит ли в цену городской налог.',
    fills: 'all',
    url: ({ place, checkIn, checkOut, guests }) =>
      `https://www.booking.com/searchresults.html?${q({ ss: place, checkin: checkIn, checkout: checkOut, group_adults: guests, no_rooms: 1, group_children: 0 })}`,
  },
  {
    id: 'expedia',
    group: 'booking',
    name: 'Expedia',
    color: '#191e3b',
    what: 'Большой туристический сайт: гостиницы, билеты и пакеты «перелёт + отель».',
    bestFor: 'Пакеты «перелёт + отель» — вместе часто дешевле. Поездки в США.',
    note: 'Дешёвые тарифы с оплатой сразу часто невозвратные — прочитайте условия тарифа до оплаты.',
    fills: 'all',
    url: ({ place, checkIn, checkOut, guests }) =>
      `https://www.expedia.com/Hotel-Search?${q({ destination: place, startDate: checkIn, endDate: checkOut, adults: guests })}`,
  },
  {
    id: 'hotelscom',
    group: 'booking',
    name: 'Hotels.com',
    color: '#d32f2f',
    what: 'Сайт бронирования гостиниц той же компании, что и Expedia.',
    bestFor: 'Накопление бонусов: баллы One Key общие с Expedia и Vrbo.',
    note: 'Обычно те же гостиницы и цены, что на Expedia — сравнивать их стоит, только если копите баллы.',
    fills: 'all',
    url: ({ place, checkIn, checkOut, guests }) =>
      `https://www.hotels.com/Hotel-Search?${q({ destination: place, startDate: checkIn, endDate: checkOut, adults: guests })}`,
  },
  {
    id: 'agoda',
    group: 'booking',
    name: 'Agoda',
    color: '#5c2d91',
    what: 'Сайт бронирования, самый сильный в Азии.',
    bestFor: 'Токио и другие поездки в Азию; частые скидки для зарегистрированных.',
    note: 'Иногда цена показана без налогов до последнего шага — сравнивайте итоговую сумму.',
    fills: 'none',
    url: () => 'https://www.agoda.com/',
  },
  {
    id: 'airbnb',
    group: 'homes',
    name: 'Airbnb',
    color: '#ff385c',
    what: 'Квартиры, дома и комнаты, которые сдают местные хозяева.',
    bestFor: 'Семьи, компании и долгие поездки, когда нужна кухня или больше места.',
    note: 'Сверху добавляются сборы за уборку и сервис — включите показ полной цены. Условия отмены у каждого хозяина свои.',
    fills: 'all',
    url: ({ place, checkIn, checkOut, guests }) =>
      `https://www.airbnb.com/s/${encodeURIComponent(place)}/homes?${q({ checkin: checkIn, checkout: checkOut, adults: guests })}`,
  },
  {
    id: 'vrbo',
    group: 'homes',
    name: 'Vrbo',
    color: '#0e3c83',
    what: 'Аренда жилья целиком, от той же компании, что и Expedia.',
    bestFor: 'Семьи и компании, которым нужен целый дом или квартира.',
    note: 'Только жильё целиком, без комнат. Меньше городских квартир, чем на Airbnb, больше домов для отдыха.',
    fills: 'all',
    url: ({ place, checkIn, checkOut, guests }) =>
      `https://www.vrbo.com/search?${q({ destination: place, startDate: checkIn, endDate: checkOut, adults: guests })}`,
  },
  {
    id: 'google',
    group: 'compare',
    name: 'Google Hotels',
    color: '#1a73e8',
    what: 'Показывает цену гостиницы сразу на многих сайтах бронирования, с картой.',
    bestFor: 'Узнать, где дешевле всего гостиница, которая вам уже понравилась.',
    note: 'Даты выберите на месте. Бронируете на сайте, который выберете из списка.',
    fills: 'place',
    url: ({ place }) => `https://www.google.com/travel/search?${q({ q: `hotels in ${place}` })}`,
  },
  {
    id: 'kayak',
    group: 'compare',
    name: 'Kayak',
    color: '#ff690f',
    what: 'Сравнивает цены на гостиницы на разных сайтах бронирования.',
    bestFor: 'Итоговые цены многих сайтов сразу и уведомления о снижении цены.',
    note: 'Ищет по всему городу — район выберите фильтром на сайте.',
    fills: 'all',
    cityOnly: true,
    url: ({ city, checkIn, checkOut, guests }) =>
      `https://www.kayak.com/hotels/${encodeURIComponent(city)}/${checkIn}/${checkOut}/${guests}adults`,
  },
  {
    id: 'trivago',
    group: 'compare',
    name: 'trivago',
    color: '#007fad',
    what: 'Сравнение цен на гостиницы.',
    bestFor: 'Быстро перепроверить, где гостиница дешевле.',
    note: 'Откроется главная страница — введите там город и даты.',
    fills: 'none',
    url: () => 'https://www.trivago.com/',
  },
  {
    id: 'hostelworld',
    group: 'budget',
    name: 'Hostelworld',
    color: '#f25621',
    what: 'Главный сайт хостелов: кровати в общих комнатах и недорогие отдельные номера.',
    bestFor: 'Путешествия в одиночку и небольшой бюджет.',
    note: 'Откроется главная страница — введите там город и даты. Проверяйте, цена за кровать или за комнату.',
    fills: 'none',
    url: () => 'https://www.hostelworld.com/',
  },
];

export const FILL_LABELS = {
  all: { text: 'Город, даты и гости уже подставлены', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  place: { text: 'Подставлен город — даты выберите на сайте', tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
  none: { text: 'Откроется главная страница — введите город', tone: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

/** Link for a tool; `district` is optional and ignored by tools that search the whole city. */
export function stayToolUrl(tool, { city, district, checkIn, checkOut, guests }) {
  const place = district && !tool.cityOnly ? `${district}, ${city.name}` : city.name;
  return tool.url({ place, city: city.name, checkIn, checkOut, guests });
}
