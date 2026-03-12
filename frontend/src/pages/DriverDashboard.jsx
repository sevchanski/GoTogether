import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://127.0.0.1:8000";

function shortPlace(s) {
  if (!s) return "";
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  return parts.slice(0, 2).join(", ");
}

function statusLabel(status) {
  switch (status) {
    case "pending":
      return "Очікує рішення";
    case "pending_payment":
      return "Очікує оплату";
    case "approved":
      return "Оплачено / підтверджено";
    case "rejected":
      return "Відхилено";
    case "canceled":
      return "Скасовано";
    default:
      return status;
  }
}

function tripStatusLabel(status) {
  switch (status) {
    case "active":
      return "Активна";
    case "full":
      return "Заповнена";
    case "completed":
      return "Завершена";
    case "canceled":
      return "Скасована";
    default:
      return status;
  }
}

export default function DriverDashboard() {
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;

    localStorage.setItem("access", data.access);
    return data.access;
  };

  const authFetch = async (url, options = {}) => {
    let currentToken = localStorage.getItem("access");

    let res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${currentToken}`,
      },
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
          Authorization: `Bearer ${newAccess}`,
        },
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

    // залишаємо тільки бронювання по поїздках водія
    const driverBookings = items.filter(
      (booking) => booking.trip_details?.driver?.is_driver !== undefined
    );

    setBookings(driverBookings);
    setLoading(false);
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const approveBooking = async (id) => {
    const res = await authFetch(`${API}/api/bookings/${id}/approve/`, {
      method: "POST",
    });

    if (!res) return;
    await loadBookings();
  };

  const rejectBooking = async (id) => {
    const res = await authFetch(`${API}/api/bookings/${id}/reject/`, {
      method: "POST",
    });

    if (!res) return;
    await loadBookings();
  };

  const completeTrip = async (tripId) => {
    const res = await authFetch(`${API}/api/trips/${tripId}/complete/`, {
      method: "POST",
    });

    if (!res) return;
    await loadBookings();
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={{ marginTop: 0 }}>Заявки на ваші поїздки</h2>

        {loading && <div>Завантаження...</div>}
        {error && <div style={styles.error}>{error}</div>}

        {!loading && bookings.length === 0 && (
          <div style={styles.empty}>Поки немає заявок.</div>
        )}

        <div style={styles.list}>
          {bookings.map((booking) => {
            const trip = booking.trip_details || {};
            const passenger = booking.passenger || {};

            return (
              <div key={booking.id} style={styles.card}>
                <div style={styles.route}>
                  {shortPlace(trip.origin)} → {shortPlace(trip.destination)}
                </div>

                <div style={styles.meta}>
                  Статус поїздки: <b>{tripStatusLabel(trip.status)}</b>
                </div>

                <div style={styles.meta}>
                  Пасажир: <b>{passenger.full_name || "—"}</b>
                </div>

                <div style={styles.meta}>
                  Рейтинг пасажира: <b>{passenger.rating ?? "—"} ⭐</b>
                </div>

                <div style={styles.meta}>
                  Місць: <b>{booking.seats_booked}</b>
                </div>

                <div style={styles.meta}>
                  Статус заявки: <b>{statusLabel(booking.status)}</b>
                </div>

                {/* ПІДТВЕРДИТИ / ВІДХИЛИТИ */}
                {booking.status === "pending" && (
                  <div style={styles.buttons}>
                    <button
                      style={styles.approve}
                      onClick={() => approveBooking(booking.id)}
                    >
                      Підтвердити
                    </button>

                    <button
                      style={styles.reject}
                      onClick={() => rejectBooking(booking.id)}
                    >
                      Відхилити
                    </button>
                  </div>
                )}

                {/* ЗАВЕРШИТИ ПОЇЗДКУ */}
                {trip.id && trip.status !== "completed" && booking.status === "approved" && (
                  <div style={styles.buttons}>
                    <button
                      style={styles.complete}
                      onClick={() => completeTrip(trip.id)}
                    >
                      Завершити поїздку
                    </button>
                  </div>
                )}

                {/* ОЦІНИТИ ПАСАЖИРА ПІСЛЯ ЗАВЕРШЕННЯ */}
                {booking.status === "approved" &&
                  trip.status === "completed" &&
                  passenger.id && (
                    <div style={styles.buttons}>
                      <button
                        style={styles.review}
                        onClick={() =>
                          navigate(
                            `/leave-review?trip=${trip.id}&reviewee=${passenger.id}`
                          )
                        }
                      >
                        Оцінити пасажира
                      </button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: 30,
    background: "#f5f6f9",
    minHeight: "100vh",
  },
  container: {
    maxWidth: 960,
    margin: "0 auto",
  },
  list: {
    display: "grid",
    gap: 14,
  },
  card: {
    background: "white",
    border: "1px solid #eee",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  },
  route: {
    fontWeight: 800,
    fontSize: 18,
    marginBottom: 8,
  },
  meta: {
    marginTop: 6,
    fontSize: 14,
  },
  buttons: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  approve: {
    background: "#1a7f37",
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },
  reject: {
    background: "#b00020",
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },
  complete: {
    background: "#111",
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },
  review: {
    background: "#3730a3",
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },
  error: {
    background: "#ffe8ee",
    color: "#b00020",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  empty: {
    background: "white",
    border: "1px solid #eee",
    borderRadius: 16,
    padding: 20,
    textAlign: "center",
    opacity: 0.8,
  },
};