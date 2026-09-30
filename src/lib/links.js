// Outbound deep links. Everything opens in a new tab (see ExternalLink).

export function bookingCityUrl(city, district, { checkIn, checkOut, guests }) {
  const params = new URLSearchParams({
    ss: district ? `${district}, ${city.name}` : city.name,
    checkin: checkIn,
    checkout: checkOut,
    group_adults: String(guests),
    no_rooms: '1',
  });
  return `https://www.booking.com/searchresults.html?${params}`;
}

export function googleFlightsUrl(from, to, { tripType, departDate, returnDate, passengers }, airlineName) {
  const people = `${passengers} adult${passengers > 1 ? 's' : ''}`;
  const dates = tripType === 'round' ? `on ${departDate} returning ${returnDate}` : `on ${departDate} one way`;
  const q = `Flights from ${from} to ${to} ${dates} for ${people}${airlineName ? ` on ${airlineName}` : ''}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

export function skyscannerUrl(from, to, { tripType, departDate, returnDate, passengers }) {
  const yymmdd = (iso) => iso.slice(2).replaceAll('-', '');
  const dates = tripType === 'round' ? `${yymmdd(departDate)}/${yymmdd(returnDate)}` : yymmdd(departDate);
  return `https://www.skyscanner.net/transport/flights/${from.toLowerCase()}/${to.toLowerCase()}/${dates}/?adults=${passengers}`;
}
