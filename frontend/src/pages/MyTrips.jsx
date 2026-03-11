import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://127.0.0.1:8000";

function shortPlace(s) {
  if (!s) return "";
  const parts = s.split(",").map(x => x.trim()).filter(Boolean);
  return parts.slice(0, 2).join(", ");
}

function formatDateTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusLabel(status) {
  switch (status) {
    case "pending":
      return "Очікує рішення водія";
    case "approved_pending_payment":
      return "Очікує оплату";
    case "paid":
      return "Оплачено";
    case "rejected":
      return "Відхилено";
    case "canceled":
      return "Скасовано";
    default:
      return status;
  }
}

export default function MyTrips() {
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = localStorage.getItem("refresh");

  const refreshAccess = async () => {
    if (!refresh) return null;

    const res = await fetch(`${API}/api/token/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;

    localStorage.setItem("access", data.access);
    return data.access;
  };

  const authFetch = async (url, options = {}) => {
    let token = localStorage.getItem("access");

    let res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 401) {
      const newAccess = await refreshAccess();
      if (!newAccess) {
        localStorage.clear();
        navigate("/login");
        return null;
      }

      res = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${newAccess}`
        }
      });
    }

    return res;
  };

  const loadBookings = async () => {
    setLoading(true);
    setError("");

    const res = await authFetch(`${API}/api/bookings/`);
    if (!res) return;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(typeof data === "string" ? data : JSON.stringify(data));
      setLoading(false);
      return;
    }

    const items = Array.isArray(data) ? data : data.results || [];
    setBookings(items);
    setLoading(false);
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const passengerBookings = useMemo(() => {
    return bookings.filter((b) => b.passenger);
  }, [bookings]);

  const grouped = useMemo(() => {
    return {
      pending: passengerBookings.filter(b => b.status === "pending"),
      payment: passengerBookings.filter(b => b.status === "approved_pending_payment"),
      paid: passengerBookings.filter(b => b.status === "paid"),
      others: passengerBookings.filter(
        b => !["pending", "approved_pending_payment", "paid"].includes(b.status)
      ),
    };
  }, [passengerBookings]);

  const renderCard = (booking) => {
    const trip = booking.trip_details || {};
    const total =
      booking.total_price ??
      (
        Number(trip.price_per_seat || 0) *
        Number(booking.seats_booked || 0)
      ).toFixed(2);

    return (
      <div key={booking.id} style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.route}>
              {shortPlace(trip.origin)} → {shortPlace(trip.destination)}
            </div>
            <div style={styles.meta}>
              {formatDateTime(trip.departure_time)}
            </div>
          </div>

          <div style={styles.statusBadge(booking.status)}>
            {statusLabel(booking.status)}
          </div>
        </div>

        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Місць</span>
            <b>{booking.seats_booked}</b>
          </div>

          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Ціна за місце</span>
            <b>{trip.price_per_seat} грн</b>
          </div>

          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Загальна сума</span>
            <b>{total} грн</b>
          </div>
        </div>

        {booking.status === "approved_pending_payment" && (
          <div style={styles.actions}>
            <button
              style={styles.primaryBtn}
              onClick={() => navigate(`/checkout/${booking.id}`)}
            >
              Перейти до оплати
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={{ marginTop: 0 }}>Мої поїздки</h2>

        {loading && <div>Завантаження...</div>}
        {error && <div style={styles.error}>{error}</div>}

        {!loading && !passengerBookings.length && (
          <div style={styles.empty}>
            У вас поки немає заявок або бронювань.
          </div>
        )}

        {!!grouped.pending.length && (
          <section style={styles.section}>
            <h3>Очікують рішення</h3>
            <div style={styles.list}>
              {grouped.pending.map(renderCard)}
            </div>
          </section>
        )}

        {!!grouped.payment.length && (
          <section style={styles.section}>
            <h3>Очікують оплату</h3>
            <div style={styles.list}>
              {grouped.payment.map(renderCard)}
            </div>
          </section>
        )}

        {!!grouped.paid.length && (
          <section style={styles.section}>
            <h3>Оплачені</h3>
            <div style={styles.list}>
              {grouped.paid.map(renderCard)}
            </div>
          </section>
        )}

        {!!grouped.others.length && (
          <section style={styles.section}>
            <h3>Інші</h3>
            <div style={styles.list}>
              {grouped.others.map(renderCard)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: 30,
    background: "#f5f6f9",
    minHeight: "100vh"
  },
  container: {
    maxWidth: 980,
    margin: "0 auto"
  },
  section: {
    marginTop: 24
  },
  list: {
    display: "grid",
    gap: 14
  },
  card: {
    background: "white",
    borderRadius: 18,
    padding: 18,
    border: "1px solid #eee",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)"
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "start",
    marginBottom: 14
  },
  route: {
    fontWeight: 800,
    fontSize: 17
  },
  meta: {
    marginTop: 6,
    opacity: 0.75,
    fontSize: 14
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginTop: 8
  },
  infoItem: {
    background: "#fafafa",
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 6
  },
  infoLabel: {
    fontSize: 12,
    opacity: 0.7
  },
  actions: {
    marginTop: 16,
    display: "flex",
    justifyContent: "flex-end"
  },
  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    background: "#111",
    color: "white",
    cursor: "pointer",
    fontWeight: 700
  },
  error: {
    marginTop: 14,
    background: "#ffe8ee",
    color: "#b00020",
    padding: 12,
    borderRadius: 12
  },
  empty: {
    marginTop: 20,
    background: "white",
    border: "1px solid #eee",
    borderRadius: 16,
    padding: 20,
    textAlign: "center",
    opacity: 0.8
  },
  statusBadge: (status) => {
    let bg = "#f3f4f6";
    let color = "#111";

    if (status === "pending") {
      bg = "#eef2ff";
      color = "#3730a3";
    } else if (status === "approved_pending_payment") {
      bg = "#fff7e6";
      color = "#9a6700";
    } else if (status === "paid") {
      bg = "#e9fbe9";
      color = "#1a7f37";
    } else if (status === "rejected" || status === "canceled") {
      bg = "#ffe8ee";
      color = "#b00020";
    }

    return {
      background: bg,
      color,
      padding: "8px 12px",
      borderRadius: 999,
      fontSize: 13,
      fontWeight: 700,
      whiteSpace: "nowrap"
    };
  }
};