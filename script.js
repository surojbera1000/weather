// ===== Weather Now =====
// Uses the free Open-Meteo API (no API key needed)
//   Geocoding: https://geocoding-api.open-meteo.com/v1/search
//   Forecast:  https://api.open-meteo.com/v1/forecast

const els = {
  form: document.getElementById("searchForm"),
  input: document.getElementById("cityInput"),
  suggestions: document.getElementById("suggestions"),
  locBtn: document.getElementById("locBtn"),
  status: document.getElementById("status"),
  card: document.getElementById("weatherCard"),
  forecast: document.getElementById("forecast"),
  forecastGrid: document.getElementById("forecastGrid"),
  placeName: document.getElementById("placeName"),
  placeTime: document.getElementById("placeTime"),
  mainIcon: document.getElementById("mainIcon"),
  temp: document.getElementById("temp"),
  tempBox: document.querySelector(".card__temp"),
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

// Convert a 2-letter ISO country code (e.g. "US") to a flag emoji 🇺🇸
function flagEmoji(code) {
  if (!code || code.length !== 2) return "🌍";
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  return String.fromCodePoint(
    A + (code.toUpperCase().charCodeAt(0) - base),
    A + (code.toUpperCase().charCodeAt(1) - base)
  );
}

function setStatus(html, isError = false) {
  els.status.innerHTML = html;
  els.status.classList.toggle("error", isError);
}

function showLoading() {
  setStatus('<span class="spinner"></span>');
}

// Update the animated gradient colors via CSS variables (keeps the
// background animation running instead of overriding it).
function setTheme([c1, c2]) {
  document.body.style.setProperty("--bg-grad-1", c1);
  document.body.style.setProperty("--bg-grad-2", c2);
}

function dayName(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: "short" });
}

