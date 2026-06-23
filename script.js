// ===== Weather Now =====
// Uses the free Open-Meteo API (no API key needed)
//   Geocoding: https://geocoding-api.open-meteo.com/v1/search
//   Forecast:  https://api.open-meteo.com/v1/forecast

const els = {
  // top bar
  placeName: document.getElementById("placeName"),
  placeTime: document.getElementById("placeTime"),
  searchToggle: document.getElementById("searchToggle"),
  locBtn: document.getElementById("locBtn"),
  settingsToggle: document.getElementById("settingsToggle"),
  // panels
  searchPanel: document.getElementById("searchPanel"),
  settingsPanel: document.getElementById("settingsPanel"),
  form: document.getElementById("searchForm"),
  input: document.getElementById("cityInput"),
  suggestions: document.getElementById("suggestions"),
  autoLocToggle: document.getElementById("autoLocToggle"),
  unitToggle: document.getElementById("unitToggle"),
  // status
  status: document.getElementById("status"),
  // current
  current: document.getElementById("current"),
  temp: document.getElementById("temp"),
  unitLabel: document.getElementById("unitLabel"),
  desc: document.getElementById("desc"),
  mainIcon: document.getElementById("mainIcon"),
  // hourly
  hourly: document.getElementById("hourly"),
  hourlyTrack: document.getElementById("hourlyTrack"),
  // daily
  daily: document.getElementById("daily"),
  dailyList: document.getElementById("dailyList"),
  // details
  details: document.getElementById("details"),
  sunDot: document.getElementById("sunDot"),
  sunrise: document.getElementById("sunrise"),
  sunset: document.getElementById("sunset"),
  sensible: document.getElementById("sensible"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  pressure: document.getElementById("pressure"),
  // pull to refresh
  ptr: document.getElementById("ptr"),
  ptrIcon: document.getElementById("ptrIcon"),
  ptrText: document.getElementById("ptrText"),
};

// Map WMO weather codes -> { label, icon, theme }
const WEATHER = {
  0:  { label: "Clear sky",            icon: "☀️", theme: ["#3a6ea5", "#1b3a5b"] },
  1:  { label: "Mainly clear",         icon: "🌤️", theme: ["#3a6ea5", "#1b3a5b"] },
  2:  { label: "Partly cloudy",        icon: "⛅", theme: ["#41597f", "#22304f"] },
  3:  { label: "Overcast",             icon: "☁️", theme: ["#4a566b", "#262f42"] },
  45: { label: "Fog",                  icon: "🌫️", theme: ["#525c69", "#2a313c"] },
  48: { label: "Rime fog",             icon: "🌫️", theme: ["#525c69", "#2a313c"] },
  51: { label: "Light drizzle",        icon: "🌦️", theme: ["#3d5273", "#202d49"] },
  53: { label: "Drizzle",              icon: "🌦️", theme: ["#3d5273", "#202d49"] },
  55: { label: "Heavy drizzle",        icon: "🌧️", theme: ["#3d5273", "#202d49"] },
  56: { label: "Freezing drizzle",     icon: "🌧️", theme: ["#3d5273", "#202d49"] },
  57: { label: "Freezing drizzle",     icon: "🌧️", theme: ["#3d5273", "#202d49"] },
  61: { label: "Light rain",           icon: "🌦️", theme: ["#34465f", "#1a2438"] },
  63: { label: "Rain",                 icon: "🌧️", theme: ["#34465f", "#1a2438"] },
  65: { label: "Heavy rain",           icon: "🌧️", theme: ["#2a3a50", "#141d30"] },
  66: { label: "Freezing rain",        icon: "🌧️", theme: ["#2a3a50", "#141d30"] },
  67: { label: "Freezing rain",        icon: "🌧️", theme: ["#2a3a50", "#141d30"] },
  71: { label: "Light snow",           icon: "🌨️", theme: ["#5a6b85", "#2c3850"] },
  73: { label: "Snow",                 icon: "❄️", theme: ["#5a6b85", "#2c3850"] },
  75: { label: "Heavy snow",           icon: "❄️", theme: ["#5a6b85", "#2c3850"] },
  77: { label: "Snow grains",          icon: "🌨️", theme: ["#5a6b85", "#2c3850"] },
  80: { label: "Rain showers",         icon: "🌦️", theme: ["#34465f", "#1a2438"] },
  81: { label: "Rain showers",         icon: "🌧️", theme: ["#34465f", "#1a2438"] },
  82: { label: "Violent showers",      icon: "⛈️", theme: ["#2a3a50", "#141d30"] },
  85: { label: "Snow showers",         icon: "🌨️", theme: ["#5a6b85", "#2c3850"] },
  86: { label: "Snow showers",         icon: "❄️", theme: ["#5a6b85", "#2c3850"] },
  95: { label: "Thunderstorm",         icon: "⛈️", theme: ["#33384a", "#191d2b"] },
  96: { label: "Thunderstorm + hail",  icon: "⛈️", theme: ["#33384a", "#191d2b"] },
  99: { label: "Thunderstorm + hail",  icon: "⛈️", theme: ["#33384a", "#191d2b"] },
};

function describe(code) {
  return WEATHER[code] || { label: "Unknown", icon: "❓", theme: ["#2b3f6b", "#1b2747"] };
}

// Pick an icon, swapping to night variants when it isn't daytime.
function iconFor(code, isDay) {
  if (!isDay) {
    if (code === 0 || code === 1) return "🌙";
    if (code === 2) return "☁️";
  }
  return describe(code).icon;
}

// Convert a 2-letter ISO country code to a flag emoji
function flagEmoji(code) {
  if (!code || code.length !== 2) return "🌍";
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  return String.fromCodePoint(
    A + (code.toUpperCase().charCodeAt(0) - base),
    A + (code.toUpperCase().charCodeAt(1) - base)
  );
}

// ===== Units =====
function getUnit() {
  try { return localStorage.getItem("wn_unit") === "f" ? "f" : "c"; } catch { return "c"; }
}
function setUnit(u) {
  try { localStorage.setItem("wn_unit", u); } catch {}
}
let unit = getUnit();
function toUnit(c) { return unit === "f" ? c * 9 / 5 + 32 : c; }
function tStr(c) { return `${Math.round(toUnit(c))}°`; }
function unitText() { return unit === "f" ? "°F" : "°C"; }

// Beaufort wind force from km/h
function beaufort(kmh) {
  const t = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  let f = 0;
  for (let i = 0; i < t.length; i++) if (kmh >= t[i]) f = i + 1;
  return f;
}
// 8-point compass direction from degrees
function windDir(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function setStatus(html, isError = false) {
  els.status.innerHTML = html;
  els.status.classList.toggle("error", isError);
}
function showLoading() { setStatus('<span class="spinner"></span> Loading...'); }

function setTheme([c1, c2]) {
  document.body.style.setProperty("--bg-1", c1);
  document.body.style.setProperty("--bg-2", c2);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", c2);
}

function dayName(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: "short" });
}
function dateDM(dateStr) {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}
function hhmm(iso) {
  // iso like "2026-06-23T21:00" (local-naive) -> "21:00"
  const m = String(iso).match(/T(\d{2}:\d{2})/);
  return m ? m[1] : String(iso);
}

