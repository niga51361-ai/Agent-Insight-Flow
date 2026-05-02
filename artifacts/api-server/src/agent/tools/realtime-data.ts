import type { ToolDefinition, ToolResult } from "./types.js";
import { deductCredits } from "@workspace/db";

async function getWeather(userId: string, location: string): Promise<ToolResult> {
  const WEATHER_COST = 0.0005; // Example cost
  const creditsDeducted = await deductCredits(userId, WEATHER_COST, `Weather data for ${location}`);
  if (!creditsDeducted) {
    return { success: false, output: null, error: "Insufficient credits for weather data." };
  }

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en`,
      { headers: { "User-Agent": "ZanixAgent/1.0" } }
    );
    const geoData = await geoRes.json() as {
      results?: Array<{ name: string; country: string; latitude: number; longitude: number; timezone: string }>;
    };

    const place = geoData.results?.[0];
    if (!place) {
      return { success: false, output: null, error: `Location not found: ${location}` };
    }

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum&timezone=${encodeURIComponent(place.timezone)}&forecast_days=3`,
      { headers: { "User-Agent": "ZanixAgent/1.0" } }
    );
    const weatherData = await weatherRes.json() as {
      current?: {
        temperature_2m?: number;
        relative_humidity_2m?: number;
        apparent_temperature?: number;
        weather_code?: number;
        wind_speed_10m?: number;
        precipitation?: number;
      };
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        weather_code?: number[];
        precipitation_sum?: number[];
      };
    };

    const wmoDescriptions: Record<number, string> = {
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Foggy", 48: "Depositing rime fog",
      51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
      61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
      71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
      80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
      95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
    };

    const c = weatherData.current ?? {};
    const d = weatherData.daily ?? {};

    const forecast = (d.time ?? []).slice(0, 3).map((date, i) => ({
      date,
      maxTemp: d.temperature_2m_max?.[i],
      minTemp: d.temperature_2m_min?.[i],
      description: wmoDescriptions[d.weather_code?.[i] ?? 0] ?? "Unknown",
      precipitation: d.precipitation_sum?.[i],
    }));

    return {
      success: true,
      output: {
        location: `${place.name}, ${place.country}`,
        coordinates: { lat: place.latitude, lon: place.longitude },
        current: {
          temperature: c.temperature_2m,
          feelsLike: c.apparent_temperature,
          humidity: c.relative_humidity_2m,
          windSpeed: c.wind_speed_10m,
          precipitation: c.precipitation,
          description: wmoDescriptions[c.weather_code ?? 0] ?? "Unknown",
        },
        forecast,
        unit: "celsius",
      },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function getExchangeRates(userId: string, baseCurrency: string, targetCurrencies?: string[]): Promise<ToolResult> {
  const EXCHANGE_RATE_COST = 0.0003; // Example cost
  const creditsDeducted = await deductCredits(userId, EXCHANGE_RATE_COST, `Exchange rates for ${baseCurrency}`);
  if (!creditsDeducted) {
    return { success: false, output: null, error: "Insufficient credits for exchange rates." };
  }

  try {
    const res = await fetch(
      `https://open.er-api.com/v6/latest/${baseCurrency.toUpperCase()}`,
      { headers: { "User-Agent": "ZanixAgent/1.0" } }
    );
    const data = await res.json() as {
      result?: string;
      base_code?: string;
      time_last_update_utc?: string;
      rates?: Record<string, number>;
    };

    if (data.result !== "success") {
      return { success: false, output: null, error: "Failed to fetch exchange rates" };
    }

    let rates = data.rates ?? {};
    if (targetCurrencies && targetCurrencies.length > 0) {
      const filtered: Record<string, number> = {};
      for (const currency of targetCurrencies) {
        const upper = currency.toUpperCase();
        if (rates[upper] !== undefined) {
          filtered[upper] = rates[upper]!;
        }
      }
      rates = filtered;
    } else {
      const common = ["USD", "EUR", "GBP", "SAR", "AED", "EGP", "TRY", "JPY", "CNY", "CAD", "AUD", "CHF", "INR"];
      const filtered: Record<string, number> = {};
      for (const c of common) {
        if (rates[c] !== undefined) filtered[c] = rates[c]!;
      }
      rates = filtered;
    }

    return {
      success: true,
      output: {
        baseCurrency: data.base_code,
        lastUpdated: data.time_last_update_utc,
        rates,
        rateCount: Object.keys(rates).length,
      },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function getCryptoPrice(userId: string, symbols: string[]): Promise<ToolResult> {
  const CRYPTO_PRICE_COST = 0.0007; // Example cost
  const creditsDeducted = await deductCredits(userId, CRYPTO_PRICE_COST, `Crypto prices for ${symbols.join(', ')}`);
  if (!creditsDeducted) {
    return { success: false, output: null, error: "Insufficient credits for crypto prices." };
  }

  try {
    const ids = symbols.map((s) => s.toLowerCase()).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,eur,sar&include_24hr_change=true&include_market_cap=true`,
      { headers: { "User-Agent": "ZanixAgent/1.0", Accept: "application/json" } }
    );
    const data = await res.json() as Record<string, {
      usd?: number; eur?: number; sar?: number;
      usd_24h_change?: number; usd_market_cap?: number;
    }>;

    if (!data || typeof data !== "object") {
      return { success: false, output: null, error: "Could not fetch crypto prices" };
    }

    return {
      success: true,
      output: {
        prices: data,
        timestamp: new Date().toISOString(),
        source: "CoinGecko",
      },
    };
  } catch (err) {
    return { success: false, output: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export const realtimeDataTool: ToolDefinition = {
  name: "get_realtime_data",
  description:
    "Get real-time data: weather conditions and forecasts for any city, live currency exchange rates, or cryptocurrency prices. All data is fetched from live sources.",
  parameters: {
    userId: {
      type: "string",
      description: "The user ID for credit deduction",
      required: true,
    },
    dataType: {
      type: "string",
      description: "Type of data to fetch: 'weather', 'exchange_rates', or 'crypto'",
      required: true,
    },
    location: {
      type: "string",
      description: "City name for weather (e.g., 'Riyadh', 'Cairo', 'London')",
      required: false,
    },
    baseCurrency: {
      type: "string",
      description: "Base currency code for exchange rates (e.g., 'USD', 'SAR', 'EUR')",
      required: false,
    },
    targetCurrencies: {
      type: "array",
      description: "Target currency codes (e.g., ['EUR', 'GBP', 'JPY']). Leave empty for common currencies.",
      required: false,
      items: { type: "string" },
    },
    cryptoSymbols: {
      type: "array",
      description:
        "Cryptocurrency IDs to fetch (e.g., ['bitcoin', 'ethereum', 'solana']). Use CoinGecko IDs.",
      required: false,
      items: { type: "string" },
    },
  },
  execute: async (params) => {
    const userId = String(params.userId);
    const dataType = String(params.dataType).toLowerCase();

    if (dataType === "weather") {
      if (!params.location) {
        return { success: false, output: null, error: "location is required for weather data" };
      }
      return getWeather(userId, String(params.location));
    }

    if (dataType === "exchange_rates") {
      const base = params.baseCurrency ? String(params.baseCurrency) : "USD";
      const targets = Array.isArray(params.targetCurrencies)
        ? params.targetCurrencies.map(String)
        : undefined;
      return getExchangeRates(userId, base, targets);
    }

    if (dataType === "crypto") {
      const symbols = Array.isArray(params.cryptoSymbols)
        ? params.cryptoSymbols.map(String)
        : ["bitcoin", "ethereum"];
      return getCryptoPrice(userId, symbols);
    }

    return {
      success: false,
      output: null,
      error: `Unknown dataType: ${dataType}. Use 'weather', 'exchange_rates', or 'crypto'.`,
    };
  },
};
