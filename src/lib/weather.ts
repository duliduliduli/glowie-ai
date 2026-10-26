import "server-only";

// Open-Meteo: free for non-commercial use. Set OPEN_METEO_API_KEY (paid plan) for commercial traffic.
const key = process.env.OPEN_METEO_API_KEY;
const host = (sub: string) => `https://${key ? "customer-" : ""}${sub}.open-meteo.com`;
const withKey = (url: string) => (key ? `${url}&apikey=${key}` : url);

export type Weather = { place: string; date: string; summary: string } | { place: string; date: string; summary: null; note: string };

/** Forecast for a place and day (Open-Meteo forecasts 16 days ahead). Returns a note instead when out of range. */
export async function forecast(location: string, date: string): Promise<Weather | null> {
  const geo = await fetch(withKey(`${host("geocoding-api")}/v1/search?count=1&name=${encodeURIComponent(location)}`)).then((r) => r.json());
  const g = geo.results?.[0];
  if (!g) return null;
  const place = [g.name, g.admin1, g.country].filter(Boolean).join(", ");
  const days = (new Date(date).getTime() - Date.now()) / 86_400_000;
  if (days > 15 || days < -1) return { place, date, summary: null, note: "Too far out for a forecast; use typical weather for that place and season." };
  const f = await fetch(
    withKey(
      `${host("api")}/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&start_date=${date}&end_date=${date}`,
    ),
  ).then((r) => r.json());
  const d = f.daily;
  if (!d?.time?.length) return null;
  return {
    place,
    date,
    summary: `${Math.round(d.temperature_2m_min[0])}-${Math.round(d.temperature_2m_max[0])}°C, ${d.precipitation_probability_max[0]}% chance of rain, wind up to ${Math.round(d.wind_speed_10m_max[0])} km/h`,
  };
}