// ===== Persistence =====
const STORE = { autoLoc: "wn_autoloc", last: "wn_last" };
function getAutoLoc() {
  try { return localStorage.getItem(STORE.autoLoc) !== "0"; } catch { return true; }
}
function setAutoLoc(on) {
  try { localStorage.setItem(STORE.autoLoc, on ? "1" : "0"); } catch {}
}
let lastView = null;
function rememberView(view) {
  lastView = view;
  try { localStorage.setItem(STORE.last, JSON.stringify(view)); } catch {}
}
function loadLastView() {
  try { return JSON.parse(localStorage.getItem(STORE.last)); } catch { return null; }
}

// Keep the latest data so we can re-render instantly on unit change.
let currentPlace = null;
let currentData = null;
let currentIsLive = false;

// ===== API =====
async function searchCities(query, count = 6) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=${count}&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding request failed");
  const data = await res.json();
  return data.results || [];
}
function dedupeCities(results) {
  const seen = new Set();
  return results.filter((r) => {
    const key = [
      (r.name || "").toLowerCase(),
      (r.admin1 || "").toLowerCase(),
      (r.country_code || r.country || "").toLowerCase(),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
async function geocode(city) {
  const results = await searchCities(city, 1);
  if (results.length === 0) throw new Error(`Couldn't find "${city}". Try another spelling.`);
  return results[0];
}
async function getWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,is_day` +
    `&hourly=temperature_2m,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset` +
    `&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather request failed");
  return res.json();
}
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
    return { name: "Your location", admin1: "", country: "", country_code: "" };
  }
}
async function ipLocate() {
  const res = await fetch("https://ipwho.is/");
  if (!res.ok) throw new Error("IP location failed");
  const d = await res.json();
  if (!d || d.success === false || typeof d.latitude !== "number") throw new Error("IP location failed");
  return {
    latitude: d.latitude,
    longitude: d.longitude,
    place: {
      name: d.city || d.region || "Your area",
      admin1: d.region || "",
      country: d.country || "",
      country_code: d.country_code || "",
    },
  };
}

// ===== Rendering =====
function render(place, data, isLive = false) {
  currentPlace = place;
  currentData = data;
  currentIsLive = isLive;

  const cur = data.current;
  const info = describe(cur.weather_code);

  // Header
  const pin = isLive ? "📍 " : "";
  const sub = [place.admin1, place.country].filter(Boolean).join(", ");
  els.placeName.textContent = `${pin}${place.name}`;
  els.placeTime.textContent = sub || "—";

  // Current
  els.temp.textContent = Math.round(toUnit(cur.temperature_2m));
  els.unitLabel.textContent = unitText();
  els.desc.textContent = info.label;
  els.mainIcon.textContent = iconFor(cur.weather_code, cur.is_day);
  setTheme(info.theme);

  // Hourly (next 24h starting from the current hour)
  renderHourly(data.hourly, cur.time);

  // Daily list (from tomorrow onward)
  renderDaily(data.daily);

  // Details
  els.sensible.textContent = tStr(cur.apparent_temperature);
  els.humidity.textContent = `${cur.relative_humidity_2m}%`;
  els.wind.textContent = `${windDir(cur.wind_direction_10m)}, ${beaufort(cur.wind_speed_10m)}`;
  els.pressure.textContent = `${Math.round(cur.surface_pressure)} hPa`;
  renderSun(data.daily, cur.time);

  // Reveal sections
  els.current.hidden = false;
  els.hourly.hidden = false;
  els.daily.hidden = false;
  els.details.hidden = false;
  setStatus("");
}

function renderHourly(hourly, nowIso) {
  els.hourlyTrack.innerHTML = "";
  if (!hourly || !hourly.time) return;
  let start = hourly.time.findIndex((t) => t >= nowIso);
  if (start < 0) start = 0;
  const end = Math.min(start + 24, hourly.time.length);
  for (let i = start; i < end; i++) {
    const el = document.createElement("div");
    el.className = "hour";
    el.innerHTML = `
      <div class="hour__time">${hhmm(hourly.time[i])}</div>
      <div class="hour__icon">${iconFor(hourly.weather_code[i], hourly.is_day[i])}</div>
      <div class="hour__temp">${tStr(hourly.temperature_2m[i])}</div>`;
    els.hourlyTrack.appendChild(el);
  }
}

function renderDaily(d) {
  els.dailyList.innerHTML = "";
  if (!d || !d.time) return;
  for (let i = 1; i < d.time.length; i++) {
    const f = describe(d.weather_code[i]);
    const label = i === 1 ? "Tomorrow" : dayName(d.time[i]);
    const row = document.createElement("div");
    row.className = "drow";
    row.style.animation = `fadeIn 0.4s ease ${(i - 1) * 0.04}s both`;
    row.innerHTML = `
      <span class="drow__date">${dateDM(d.time[i])}</span>
      <span class="drow__day">${label}</span>
      <span class="drow__icon">${f.icon}</span>
      <span class="drow__max">${Math.round(toUnit(d.temperature_2m_max[i]))}°</span>
      <span class="drow__min">${Math.round(toUnit(d.temperature_2m_min[i]))}°</span>`;
    els.dailyList.appendChild(row);
  }
}

function renderSun(daily, nowIso) {
  if (!daily || !daily.sunrise) return;
  const sr = daily.sunrise[0];
  const ss = daily.sunset[0];
  els.sunrise.textContent = hhmm(sr);
  els.sunset.textContent = hhmm(ss);

  // progress of the day (0 at sunrise, 1 at sunset)
  const srMs = new Date(sr).getTime();
  const ssMs = new Date(ss).getTime();
  const nowMs = new Date(nowIso).getTime();
  let t = (nowMs - srMs) / (ssMs - srMs);
  const isNight = t < 0 || t > 1;
  t = Math.max(0, Math.min(1, t));

  // point on the dome: cx = 160 - 144*cos(pi*t), cy = 116 - 96*sin(pi*t)
  const cx = 160 - 144 * Math.cos(Math.PI * t);
  const cy = 116 - 96 * Math.sin(Math.PI * t);
  els.sunDot.setAttribute("cx", cx.toFixed(1));
  els.sunDot.setAttribute("cy", cy.toFixed(1));
  els.sunDot.setAttribute("fill", isNight ? "#9fb3d1" : "#ffd24a");
  els.sunDot.setAttribute("opacity", isNight ? "0.5" : "1");
}

// Re-render the currently shown data (used by the unit toggle)
function rerender() {
  if (currentPlace && currentData) render(currentPlace, currentData, currentIsLive);
}

// ===== Autocomplete =====
let acItems = [];
let acIndex = -1;
let acTimer = null;
let acToken = 0;

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
  return `${name.slice(0, i)}<mark>${name.slice(i, i + query.length)}</mark>${name.slice(i + query.length)}`;
}
function renderSuggestions(results, query) {
  acItems = results;
  acIndex = -1;
  els.suggestions.innerHTML = "";
  if (results.length === 0) {
    els.suggestions.innerHTML = '<li class="suggestion--empty">No matching cities</li>';
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
    li.addEventListener("mousedown", (e) => { e.preventDefault(); pickSuggestion(idx); });
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
    rememberView({ type: "coords", lat: place.latitude, lon: place.longitude });
  } catch (err) {
    setStatus(err.message || "Something went wrong. Try again.", true);
  }
}
function onInput() {
  const q = els.input.value.trim();
  clearTimeout(acTimer);
  if (q.length < 2) { closeSuggestions(); return; }
  acTimer = setTimeout(async () => {
    const myToken = ++acToken;
    try {
      const results = await searchCities(q, 10);
      if (myToken !== acToken) return;
      renderSuggestions(dedupeCities(results).slice(0, 6), q);
    } catch { closeSuggestions(); }
  }, 250);
}
function onKeyDown(e) {
  if (els.suggestions.hidden) return;
  const max = acItems.length - 1;
  if (e.key === "ArrowDown") { e.preventDefault(); acIndex = acIndex >= max ? 0 : acIndex + 1; setActive(acIndex); }
  else if (e.key === "ArrowUp") { e.preventDefault(); acIndex = acIndex <= 0 ? max : acIndex - 1; setActive(acIndex); }
  else if (e.key === "Enter") { if (acIndex >= 0) { e.preventDefault(); pickSuggestion(acIndex); } }
  else if (e.key === "Escape") { closeSuggestions(); }
}

