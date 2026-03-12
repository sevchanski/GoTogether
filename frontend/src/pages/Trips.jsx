import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8000";

function normalizeTripsResponse(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function shortPlace(s) {
  if (!s) return "";
  const parts = s.split(",").map(x => x.trim()).filter(Boolean);
  const cityLike = parts.find(p => /київ|kyiv|львів|lviv|одеса|odesa|харків|kharkiv/i.test(p));
  if (cityLike && parts.length >= 2) {
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

  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [seatsMap, setSeatsMap] = useState({});

  const [bookingId, setBookingId] = useState(null);
  const [success, setSuccess] = useState(false);

  const url = useMemo(() => {
    const u = new URL(`${API}/api/trips/`);
    if (city) u.searchParams.set("city", city);
    if (q.trim()) u.searchParams.set("search", q.trim());
    return u.toString();
  }, [city, q]);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr("Не вдалося завантажити дані");
        setTrips([]);
      } else {
        setTrips(normalizeTripsResponse(data));
      }
    } catch (e) {
      setErr("Не вдалося завантажити поїздки");
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [url]);

  const joinTrip = async (trip) => {
    if (!token) {
      navigate("/login");
      return;
    }

    setBookingId(trip.id);
    setErr("");

    const wanted = toNumber(seatsMap[trip.id] ?? 1, 1);
    const maxSeats = toNumber(trip.seats_available ?? 1, 1);
    const seatsBooked = Math.max(1, Math.min(maxSeats, wanted));

    try {
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
        // Виправлення: дістаємо чистий текст помилки
        let msg = "Сталася помилка при бронюванні";
        if (typeof data === "object" && data !== null) {
          const firstKey = Object.keys(data)[0];
          const val = data[firstKey];
          msg = Array.isArray(val) ? val[0] : val;
        } else if (typeof data === "string") {
          msg = data;
        }

        setErr(msg);
        setBookingId(null);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        navigate(`/checkout/${data.id}`);
      }, 1500);
    } catch (e) {
      setErr("Помилка з'єднання");
      setBookingId(null);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto", background: "#f8f9fa", minHeight: "100vh", position: "relative" }}>
      <h2 style={{ marginTop: 0, fontWeight: 800, color: "#000000" }}>Доступні поїздки</h2>

      <div style={styles.filters}>
        <div style={styles.field}>
          <label style={styles.label}>Місто</label>
          <input
            style={styles.input}
            placeholder="Напр. Kyiv"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
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

        <button
          style={styles.btn}
          onClick={load}
          disabled={loading}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#0041a3")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#0052cc")}
        >
          {loading ? "Завантаження" : "Застосувати"}
        </button>
      </div>

      {err && <div style={styles.error}>{err}</div>}

      {trips.map((trip) => {
        const available = toNumber(trip.seats_available ?? 0, 0);
        const total = toNumber(trip.seats_total ?? 0, 0);
        const price = toNumber(trip.price_per_seat ?? 0, 0);
        const wanted = toNumber(seatsMap[trip.id] ?? 1, 1);
        const maxSeats = Math.max(1, available || 1);
        const safeWanted = Math.max(1, Math.min(maxSeats, wanted));
        const totalPrice = (price * safeWanted).toFixed(2);
        const isBookingThis = bookingId === trip.id;

        return (
          <div key={trip.id} style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ color: "#000000" }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  {shortPlace(trip.origin)} → {shortPlace(trip.destination)}
                </div>
                <div style={{ marginTop: 8, fontSize: 14 }}>
                  Ціна за місце: <span style={{ fontWeight: 700 }}>{price} грн</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 14, opacity: 0.8 }}>
                  Вільних місць: <span style={{ fontWeight: 600 }}>{available} / {total}</span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <label style={{ fontSize: 12, marginBottom: 4, fontWeight: 700, color: "#000000" }}>Кількість місць:</label>
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
                    style={styles.seatsInput}
                  />
                </div>

                <div style={{ textAlign: "right", minWidth: 100 }}>
                  <div style={{ fontSize: 12, opacity: 0.7, color: "#000000" }}>Разом:</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#000000" }}>{totalPrice} ₴</div>
                </div>

                <button
                  onClick={() => joinTrip(trip)}
                  disabled={available <= 0 || isBookingThis}
                  onMouseEnter={(e) => available > 0 && !isBookingThis && (e.currentTarget.style.background = "#0041a3")}
                  onMouseLeave={(e) => available > 0 && !isBookingThis && (e.currentTarget.style.background = "#0052cc")}
                  style={{
                    ...styles.joinBtn,
                    opacity: (available <= 0 || isBookingThis) ? 0.4 : 1,
                    cursor: (available <= 0 || isBookingThis) ? "not-allowed" : "pointer",
                    minWidth: "160px"
                  }}
                >
                  {isBookingThis ? "Бронюємо..." : (token ? (available <= 0 ? "Місць немає" : "Приєднатись") : "Увійти")}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {success && (
        <div style={styles.toast}>
          ✅ Місце успішно заброньовано!
        </div>
      )}
    </div>
  );
}

const styles = {
  filters: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    gap: 16,
    alignItems: "end",
    marginBottom: 24,
    background: "#fff",
    border: "1px solid #e1e4e8",
    padding: "20px",
    borderRadius: 16,
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  },
  field: { display: "grid", gap: 6 },
  label: { fontSize: 13, fontWeight: 700, color: "#000000" },
  input: {
    padding: "12px",
    borderRadius: 12,
    border: "1px solid #d1d5da",
    fontSize: 14,
    outline: "none",
    color: "#000000"
  },
  btn: {
    padding: "12px 24px",
    borderRadius: 12,
    border: "none",
    background: "#0052cc",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
    minWidth: "140px",
    whiteSpace: "nowrap",
    textAlign: "center",
    transition: "background 0.2s",
  },
  error: {
    marginBottom: 14,
    color: "#b00020",
    background: "#ffe8ee",
    padding: "12px 16px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    border: "1px solid #ffcdd2",
    textTransform: "capitalize"
  },
  card: {
    border: "1px solid #e1e4e8",
    padding: "20px 24px",
    borderRadius: 18,
    marginBottom: 16,
    background: "#fff",
    boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
  },
  seatsInput: {
    width: 70,
    padding: "8px",
    borderRadius: 10,
    border: "1px solid #d1d5da",
    textAlign: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "#000000"
  },
  joinBtn: {
    padding: "14px 24px",
    borderRadius: 12,
    border: "none",
    background: "#0052cc",
    color: "white",
    fontWeight: 700,
    fontSize: 15,
    textAlign: "center",
    transition: "all 0.2s ease",
  },
  toast: {
    position: "fixed",
    bottom: 30,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#16a34a",
    color: "white",
    padding: "14px 28px",
    borderRadius: 14,
    fontWeight: 700,
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
    zIndex: 1000,
  },
};