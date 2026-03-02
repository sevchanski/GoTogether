import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import L from "leaflet";

// ✅ Фікс іконок Leaflet у Vite (інакше маркери “зникають”)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const API = "http://localhost:8000";

// Nominatim (адреси)
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// OSRM (маршрут по дорогах)
const OSRM = "https://router.project-osrm.org/route/v1/driving";

export default function CreateTrip() {
  const { access, user, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();

  const canCreate = useMemo(() => isAuthenticated && user?.is_driver, [isAuthenticated, user]);

  // ---- form fields
  const [city, setCity] = useState("Kyiv");
  const [departureTime, setDepartureTime] = useState("");
  const [seatsTotal, setSeatsTotal] = useState(1);
  const [pricePerSeat, setPricePerSeat] = useState("");

  // ---- address inputs + coords
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");

  const [fromPoint, setFromPoint] = useState(null); // {lat,lng,label}
  const [toPoint, setToPoint] = useState(null);

  // suggestions
  const [fromSug, setFromSug] = useState([]);
  const [toSug, setToSug] = useState([]);
  const [loadingFrom, setLoadingFrom] = useState(false);
  const [loadingTo, setLoadingTo] = useState(false);

  // route
  const [routeLine, setRouteLine] = useState([]); // [[lat,lng],...]
  const [routeInfo, setRouteInfo] = useState(null); // {distanceKm, durationMin}

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // map center (простий дефолт по містах)
  const mapCenter = useMemo(() => {
    const centers = {
      Kyiv: [50.4501, 30.5234],
      Lviv: [49.8397, 24.0297],
      Odesa: [46.4825, 30.7233],
      Kharkiv: [49.9935, 36.2304],
      Dnipro: [48.4647, 35.0462],
    };
    return centers[city] || [50.4501, 30.5234];
  }, [city]);

  // debounce timers
  const fromTimer = useRef(null);
  const toTimer = useRef(null);

  // -------- helpers
  const searchAddress = async (q) => {
    // Важливо: додаємо місто в запит, щоб підказки були локальні
    const query = encodeURIComponent(`${q}, ${city}, Ukraine`);
    const url = `${NOMINATIM}?q=${query}&format=json&addressdetails=1&limit=6`;

    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();

    return data.map((x) => ({
      label: x.display_name,
      lat: parseFloat(x.lat),
      lng: parseFloat(x.lon),
    }));
  };

  const buildRoute = async (from, to) => {
    // OSRM очікує lng,lat
    const url = `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Не вдалося побудувати маршрут");

    const data = await res.json();
    const r = data.routes?.[0];
    if (!r) throw new Error("Маршрут не знайдено");

    const coords = r.geometry.coordinates; // [[lng,lat],...]
    const line = coords.map(([lng, lat]) => [lat, lng]);

    return {
      line,
      distanceKm: Math.round((r.distance / 1000) * 10) / 10,
      durationMin: Math.round(r.duration / 60),
    };
  };

  // -------- autocomplete effects
  useEffect(() => {
    setFromSug([]);
    setFromPoint(null);
    setRouteLine([]);
    setRouteInfo(null);

    if (!fromText.trim()) return;
    if (fromTimer.current) clearTimeout(fromTimer.current);

    fromTimer.current = setTimeout(async () => {
      try {
        setLoadingFrom(true);
        const items = await searchAddress(fromText.trim());
        setFromSug(items);
      } finally {
        setLoadingFrom(false);
      }
    }, 350);

    return () => fromTimer.current && clearTimeout(fromTimer.current);
  }, [fromText, city]);

  useEffect(() => {
    setToSug([]);
    setToPoint(null);
    setRouteLine([]);
    setRouteInfo(null);

    if (!toText.trim()) return;
    if (toTimer.current) clearTimeout(toTimer.current);

    toTimer.current = setTimeout(async () => {
      try {
        setLoadingTo(true);
        const items = await searchAddress(toText.trim());
        setToSug(items);
      } finally {
        setLoadingTo(false);
      }
    }, 350);

    return () => toTimer.current && clearTimeout(toTimer.current);
  }, [toText, city]);

  // -------- route effect (коли обидві точки вибрані)
  useEffect(() => {
    const run = async () => {
      if (!fromPoint || !toPoint) return;

      try {
        setError("");
        const r = await buildRoute(fromPoint, toPoint);
        setRouteLine(r.line);
        setRouteInfo({ distanceKm: r.distanceKm, durationMin: r.durationMin });
      } catch (e) {
        setRouteLine([]);
        setRouteInfo(null);
        setError(e?.message || "Помилка побудови маршруту");
      }
    };
    run();
  }, [fromPoint, toPoint]);

  // -------- submit
  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!canCreate) {
      setError("Створювати поїздки може тільки водій.");
      return;
    }

    if (!fromPoint || !toPoint || !departureTime || !pricePerSeat) {
      setError("Заповни всі поля та вибери адреси зі списку.");
      return;
    }

    const payload = {
      origin: fromPoint.label,
      destination: toPoint.label,
      origin_lat: fromPoint.lat,
      origin_lng: fromPoint.lng,
      destination_lat: toPoint.lat,
      destination_lng: toPoint.lng,
      departure_time: departureTime,
      seats_total: Number(seatsTotal),
      seats_available: Number(seatsTotal),
      price_per_seat: Number(pricePerSeat),
      // якщо захочеш додати в модель:
      // city,
      // distance_km: routeInfo?.distanceKm,
      // duration_min: routeInfo?.durationMin,
    };

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/trips/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data === "string" ? data : JSON.stringify(data));
        return;
      }

      navigate("/trips");
    } finally {
      setSaving(false);
    }
  };

  // -------- UI
  return (
    <div style={styles.page}>
      <div style={styles.grid}>
        {/* LEFT: form */}
        <div style={styles.card}>
          <h2 style={styles.h2}>Створити поїздку</h2>

          {!canCreate && (
            <div style={styles.warn}>
              {isAuthenticated
                ? "Твій акаунт не водій (is_driver=false). Зміни в БД або зроби кнопку 'Стати водієм'."
                : "Спочатку увійди в акаунт водія."}
            </div>
          )}

          <form onSubmit={submit} style={styles.form}>
            <label style={styles.label}>
              Місто
              <select
                style={styles.input}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="Kyiv">Київ</option>
                <option value="Lviv">Львів</option>
                <option value="Odesa">Одеса</option>
                <option value="Kharkiv">Харків</option>
                <option value="Dnipro">Дніпро</option>
              </select>
            </label>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={styles.label}>Звідки</label>
              <div style={styles.autoWrap}>
                <input
                  style={styles.input}
                  placeholder="Введи вулицю/будинок…"
                  value={fromText}
                  onChange={(e) => setFromText(e.target.value)}
                />
                {loadingFrom && <div style={styles.loading}>пошук…</div>}
                {!!fromSug.length && (
                  <div style={styles.suggestBox}>
                    {fromSug.map((s, idx) => (
                      <button
                        type="button"
                        key={idx}
                        style={styles.suggestItem}
                        onClick={() => {
                          setFromPoint(s);
                          setFromText(s.label);
                          setFromSug([]);
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={styles.label}>Куди</label>
              <div style={styles.autoWrap}>
                <input
                  style={styles.input}
                  placeholder="Введи вулицю/будинок…"
                  value={toText}
                  onChange={(e) => setToText(e.target.value)}
                />
                {loadingTo && <div style={styles.loading}>пошук…</div>}
                {!!toSug.length && (
                  <div style={styles.suggestBox}>
                    {toSug.map((s, idx) => (
                      <button
                        type="button"
                        key={idx}
                        style={styles.suggestItem}
                        onClick={() => {
                          setToPoint(s);
                          setToText(s.label);
                          setToSug([]);
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <label style={styles.label}>
              Час відправлення
              <input
                style={styles.input}
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
              />
            </label>

            <label style={styles.label}>
              Кількість місць
              <input
                style={styles.input}
                type="number"
                min="1"
                value={seatsTotal}
                onChange={(e) => setSeatsTotal(e.target.value)}
              />
            </label>

            <label style={styles.label}>
              Ціна за місце (грн)
              <input
                style={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={pricePerSeat}
                onChange={(e) => setPricePerSeat(e.target.value)}
              />
            </label>

            {routeInfo && (
              <div style={styles.routeInfo}>
                Маршрут: <b>{routeInfo.distanceKm} км</b> • <b>{routeInfo.durationMin} хв</b>
              </div>
            )}

            {error && <div style={styles.error}>{error}</div>}

            <button style={styles.btn} type="submit" disabled={!canCreate || saving}>
              {saving ? "Створюю…" : "Опублікувати"}
            </button>
          </form>
        </div>

        {/* RIGHT: map */}
        <div style={styles.mapCard}>
          <div style={styles.mapHeader}>
            <div style={{ fontWeight: 800 }}>Маршрут на мапі</div>
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              Обери точки — лінія промалюється автоматично
            </div>
          </div>

          <div style={styles.mapWrap}>
            <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {fromPoint && <Marker position={[fromPoint.lat, fromPoint.lng]} />}
              {toPoint && <Marker position={[toPoint.lat, toPoint.lng]} />}

              {routeLine.length > 1 && (
                <Polyline positions={routeLine} pathOptions={{ weight: 6 }} />
              )}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------- styles
const styles = {
  page: {
    padding: 20,
    display: "flex",
    justifyContent: "center",
    background: "#f5f6f8",
    minHeight: "calc(100vh - 70px)",
  },
  grid: {
    width: "100%",
    maxWidth: 1120,
    display: "grid",
    gridTemplateColumns: "1fr 1.2fr",
    gap: 16,
    alignItems: "start",
  },
  card: {
    background: "white",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },
  mapCard: {
    background: "white",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },
  mapHeader: {
    padding: 14,
    borderBottom: "1px solid #eee",
    display: "grid",
    gap: 4,
  },
  mapWrap: { height: 520 },

  h2: { margin: 0, marginBottom: 10 },
  form: { display: "grid", gap: 12 },
  label: { display: "grid", gap: 6, fontSize: 13, color: "#333" },

  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    outline: "none",
    fontSize: 14,
  },

  btn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    background: "#111",
    color: "white",
    fontWeight: 800,
  },

  error: { color: "#b00020", background: "#ffe8ee", padding: 10, borderRadius: 10 },
  warn: { background: "#fff6d6", padding: 10, borderRadius: 10, marginBottom: 10 },

  autoWrap: { position: "relative" },
  suggestBox: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "white",
    border: "1px solid #ddd",
    borderRadius: 10,
    overflow: "hidden",
    zIndex: 20,
    boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
    maxHeight: 220,
    overflowY: "auto",
  },
  suggestItem: {
    width: "100%",
    textAlign: "left",
    padding: "10px 10px",
    border: "none",
    background: "white",
    cursor: "pointer",
    fontSize: 13,
    borderBottom: "1px solid #f1f1f1",
  },
  loading: {
    position: "absolute",
    right: 10,
    top: 12,
    fontSize: 12,
    opacity: 0.6,
  },

  routeInfo: {
    background: "#eef6ff",
    border: "1px solid #cfe6ff",
    padding: 10,
    borderRadius: 10,
    fontSize: 13,
  },
};