// ===== Flows =====
async function searchCity(city) {
  if (!city || !city.trim()) return;
  try {
    showLoading();
    const place = await geocode(city.trim());
    const data = await getWeather(place.latitude, place.longitude);
    render(place, data);
    rememberView({ type: "city", city: city.trim() });
  } catch (err) {
    setStatus(err.message || "Something went wrong. Try again.", true);
  }
}
async function searchCoords(lat, lon) {
  try {
    showLoading();
    const [place, data] = await Promise.all([reverseGeocode(lat, lon), getWeather(lat, lon)]);
    render(place, data, true);
    rememberView({ type: "coords", lat, lon });
  } catch (err) {
    setStatus(err.message || "Something went wrong. Try again.", true);
  }
}
async function refresh() {
  const view = lastView || loadLastView();
  if (view && view.type === "city") return searchCity(view.city);
  if (view && view.type === "coords") return searchCoords(view.lat, view.lon);
  if (getAutoLoc()) return locateMe(false);
  return searchCity("London");
}

const GEO_OPTIONS = { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 };
function geoErrorMessage(err) {
  switch (err && err.code) {
    case 1: return "⚠️ Location permission was blocked. Enable it in site settings, or search a city.";
    case 2: return "⚠️ Your location is unavailable right now. Try again, or search a city.";
    case 3: return "⏳ Locating took too long. Tap 📍 to try again, or search a city.";
    default: return "⚠️ Couldn't get your location. Please search a city.";
  }
}
function locateMe(isAuto = false) {
  closeSuggestions();
  if (!navigator.geolocation) return locateByIP();
  setStatus('<span class="spinner"></span> 📍 Detecting your location...');
  navigator.geolocation.getCurrentPosition(
    (pos) => searchCoords(pos.coords.latitude, pos.coords.longitude),
    (err) => locateByIP(geoErrorMessage(err), isAuto),
    GEO_OPTIONS
  );
}
async function locateByIP(precedingNote, isAuto = false) {
  try {
    setStatus('<span class="spinner"></span> 🌐 Estimating your location from your network...');
    const { latitude, longitude, place } = await ipLocate();
    const data = await getWeather(latitude, longitude);
    render(place, data, true);
    rememberView({ type: "coords", lat: latitude, lon: longitude });
    setStatus("🌐 Approximate location from your network — tap 📍 to allow GPS for an exact fix.");
  } catch {
    setStatus(precedingNote || "⚠️ Couldn't detect your location. Please search a city.", true);
    if (isAuto && els.current.hidden) setTimeout(() => searchCity("London"), 1200);
  }
}