// Animate the big temperature number counting up/down to the target value.
function animateTemp(target) {
  const start = parseInt(els.temp.textContent, 10);
  const from = Number.isNaN(start) ? target : start;
  const duration = 600;
  const t0 = performance.now();

  els.tempBox.classList.remove("pop");
  // force reflow so the animation can replay
  void els.tempBox.offsetWidth;
  els.tempBox.classList.add("pop");

  function step(now) {
    const p = Math.min((now - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
    els.temp.textContent = Math.round(from + (target - from) * eased);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// --- API calls ---
async function searchCities(query, count = 6) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=${count}&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding request failed");
  const data = await res.json();
  return data.results || [];
}

async function geocode(city) {
  const results = await searchCities(city, 1);
  if (results.length === 0) {
    throw new Error(`Couldn't find "${city}". Try another spelling.`);
  }
  return results[0];
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

// Turn GPS coordinates into a readable place name.
// Uses the free BigDataCloud reverse-geocode API (no key required).
async function reverseGeocode(lat, lon) {
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const d = await res.json();
    return {
      name: d.city || d.locality || d.principalSubdivision || "Your location",
      admin1: d.principalSubdivision || "",
      country: d.countryName || "",
      country_code: d.countryCode || "",
    };
  } catch {
    // Fallback if the reverse-geocode service is unavailable
    return { name: "Your location", admin1: "", country: "", country_code: "" };
  }
}

// --- Rendering ---
function render(place, data, isLive = false) {
  const cur = data.current;
  const info = describe(cur.weather_code);

  const pin = isLive ? "📍 " : "";
  const region = place.admin1 ? `${place.admin1}, ` : "";
  els.placeName.textContent = `${pin}${place.name}`;
  els.placeTime.textContent = `${region}${place.country || ""}`;

  els.mainIcon.textContent = info.icon;
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
    el.style.animation = `fadeIn 0.4s ease ${i * 0.05}s both`;
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

  animateTemp(Math.round(cur.temperature_2m));
}

// ===== Autocomplete =====
let acItems = [];      // current suggestion data
let acIndex = -1;      // highlighted index for keyboard nav
let acTimer = null;    // debounce timer
let acToken = 0;       // request token to ignore stale responses

function closeSuggestions() {
  els.suggestions.hidden = true;
  els.suggestions.innerHTML = "";
  els.input.setAttribute("aria-expanded", "false");
  acItems = [];
  acIndex = -1;
}

function highlightMatch(name, query) {
  const i = name.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return name;
  const before = name.slice(0, i);
  const match = name.slice(i, i + query.length);
  const after = name.slice(i + query.length);
  return `${before}<mark>${match}</mark>${after}`;
}

function renderSuggestions(results, query) {
  acItems = results;
  acIndex = -1;
  els.suggestions.innerHTML = "";

  if (results.length === 0) {
    els.suggestions.innerHTML =
      '<li class="suggestion--empty">No matching cities</li>';
    els.suggestions.hidden = false;
    els.input.setAttribute("aria-expanded", "true");
    return;
  }

  results.forEach((r, idx) => {
    const sub = [r.admin1, r.country].filter(Boolean).join(", ");
    const li = document.createElement("li");
    li.className = "suggestion";
    li.id = `sg-${idx}`;
    li.setAttribute("role", "option");
    li.innerHTML = `
      <span class="suggestion__flag">${flagEmoji(r.country_code)}</span>
      <span class="suggestion__text">
        <span class="suggestion__name">${highlightMatch(r.name, query)}</span>
        <span class="suggestion__sub">${sub}</span>
      </span>`;
    li.addEventListener("mousedown", (e) => {
      // mousedown (not click) so it fires before input blur
      e.preventDefault();
      pickSuggestion(idx);
    });
    els.suggestions.appendChild(li);
  });

  els.suggestions.hidden = false;
  els.input.setAttribute("aria-expanded", "true");
}

function setActive(idx) {
  const nodes = els.suggestions.querySelectorAll(".suggestion");
  nodes.forEach((n) => n.classList.remove("active"));
  if (idx >= 0 && idx < nodes.length) {
    nodes[idx].classList.add("active");
    nodes[idx].scrollIntoView({ block: "nearest" });
    els.input.setAttribute("aria-activedescendant", `sg-${idx}`);
  } else {
    els.input.removeAttribute("aria-activedescendant");
  }
}

async function pickSuggestion(idx) {
  const place = acItems[idx];
  if (!place) return;
  els.input.value = place.name;
  closeSuggestions();
  try {
    showLoading();
    const data = await getWeather(place.latitude, place.longitude);
    render(place, data);
  } catch (err) {
    setStatus(err.message || "Something went wrong. Try again.", true);
  }
}

function onInput() {
  const q = els.input.value.trim();
  clearTimeout(acTimer);
  if (q.length < 2) {
    closeSuggestions();
    return;
  }
  // debounce so we don't fire a request on every keystroke
  acTimer = setTimeout(async () => {
    const myToken = ++acToken;
    try {
      const results = await searchCities(q, 6);
      if (myToken !== acToken) return; // a newer request superseded this one
      renderSuggestions(results, q);
    } catch {
      closeSuggestions();
    }
  }, 250);
}

function onKeyDown(e) {
  if (els.suggestions.hidden) return;
  const max = acItems.length - 1;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    acIndex = acIndex >= max ? 0 : acIndex + 1;
    setActive(acIndex);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    acIndex = acIndex <= 0 ? max : acIndex - 1;
    setActive(acIndex);
  } else if (e.key === "Enter") {
    if (acIndex >= 0) {
      e.preventDefault();
      pickSuggestion(acIndex);
    }
  } else if (e.key === "Escape") {
    closeSuggestions();
  }
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
    const [place, data] = await Promise.all([
      reverseGeocode(lat, lon),
      getWeather(lat, lon),
    ]);
    render(place, data, true);
  } catch (err) {
    setStatus(err.message || "Something went wrong. Try again.", true);
  }
}

// --- Events ---
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  closeSuggestions();
  searchCity(els.input.value);
});

els.input.addEventListener("input", onInput);
els.input.addEventListener("keydown", onKeyDown);
els.input.addEventListener("focus", () => {
  if (els.input.value.trim().length >= 2 && acItems.length) {
    els.suggestions.hidden = false;
  }
});
// Close the dropdown when clicking outside the search field
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search__field")) closeSuggestions();
});

els.locBtn.addEventListener("click", () => {
  closeSuggestions();
  if (!navigator.geolocation) {
    setStatus("⚠️ Geolocation is not supported by your browser.", true);
    return;
  }
  setStatus('<span class="spinner"></span> 📍 Finding your location...');
  navigator.geolocation.getCurrentPosition(
    (pos) => searchCoords(pos.coords.latitude, pos.coords.longitude),
    () => setStatus("⚠️ Couldn't get your location. Please search by city.", true)
  );
});

// On first visit, try to auto-detect the user's live location.
// If permission is denied or unavailable, fall back to a default city.
window.addEventListener("DOMContentLoaded", () => {
  if (navigator.geolocation) {
    setStatus('<span class="spinner"></span> 📍 Detecting your location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => searchCoords(pos.coords.latitude, pos.coords.longitude),
      () => searchCity("London"), // user denied or error -> default
      { timeout: 8000 }
    );
  } else {
    searchCity("London");
  }
});
