// ===== Weather Now =====
// Uses the free Open-Meteo API (no API key needed)
//   Geocoding: https://geocoding-api.open-meteo.com/v1/search
//   Forecast:  https://api.open-meteo.com/v1/forecast

const els = {
  form: document.getElementById("searchForm"),
  input: document.getElementById("cityInput"),
  locBtn: document.getElementById("locBtn"),
  status: document.getElementById("status"),
  card: document.getElementById("weatherCard"),
  forecast: document.getElementById("forecast"),
  forecastGrid: document.getElementById("forecastGrid"),
  placeName: document.getElementById("placeName"),
  placeTime: document.getElementById("placeTime"),
  mainIcon: document.getElementById("mainIcon"),
  temp: document.getElementById("temp"),
  desc: document.getElementById("desc"),
  feels: document.getElementById("feels"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
};

// Map WMO weather codes -> { label, icon, theme }
// https://open-meteo.com/en/docs (weather variable documentation)
const WEATHER = {
  0:  { label: "Clear sky",            icon: "☀️", theme: ["#2980b9", "#6dd5fa"] },
  1:  { label: "Mainly clear",         icon: "🌤️", theme: ["#2980b9", "#6dd5fa"] },
  2:  { label: "Partly cloudy",        icon: "⛅", theme: ["#5b86b6", "#8aa9c9"] },
  3:  { label: "Overcast",             icon: "☁️", theme: ["#54717a", "#8d9ea5"] },
  45: { label: "Fog",                  icon: "🌫️", theme: ["#6b7a85", "#aab6bd"] },
  48: { label: "Rime fog",             icon: "🌫️", theme: ["#6b7a85", "#aab6bd"] },
  51: { label: "Light drizzle",        icon: "🌦️", theme: ["#4b6cb7", "#8294b3"] },
  53: { label: "Drizzle",              icon: "🌦️", theme: ["#4b6cb7", "#8294b3"] },
  55: { label: "Heavy drizzle",        icon: "🌧️", theme: ["#4b6cb7", "#8294b3"] },
  56: { label: "Freezing drizzle",     icon: "🌧️", theme: ["#4b6cb7", "#8294b3"] },
  57: { label: "Freezing drizzle",     icon: "🌧️", theme: ["#4b6cb7", "#8294b3"] },
  61: { label: "Light rain",           icon: "🌦️", theme: ["#3a6073", "#16222a"] },
  63: { label: "Rain",                 icon: "🌧️", theme: ["#3a6073", "#16222a"] },
  65: { label: "Heavy rain",           icon: "🌧️", theme: ["#283e51", "#0a2342"] },
  66: { label: "Freezing rain",        icon: "🌧️", theme: ["#283e51", "#0a2342"] },
  67: { label: "Freezing rain",        icon: "🌧️", theme: ["#283e51", "#0a2342"] },
  71: { label: "Light snow",           icon: "🌨️", theme: ["#83a4d4", "#b6fbff"] },
  73: { label: "Snow",                 icon: "❄️", theme: ["#83a4d4", "#b6fbff"] },
  75: { label: "Heavy snow",           icon: "❄️", theme: ["#83a4d4", "#b6fbff"] },
  77: { label: "Snow grains",          icon: "🌨️", theme: ["#83a4d4", "#b6fbff"] },
  80: { label: "Rain showers",         icon: "🌦️", theme: ["#3a6073", "#16222a"] },
  81: { label: "Rain showers",         icon: "🌧️", theme: ["#3a6073", "#16222a"] },
  82: { label: "Violent showers",      icon: "⛈️", theme: ["#283e51", "#0a2342"] },
  85: { label: "Snow showers",         icon: "🌨️", theme: ["#83a4d4", "#b6fbff"] },
  86: { label: "Snow showers",         icon: "❄️", theme: ["#83a4d4", "#b6fbff"] },
  95: { label: "Thunderstorm",         icon: "⛈️", theme: ["#373b44", "#4286f4"] },
  96: { label: "Thunderstorm + hail",  icon: "⛈️", theme: ["#373b44", "#4286f4"] },
  99: { label: "Thunderstorm + hail",  icon: "⛈️", theme: ["#373b44", "#4286f4"] },
};

function describe(code) {
  return WEATHER[code] || { label: "Unknown", icon: "❓", theme: ["#2b5876", "#4e4376"] };
}

function setStatus(html, isError = false) {
  els.status.innerHTML = html;
  els.status.classList.toggle("error", isError);
}

function showLoading() {
  setStatus('<span class="spinner"></span>');
}

function setTheme([c1, c2]) {
  document.body.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
}

function dayName(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: "short" });
}

// --- API calls ---
async function geocode(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city
  )}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding request failed");
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`Couldn't find "${city}". Try another spelling.`);
  }
  return data.results[0];
}

async function getWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather request failed");
  return res.json();
}

// --- Rendering ---
function render(place, data) {
  const cur = data.current;
  const info = describe(cur.weather_code);

  // Place name
  const region = place.admin1 ? `${place.admin1}, ` : "";
  els.placeName.textContent = `${place.name}`;
  els.placeTime.textContent = `${region}${place.country || ""}`;

  // Current
  els.mainIcon.textContent = info.icon;
  els.temp.textContent = Math.round(cur.temperature_2m);
  els.desc.textContent = info.label;
  els.feels.textContent = `${Math.round(cur.apparent_temperature)}°`;
  els.humidity.textContent = `${cur.relative_humidity_2m}%`;
  els.wind.textContent = `${Math.round(cur.wind_speed_10m)} km/h`;

  setTheme(info.theme);

  // Forecast
  els.forecastGrid.innerHTML = "";
  const d = data.daily;
  for (let i = 0; i < d.time.length; i++) {
    const f = describe(d.weather_code[i]);
    const el = document.createElement("div");
    el.className = "fc-day";
    el.innerHTML = `
      <div class="fc-day__name">${i === 0 ? "Today" : dayName(d.time[i])}</div>
      <div class="fc-day__icon">${f.icon}</div>
      <div class="fc-day__temp">
        <span class="max">${Math.round(d.temperature_2m_max[i])}°</span>
        <span class="min">${Math.round(d.temperature_2m_min[i])}°</span>
      </div>`;
    els.forecastGrid.appendChild(el);
  }

  els.card.hidden = false;
  els.forecast.hidden = false;
  setStatus("");
}

// --- Flows ---
async function searchCity(city) {
  if (!city || !city.trim()) return;
  try {
    showLoading();
    const place = await geocode(city.trim());
    const data = await getWeather(place.latitude, place.longitude);
    render(place, data);
  } catch (err) {
    els.card.hidden = true;
    els.forecast.hidden = true;
    setStatus(err.message || "Something went wrong. Try again.", true);
  }
}

async function searchCoords(lat, lon) {
  try {
    showLoading();
    const data = await getWeather(lat, lon);
    // Reverse-friendly label using the forecast timezone
    const place = { name: "Your location", admin1: "", country: data.timezone || "" };
    render(place, data);
  } catch (err) {
    setStatus(err.message || "Something went wrong. Try again.", true);
  }
}

// --- Events ---
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  searchCity(els.input.value);
});

els.locBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Geolocation is not supported by your browser.", true);
    return;
  }
  showLoading();
  navigator.geolocation.getCurrentPosition(
    (pos) => searchCoords(pos.coords.latitude, pos.coords.longitude),
    () => setStatus("Couldn't get your location. Please search by city.", true)
  );
});

// Load a default city on first visit
window.addEventListener("DOMContentLoaded", () => {
  els.input.value = "London";
  searchCity("London");
});