// ===== Events =====
function togglePanel(panel) {
  const willOpen = panel.hidden;
  els.searchPanel.hidden = true;
  els.settingsPanel.hidden = true;
  panel.hidden = !willOpen;
  if (willOpen && panel === els.searchPanel) setTimeout(() => els.input.focus(), 50);
}
els.searchToggle.addEventListener("click", () => togglePanel(els.searchPanel));
els.settingsToggle.addEventListener("click", () => togglePanel(els.settingsPanel));

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  closeSuggestions();
  searchCity(els.input.value);
  els.searchPanel.hidden = true;
});
els.input.addEventListener("input", onInput);
els.input.addEventListener("keydown", onKeyDown);
els.input.addEventListener("focus", () => {
  if (els.input.value.trim().length >= 2 && acItems.length) els.suggestions.hidden = false;
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search__field")) closeSuggestions();
});

els.locBtn.addEventListener("click", () => locateMe(false));

// Auto Location toggle
els.autoLocToggle.checked = getAutoLoc();
els.autoLocToggle.addEventListener("change", () => {
  setAutoLoc(els.autoLocToggle.checked);
  if (els.autoLocToggle.checked) locateMe(false);
  else setStatus("📍 Auto Location is off. Search a city or tap 📍 anytime.");
});

// Unit toggle (°C / °F)
function applyUnitButtons() {
  els.unitToggle.querySelectorAll(".unit__btn").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.unit === unit);
  });
}
applyUnitButtons();
els.unitToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".unit__btn");
  if (!btn) return;
  unit = btn.dataset.unit;
  setUnit(unit);
  applyUnitButtons();
  rerender();
});

