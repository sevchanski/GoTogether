import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API = "http://localhost:8000";

// Fix Marker Icons
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// --- Helpers ---
async function geocodeSuggest(q, city = "", signal) {
  const query = (q || "").trim();
  if (query.length < 3) return [];
  const fullQ = city ? `${query}, ${city}` : query;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullQ)}&format=json&addressdetails=1&limit=7`;

  try {
    const res = await fetch(url, { signal, headers: { "Accept": "application/json" } });
    const data = await res.json();
    return (data || []).map(x => ({
      label: x.display_name,
      lat: Number(x.lat),
      lng: Number(x.lon),
      address: x.address || {}
    }));
  } catch (e) { return []; }
}

async function buildRouteOSRM(a, b) {
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  const r = data?.routes?.[0];
  if (!r) throw new Error("No route");
  return {
    coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: (r.distance || 0) / 1000,
    durationMin: Math.round((r.duration || 0) / 60)
  };
}

async function refreshAccessToken(refresh) {
  const res = await fetch(`${API}/api/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Refresh failed");
  return data.access;
}

export default function CreateTrip() {
  const { access, refresh, user, isAuthenticated, login, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const mapRef = useRef(null);

  const [city, setCity] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [seatsTotal, setSeatsTotal] = useState(1);
  const [pricePerSeat, setPricePerSeat] = useState("");
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [originPlace, setOriginPlace] = useState(null);
  const [destPlace, setDestPlace] = useState(null);
  const [originSug, setOriginSug] = useState([]);
  const [destSug, setDestSug] = useState([]);
  const [openOriginSug, setOpenOriginSug] = useState(false);
  const [openDestSug, setOpenDestSug] = useState(false);
  const [routeLine, setRouteLine] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const canCreate = useMemo(() => isAuthenticated && user?.is_driver, [isAuthenticated, user]);

  // Handle Suggestions with AbortController
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(async () => {
      if (originText.length < 3 || originPlace?.label === originText) return;
      const list = await geocodeSuggest(originText, city, controller.signal);
      setOriginSug(list);
      setOpenOriginSug(true);
    }, 500);
    return () => { controller.abort(); clearTimeout(t); };
  }, [originText, city]);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(async () => {
      if (destText.length < 3 || destPlace?.label === destText) return;
      const list = await geocodeSuggest(destText, city, controller.signal);
      setDestSug(list);
      setOpenDestSug(true);
    }, 500);
    return () => { controller.abort(); clearTimeout(t); };
  }, [destText, city]);

  useEffect(() => {
    if (!originPlace || !destPlace) return;
    buildRouteOSRM(originPlace, destPlace).then(r => {
      setRouteLine(r.coords);
      setRouteInfo(r);
      if (mapRef.current) mapRef.current.fitBounds(L.latLngBounds(r.coords), { padding: [40, 40] });
    });
  }, [originPlace, destPlace]);

  const submit = async (e) => {
    e.preventDefault();
    if (!originPlace || !destPlace || !departureTime || !pricePerSeat) {
        setError("Будь ласка, заповніть всі поля та оберіть адреси зі списку.");
        return;
    }
    setError("");
    setBusy(true);

    const payload = {
      city, origin: originText, origin_lat: originPlace.lat, origin_lng: originPlace.lng,
      destination: destText, destination_lat: destPlace.lat, destination_lng: destPlace.lng,
      route_geometry: routeLine, distance_km: routeInfo?.distanceKm, duration_min: routeInfo?.durationMin,
      departure_time: departureTime, seats_total: Number(seatsTotal), price_per_seat: Number(pricePerSeat),
    };

    const doPost = async (token) => {
      return fetch(`${API}/api/trips/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
    };

    try {
      let res = await doPost(access);
      if (res.status === 401 && refresh) {
        const newAccess = await refreshAccessToken(refresh);
        await login(newAccess, refresh);
        res = await doPost(newAccess);
      }
      if (res.ok) navigate("/trips");
      else {
        const data = await res.json();
        setError(JSON.stringify(data));
      }
    } catch (err) { setError("Помилка мережі"); }
    finally { setBusy(false); }
  };

  return (
    <div style={styles.page}>
      <style>{`
        .suggest-wrap { position: relative; width: 100%; }
        .dropdown-menu {
          position: absolute; top: 100%; left: 0; right: 0;
          background: white; border-radius: 8px; border: 1px solid #ddd;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          z-index: 9999 !important; margin-top: 4px;
          max-height: 180px; overflow-y: auto;
        }
        .dropdown-item {
          padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #eee;
          font-size: 13px; color: #333;
        }
        .dropdown-item:hover { background: #f0f7ff; }
        .leaflet-container { z-index: 1 !important; border-radius: 12px; }
      `}</style>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={{ marginBottom: "12px" }}>Створити поїздку</h2>
          <form onSubmit={submit} style={styles.form}>
            <label style={styles.label}>Місто
              <input style={styles.input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Наприклад: Київ" />
            </label>

            <div className="suggest-wrap">
              <label style={styles.label}>Звідки
                <input style={styles.input} value={originText} onChange={(e) => setOriginText(e.target.value)} placeholder="Вулиця, номер..." autoComplete="off" />
              </label>
              {openOriginSug && originSug.length > 0 && (
                <div className="dropdown-menu">
                  {originSug.map((s, i) => (
                    <div key={i} className="dropdown-item" onClick={() => { setOriginPlace(s); setOriginText(s.label); setOpenOriginSug(false); }}>{s.label}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="suggest-wrap">
              <label style={styles.label}>Куди
                <input style={styles.input} value={destText} onChange={(e) => setDestText(e.target.value)} placeholder="Куди прямуємо?" autoComplete="off" />
              </label>
              {openDestSug && destSug.length > 0 && (
                <div className="dropdown-menu">
                  {destSug.map((s, i) => (
                    <div key={i} className="dropdown-item" onClick={() => { setDestPlace(s); setDestText(s.label); setOpenDestSug(false); }}>{s.label}</div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.row2}>
              <label style={styles.label}>Дата та час
                <input style={styles.input} type="datetime-local" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} />
              </label>
              <label style={styles.label}>Кількість місць
                <input style={styles.input} type="number" min="1" value={seatsTotal} onChange={(e) => setSeatsTotal(e.target.value)} />
              </label>
            </div>

            <label style={styles.label}>Ціна за одне місце (₴)
              <input style={{...styles.input, border: '1px solid #3b82f6'}} type="number" value={pricePerSeat} onChange={(e) => setPricePerSeat(e.target.value)} placeholder="0.00" />
            </label>

            {routeInfo && (
              <div style={styles.routeBox}>
                Відстань: <b>{routeInfo.distanceKm.toFixed(1)} км</b> • Час: ~<b>{routeInfo.durationMin} хв</b>
              </div>
            )}

            {error && <div style={styles.error}>{error}</div>}
            <button style={styles.btn} type="submit" disabled={busy || !canCreate}>
              {busy ? "Зберігаємо..." : "Опублікувати поїздку"}
            </button>
          </form>
        </div>

        <div style={styles.mapCard}>
          <MapContainer center={[50.45, 30.52]} zoom={11} style={{ height: "100%", width: "100%" }} ref={mapRef}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {originPlace && <Marker position={[originPlace.lat, originPlace.lng]} />}
            {destPlace && <Marker position={[destPlace.lat, destPlace.lng]} />}
            {routeLine.length > 0 && <Polyline positions={routeLine} color="#3b82f6" weight={5} />}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: "20px", maxWidth: "1200px", margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "20px", flex: 1, minHeight: 0 },
  card: { background: "white", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", overflowY: "visible", display: "flex", flexDirection: "column" },
  form: { display: "flex", flexDirection: "column", gap: "12px" },
  label: { fontSize: "12px", fontWeight: "700", color: "#555", display: "flex", flexDirection: "column", gap: "4px" },
  input: { padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", outline: "none" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  routeBox: { padding: "10px", background: "#f0f7ff", borderRadius: "8px", color: "#2563eb", fontSize: "13px", textAlign: "center" },
  error: { color: "#dc2626", fontSize: "12px", background: "#fef2f2", padding: "8px", borderRadius: "6px" },
  btn: { padding: "14px", background: "#111", color: "white", borderRadius: "10px", border: "none", fontWeight: "700", cursor: "pointer", marginTop: "5px" },
  mapCard: { background: "white", borderRadius: "16px", padding: "10px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }
};