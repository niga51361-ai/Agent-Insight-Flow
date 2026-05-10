import type { ToolDefinition, ToolResult } from "./types.js";

const WMO: Record<number, string> = {
  0: "صافٍ", 1: "صافٍ غالباً", 2: "غائم جزئياً", 3: "غائم",
  45: "ضبابي", 48: "ضباب متجمد",
  51: "رذاذ خفيف", 53: "رذاذ متوسط", 55: "رذاذ كثيف",
  61: "مطر خفيف", 63: "مطر متوسط", 65: "مطر غزير",
  71: "ثلج خفيف", 73: "ثلج متوسط", 75: "ثلج كثيف",
  80: "زخات مطر خفيفة", 81: "زخات مطر متوسطة", 82: "زخات مطر عنيفة",
  95: "عاصفة رعدية", 96: "عاصفة رعدية مع برد خفيف", 99: "عاصفة رعدية مع برد كثيف",
};

async function getWeather(location: string): Promise<ToolResult> {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=ar`,
      { signal: AbortSignal.timeout(8000) }
    );
    const geoData = await geoRes.json() as { results?: Array<{ name: string; country: string; latitude: number; longitude: number; timezone: string }> };
    const place = geoData.results?.[0];
    if (!place) return { success: false, output: null, error: `لم يُعثر على موقع: ${location}` };

    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,surface_pressure` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,precipitation_probability_max` +
      `&timezone=${encodeURIComponent(place.timezone)}&forecast_days=5`,
      { signal: AbortSignal.timeout(8000) }
    );
    const w = await wRes.json() as {
      current?: Record<string, number>;
      daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; weather_code?: number[]; precipitation_sum?: number[]; precipitation_probability_max?: number[] };
    };

    const c = w.current ?? {};
    const d = w.daily ?? {};
    const forecast = (d.time ?? []).slice(0, 5).map((date, i) => ({
      date,
      maxTemp: d.temperature_2m_max?.[i],
      minTemp: d.temperature_2m_min?.[i],
      condition: WMO[d.weather_code?.[i] ?? 0] ?? "غير معروف",
      rainMm: d.precipitation_sum?.[i] ?? 0,
      rainChance: d.precipitation_probability_max?.[i] ?? 0,
    }));

    return {
      success: true,
      output: {
        location: `${place.name}, ${place.country}`,
        coordinates: { lat: place.latitude, lon: place.longitude },
        current: {
          temperature: `${c["temperature_2m"]}°C`,
          feelsLike: `${c["apparent_temperature"]}°C`,
          humidity: `${c["relative_humidity_2m"]}%`,
          wind: `${c["wind_speed_10m"]} km/h`,
          condition: WMO[c["weather_code"] ?? 0] ?? "غير معروف",
          pressure: `${c["surface_pressure"]} hPa`,
        },
        forecast,
      },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function getExchangeRates(baseCurrency: string, targets?: string[]): Promise<ToolResult> {
  try {
    const res = await fetch(
      `https://open.er-api.com/v6/latest/${baseCurrency.toUpperCase()}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json() as { result?: string; base_code?: string; time_last_update_utc?: string; rates?: Record<string, number> };
    if (data.result !== "success") return { success: false, output: null, error: "فشل جلب أسعار الصرف" };

    const allRates = data.rates ?? {};
    const COMMON = ["USD", "EUR", "GBP", "SAR", "AED", "EGP", "TRY", "JPY", "CNY", "CAD", "AUD", "CHF", "INR", "KWD", "QAR", "BHD"];
    const keys = targets?.length ? targets.map(t => t.toUpperCase()) : COMMON;
    const rates: Record<string, number> = {};
    for (const k of keys) if (allRates[k] !== undefined) rates[k] = allRates[k]!;

    return { success: true, output: { baseCurrency: data.base_code, lastUpdated: data.time_last_update_utc, rates } };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function getCryptoPrice(symbols: string[]): Promise<ToolResult> {
  try {
    const ids = symbols.map(s => s.toLowerCase()).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,eur,sar&include_24hr_change=true&include_market_cap=true&include_last_updated_at=true`,
      { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json() as Record<string, { usd?: number; eur?: number; sar?: number; usd_24h_change?: number; usd_market_cap?: number }>;
    return { success: true, output: { prices: data, timestamp: new Date().toISOString(), source: "CoinGecko" } };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const realtimeDataTool: ToolDefinition = {
  name: "get_realtime_data",
  description: "Fetch real-time data from live APIs. Supports: weather (current conditions + 5-day forecast for any city), currency exchange rates (140+ currencies), and cryptocurrency prices (via CoinGecko). All data is live.",
  parameters: {
    dataType:        { type: "string", description: "'weather' | 'exchange_rates' | 'crypto'", required: true },
    location:        { type: "string", description: "City name for weather (e.g., 'Riyadh', 'Dubai', 'Cairo', 'London')", required: false },
    baseCurrency:    { type: "string", description: "Base currency code for exchange rates (e.g., 'USD', 'SAR')", required: false },
    targetCurrencies:{ type: "array",  description: "Target currency codes (e.g., ['EUR','GBP']). Empty = all common currencies.", required: false, items: { type: "string" } },
    cryptoSymbols:   { type: "array",  description: "CoinGecko IDs (e.g., ['bitcoin','ethereum','solana'])", required: false, items: { type: "string" } },
  },
  execute: async (params) => {
    const dt = String(params.dataType ?? "").toLowerCase();
    if (dt === "weather") {
      if (!params.location) return { success: false, output: null, error: "location is required for weather" };
      return getWeather(String(params.location));
    }
    if (dt === "exchange_rates") {
      const base    = params.baseCurrency ? String(params.baseCurrency) : "USD";
      const targets = Array.isArray(params.targetCurrencies) ? params.targetCurrencies.map(String) : undefined;
      return getExchangeRates(base, targets);
    }
    if (dt === "crypto") {
      const syms = Array.isArray(params.cryptoSymbols) ? params.cryptoSymbols.map(String) : ["bitcoin", "ethereum"];
      return getCryptoPrice(syms);
    }
    return { success: false, output: null, error: `Unknown dataType: "${dt}". Use 'weather', 'exchange_rates', or 'crypto'.` };
  },
};