// ===== Pull-to-refresh =====
const PTR_TRIGGER = 65;
const PTR_MAX = 90;
let ptrStartY = 0, ptrPull = 0, ptrTracking = false, ptrRefreshing = false;
function atTop() { return (window.scrollY || document.documentElement.scrollTop || 0) <= 0; }
function ptrReset() {
  els.ptr.classList.add("snapping");
  els.ptr.classList.remove("ready");
  els.ptr.style.transform = "translateY(-60px)";
  els.ptr.style.opacity = "0";
  setTimeout(() => els.ptr.classList.remove("snapping"), 260);
}
document.addEventListener("touchstart", (e) => {
  if (ptrRefreshing || !atTop() || e.touches.length !== 1) { ptrTracking = false; return; }
  ptrStartY = e.touches[0].clientY; ptrTracking = true; ptrPull = 0;
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (!ptrTracking || ptrRefreshing) return;
  const dy = e.touches[0].clientY - ptrStartY;
  if (dy <= 0 || !atTop()) { if (ptrPull > 0) ptrReset(); ptrTracking = false; return; }
  ptrPull = Math.min(dy * 0.5, PTR_MAX);
  els.ptr.classList.remove("snapping");
  els.ptr.style.transform = `translateY(${ptrPull - 50}px)`;
  els.ptr.style.opacity = String(Math.min(ptrPull / PTR_TRIGGER, 1));
  const ready = ptrPull >= PTR_TRIGGER;
  els.ptr.classList.toggle("ready", ready);
  els.ptrText.textContent = ready ? "Release to refresh" : "Pull to refresh";
}, { passive: true });
document.addEventListener("touchend", () => {
  if (!ptrTracking || ptrRefreshing) return;
  ptrTracking = false;
  if (ptrPull >= PTR_TRIGGER) {
    ptrRefreshing = true;
    els.ptr.classList.add("refreshing", "snapping");
    els.ptr.classList.remove("ready");
    els.ptr.style.transform = "translateY(10px)";
    els.ptr.style.opacity = "1";
    els.ptrText.textContent = "Refreshing…";
    Promise.resolve(refresh()).finally(() => {
      ptrRefreshing = false;
      els.ptr.classList.remove("refreshing");
      els.ptrText.textContent = "Pull to refresh";
      ptrReset();
    });
  } else {
    ptrReset();
  }
});

// ===== Startup =====
window.addEventListener("DOMContentLoaded", () => {
  els.autoLocToggle.checked = getAutoLoc();
  applyUnitButtons();
  const last = loadLastView();
  if (getAutoLoc()) locateMe(true);
  else if (last && last.type === "city") searchCity(last.city);
  else if (last && last.type === "coords") searchCoords(last.lat, last.lon);
  else searchCity("London");
});
