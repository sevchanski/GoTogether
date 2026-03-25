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
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function statusLabel(status) {
  const labels = {
    pending: "Очікує рішення водія",
    pending_payment: "Очікує оплату",
    approved: "Оплачено",
    rejected: "Відхилено",
    canceled: "Скасовано"
  };
  return labels[status] || status;
}

function tripStatusLabel(status) {
  const labels = {
    active: "Активна",
    full: "Заповнена",
    completed: "Завершена",
    canceled: "Скасована"
  };
  return labels[status] || status;
}

export default function MyTrips() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshAccess = async () => {
    const refresh = localStorage.getItem("refresh");
    if (!refresh) return null;
    const res = await fetch(`${API}/api/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
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
        headers: { ...(options.headers || {}), Authorization: `Bearer ${newAccess}` }
      });
    }
    return res;
  };

  const loadBookings = async () => {
    setLoading(true);
    const res = await authFetch(`${API}/api/bookings/`);
    if (!res) return;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data === "string" ? data : JSON.stringify(data));
    } else {
      setBookings(Array.isArray(data) ? data : data.results || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBookings();

    // Оновлювати список, коли користувач повертається на вкладку (наприклад, після залишення відгуку)
    const handleFocus = () => loadBookings();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const passengerBookings = useMemo(() => {
    if (!currentUser?.id) return [];
    return bookings.filter((b) => {
      const isPassenger = b.passenger?.id === currentUser.id;
      const isNotDriver = b.trip_details?.driver?.id !== currentUser.id;
      // ХОВАТИ, ЯКЩО ВІДГУК ВЖЕ Є (is_reviewed: true)
      return isPassenger && isNotDriver && !b.is_reviewed;
    });
  }, [bookings, currentUser]);

  const grouped = useMemo(() => {
    return {
      pending: passengerBookings.filter((b) => b.status === "pending"),
      payment: passengerBookings.filter((b) => b.status === "pending_payment"),
      approved: passengerBookings.filter((b) => b.status === "approved"),
      others: passengerBookings.filter(
        (b) => !["pending", "pending_payment", "approved"].includes(b.status)
      ),
    };
  }, [passengerBookings]);

  const renderCard = (booking) => {
    const trip = booking.trip_details || {};
    const total = booking.total_price || (Number(trip.price_per_seat || 0) * Number(booking.seats_booked || 0)).toFixed(2);

    return (
      <div key={booking.id} style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.route}>{shortPlace(trip.origin)} → {shortPlace(trip.destination)}</div>
            <div style={styles.meta}>{formatDateTime(trip.departure_time)}</div>
            <div style={styles.meta}>Статус поїздки: <b>{tripStatusLabel(trip.status)}</b></div>
          </div>
          <div style={styles.statusBadge(booking.status)}>{statusLabel(booking.status)}</div>
        </div>

        <div style={styles.infoGrid}>
          <div style={styles.infoItem}><span style={styles.infoLabel}>Місць</span><b>{booking.seats_booked}</b></div>
          <div style={styles.infoItem}><span style={styles.infoLabel}>Ціна</span><b>{trip.price_per_seat} грн</b></div>
          <div style={styles.infoItem}><span style={styles.infoLabel}>Сума</span><b>{total} грн</b></div>
        </div>

        <div style={styles.actions}>
          {booking.status === "pending_payment" && (
            <button style={styles.primaryBtn} onClick={() => navigate(`/checkout/${booking.id}`)}>Оплатити</button>
          )}
          {booking.status === "approved" && trip.status === "completed" && (
            <button style={styles.reviewBtn} onClick={() => navigate(`/leave-review?trip=${trip.id}&reviewee=${trip.driver.id}`)}>
              Оцінити водія
            </button>
          )}
        </div>
        {booking.status === "approved" && trip.status !== "completed" && (
            <div style={styles.paidBox}>Бронювання підтверджене та оплачене</div>
        )}
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2>Мої поїздки</h2>
        {loading && <div>Завантаження...</div>}
        {error && <div style={styles.error}>{error}</div>}
        {!loading && !passengerBookings.length && <div style={styles.empty}>У вас поки немає активних заявок.</div>}

        {Object.entries(grouped).map(([key, list]) => (
          list.length > 0 && (
            <section key={key} style={styles.section}>
              <h3>{key === 'pending' ? 'Очікують рішення' : key === 'payment' ? 'Очікують оплату' : key === 'approved' ? 'Підтверджені' : 'Інші'}</h3>
              <div style={styles.list}>{list.map(renderCard)}</div>
            </section>
          )
        ))}
      </div>
    </div>
  );
}

// ... (стилі styles залишаються без змін з вашого коду) ...
const styles = {
    page: { padding: 30, background: "#f5f6f9", minHeight: "100vh" },
    container: { maxWidth: 980, margin: "0 auto" },
    section: { marginTop: 24 },
    list: { display: "grid", gap: 14 },
    card: { background: "white", borderRadius: 18, padding: 18, border: "1px solid #eee", boxShadow: "0 8px 24px rgba(0,0,0,0.06)" },
    cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 14 },
    route: { fontWeight: 800, fontSize: 17 },
    meta: { marginTop: 6, opacity: 0.75, fontSize: 14 },
    infoGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 8 },
    infoItem: { background: "#fafafa", border: "1px solid #eee", borderRadius: 12, padding: 12, display: "grid", gap: 6 },
    infoLabel: { fontSize: 12, opacity: 0.7 },
    actions: { marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10 },
    primaryBtn: { padding: "10px 14px", borderRadius: 12, border: "none", background: "#111", color: "white", cursor: "pointer", fontWeight: 700 },
    reviewBtn: { padding: "10px 14px", borderRadius: 12, border: "none", background: "#3730a3", color: "white", cursor: "pointer", fontWeight: 700 },
    paidBox: { marginTop: 16, background: "#e9fbe9", color: "#1a7f37", padding: 12, borderRadius: 12, fontWeight: 700 },
    error: { marginTop: 14, background: "#ffe8ee", color: "#b00020", padding: 12, borderRadius: 12 },
    empty: { marginTop: 20, background: "white", border: "1px solid #eee", borderRadius: 16, padding: 20, textAlign: "center", opacity: 0.8 },
    statusBadge: (status) => {
        let bg = "#f3f4f6", color = "#111";
        if (status === "pending") { bg = "#eef2ff"; color = "#3730a3"; }
        else if (status === "pending_payment") { bg = "#fff7e6"; color = "#9a6700"; }
        else if (status === "approved") { bg = "#e9fbe9"; color = "#1a7f37"; }
        else if (status === "rejected" || status === "canceled") { bg = "#ffe8ee"; color = "#b00020"; }
        return { background: bg, color, padding: "8px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" };
    }
};