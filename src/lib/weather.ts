import * as Location from 'expo-location';

export type Weather = {
  current: number; // °C
  high: number; // °C
  low: number; // °C
  rainChance: number; // 0-100
  description: string;
};

// WMO weather codes used by Open-Meteo, grouped into a few words.
function describe(code: number) {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67 || (code >= 80 && code <= 82)) return 'Rain';
  if (code <= 77 || code === 85 || code === 86) return 'Snow';
  return 'Thunderstorms';
}

type OpenMeteoResponse = {
  current: { temperature_2m: number; weather_code: number };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
  };
};

// Today's weather where the user is, from Open-Meteo (free, no API key).
// Returns null if location permission is refused or the request fails.
export async function getTodayWeather(): Promise<Weather | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    const { latitude, longitude } = position.coords;
    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${latitude.toFixed(2)}&longitude=${longitude.toFixed(2)}` +
      '&current=temperature_2m,weather_code' +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&timezone=auto&forecast_days=1';
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = (await response.json()) as OpenMeteoResponse;
    return {
      current: body.current.temperature_2m,
      high: body.daily.temperature_2m_max[0],
      low: body.daily.temperature_2m_min[0],
      rainChance: body.daily.precipitation_probability_max[0] ?? 0,
      description: describe(body.current.weather_code),
    };
  } catch {
    return null;
  }
}

const usesFahrenheit = /-(US|LR|MM)$/.test(Intl.DateTimeFormat().resolvedOptions().locale);

export function formatTemperature(celsius: number) {
  return usesFahrenheit ? `${Math.round((celsius * 9) / 5 + 32)}°F` : `${Math.round(celsius)}°C`;
}
