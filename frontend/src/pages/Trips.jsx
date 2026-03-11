import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8000";

function normalizeTripsResponse(data) {
  // DRF може повернути або масив, або { results: [...] }
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

// показуємо коротко: "Вулиця, Місто"
function shortPlace(s) {
  if (!s) return "";
  const parts = s.split(",").map(x => x.trim()).filter(Boolean);

  // часто приходить: "Street, District, City, Region, Ukraine, 01001"
  // беремо street + city (якщо є)
  const cityLike = parts.find(p => /київ|kyiv|львів|lviv|одеса|odesa|харків|kharkiv/i.test(p));
  if (cityLike && parts.length >= 2) {
    // street = перша частина
    return `${parts[0]}, ${cityLike}`;
  }

  return parts.slice(0, 2).join(", ");
}

function toNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export default function Trips() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access");

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // фільтри
  const [city, setCity] = useState("");
  const [q, setQ] = useState(""); // пошук (вулиця/маршрут/адреса)
  const [cities, setCities] = useState([]);

  // seats input per trip
  const [seatsMap, setSeatsMap] = useState({}); // { [tripId]: seatsWanted }

  // ✅ завантажити список міст (якщо є endpoint /api/cities/)
  useEffect(() => {
    fetch(`${API}/api/cities/`)
      .then(r => r.json())
      .then(data => {
        // ти зараз повертаєш origins/destinations; для city нам краще city list
        // але якщо city endpoint нема — просто не показуємо селект
        // тут зробимо fallback: витягнемо з origins перші слова
        const list = [];
        if (Array.isArray(data?.cities)) list.push(...data.cities);
        setCities(list);
      })
      .catch(() => {});
  }, []);

  const url = useMemo(() => {
    const u = new URL(`${API}/api/trips/`);
    if (city) u.searchParams.set("city", city);
    if (q.trim()) u.searchParams.set("search", q.trim()); // DRF SearchFilter
    return u.toString();
  }, [city, q]);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(JSON.stringify(data));
        setTrips([]);
      } else {
        setTrips(normalizeTripsResponse(data));
      }
    } catch (e) {
      setErr("Не вдалося завантажити поїздки (бекенд не відповідає?)");
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [url]);

  const joinTrip = async (trip) => {
    if (!token) {
      navigate("/login");
      return;
    }

    const wanted = toNumber(seatsMap[trip.id] ?? 1, 1);
    const maxSeats = toNumber(trip.seats_available ?? 1, 1);
    const seatsBooked = Math.max(1, Math.min(maxSeats, wanted));

    const res = await fetch(`${API}/api/bookings/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ trip: trip.id, seats_booked: seatsBooked }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert("Помилка бронювання: " + JSON.stringify(data));
      return;
    }

    navigate(`/checkout/${data.id}`);
  };

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>Доступні поїздки</h2>

      {/* Фільтри */}
      <div style={styles.filters}>
        <div style={styles.field}>
          <label style={styles.label}>Місто</label>
          <input
            style={styles.input}
            placeholder="Напр. Kyiv"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          {/* якщо зробиш нормальний список міст — замінимо на select */}
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Пошук по маршруту / вулиці</label>
          <input
            style={styles.input}
            placeholder="Напр. Хрещатик"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <button style={styles.btn} onClick={load} disabled={loading}>
          {loading ? "Завантаження..." : "Застосувати"}
        </button>
      </div>

      {err && <div style={styles.error}>{err}</div>}

      {loading && !trips.length && <div>Завантаження…</div>}

      {!loading && !trips.length && (
        <div style={{ opacity: 0.8 }}>Нічого не знайдено</div>
      )}

      {trips.map((trip) => {
        const available = toNumber(trip.seats_available ?? 0, 0);
        const total = toNumber(trip.seats_total ?? 0, 0);
        const price = toNumber(trip.price_per_seat ?? 0, 0);

        const wanted = toNumber(seatsMap[trip.id] ?? 1, 1);
        const maxSeats = Math.max(1, available || 1);
        const safeWanted = Math.max(1, Math.min(maxSeats, wanted));

        const totalPrice = (price * safeWanted).toFixed(2);

        return (
          <div key={trip.id} style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>
                  {shortPlace(trip.origin)} → {shortPlace(trip.destination)}
                </div>
                <div style={{ marginTop: 6, opacity: 0.85 }}>
                  Ціна за місце: <b>{price}</b> грн
                </div>
                <div style={{ marginTop: 6, opacity: 0.85 }}>
                  Місця: <b>{available}</b> / {total}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ fontSize: 13 }}>
                  Місць:
                  <input
                    type="number"
                    min="1"
                    max={maxSeats}
                    value={safeWanted}
                    onChange={(e) =>
                      setSeatsMap((prev) => ({
                        ...prev,
                        [trip.id]: e.target.value,
                      }))
                    }
                    style={{ width: 84, marginLeft: 8, padding: 6, borderRadius: 10, border: "1px solid #ccc" }}
                  />
                </label>

                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Разом: <b>{totalPrice}</b> грн
                </div>

                <button
                  onClick={() => joinTrip(trip)}
                  disabled={available <= 0}
                  style={{
                    ...styles.joinBtn,
                    opacity: available <= 0 ? 0.55 : 1,
                    cursor: available <= 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {token ? "Приєднатись" : "Увійти"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  filters: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    gap: 12,
    alignItems: "end",
    marginBottom: 16,
    background: "#fff",
    border: "1px solid #eee",
    padding: 14,
    borderRadius: 14,
  },
  field: { display: "grid", gap: 6 },
  label: { fontSize: 12, opacity: 0.7 },
  input: { padding: 10, borderRadius: 12, border: "1px solid #ddd" },
  btn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    background: "#111",
    color: "#fff",
    fontWeight: 700,
  },
  error: { marginBottom: 14, color: "#b00020", background: "#ffe8ee", padding: 12, borderRadius: 12 },
  card: { border: "1px solid #eee", padding: 16, borderRadius: 14, marginBottom: 12, background: "#fff" },
  joinBtn: { padding: "10px 14px", borderRadius: 12, border: "none", background: "#111", color: "white", fontWeight: 700 },
};