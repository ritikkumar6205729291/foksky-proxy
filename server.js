require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = "https://api.openweathermap.org/data/2.5";
const GEO_URL = "https://api.openweathermap.org/geo/1.0";

const VILLAGE_NAME = "Amarbiga";
const VILLAGE_LAT = 24.7962;
const VILLAGE_LON = 84.9999;

app.get("/", (req, res) => {
  res.json({
    service: "FokSky Proxy",
    status: "online",
    upstream: "OpenWeatherMap",
    usage: "/api/weather?city=Delhi",
  });
});

app.get("/api/weather", async (req, res) => {
  try {
    const city = req.query.city || "Delhi";

    if (!API_KEY) {
      return res.status(500).json({
        status: "error",
        message: "API key not configured",
      });
    }

    let lat;
    let lon;
    let displayCity;

    if (city.trim().toLowerCase() === VILLAGE_NAME.toLowerCase()) {
      lat = VILLAGE_LAT;
      lon = VILLAGE_LON;
      displayCity = VILLAGE_NAME;
    } else {
      const geoRes = await fetch(
        `${GEO_URL}/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`
      );

      if (!geoRes.ok) {
        throw new Error("Geocoding failed");
      }

      const geoData = await geoRes.json();

      if (!geoData || geoData.length === 0) {
        return res.status(404).json({
          status: "error",
          message: "City not found",
        });
      }

      lat = geoData[0].lat;
      lon = geoData[0].lon;
      displayCity = geoData[0].name;
    }

    const [currentRes, forecastRes, airRes] = await Promise.all([
      fetch(
        `${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
      ),
      fetch(
        `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
      ),
      fetch(
        `${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
      ),
    ]);

    if (!currentRes.ok) {
      throw new Error("Weather fetch failed");
    }

    const currentJson = await currentRes.json();
    const forecastJson = await forecastRes.json();
    const airJson = airRes.ok ? await airRes.json() : null;

    currentJson.name = displayCity;

    res.json({
      status: "success",
      city: displayCity,
      current: currentJson,
      forecast: forecastJson.list || [],
      airQuality: airJson,
    });
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Something went wrong",
    });
  }
});

app.options(/.*/, (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(200).end();
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ FokSky proxy running on port ${PORT}`);
});