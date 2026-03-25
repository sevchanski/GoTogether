import { useEffect, useMemo, useState } from "react";
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

function formatDateTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function DriverDashboard() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTripId, setDeleteTripId] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
    setBookings(items);
    setLoading(false);
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const driverBookings = useMemo(() => {
    if (!currentUser?.id) return [];

    return bookings.filter(
      (booking) => booking.trip_details?.driver?.id === currentUser.id
    );
  }, [bookings, currentUser]);

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

  const requestDeleteTrip = (tripId) => {
    setDeleteTripId(tripId);
  };

  const confirmDeleteTrip = async () => {
    if (!deleteTripId) return;

    setDeleting(true);

    const res = await authFetch(`${API}/api/trips/${deleteTripId}/`, {
      method: "DELETE",
    });

    setDeleting(false);
    setDeleteTripId(null);

    if (!res) return;
    await loadBookings();
  };

  const cancelDeleteTrip = () => {
    setDeleteTripId(null);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={{ marginTop: 0 }}>Кабінет водія</h2>

        {loading && <div>Завантаження...</div>}
        {error && <div style={styles.error}>{error}</div>}

        {!loading && driverBookings.length === 0 && (
          <div style={styles.empty}>Поки немає заявок на ваші поїздки.</div>
        )}

        <div style={styles.list}>
          {driverBookings.map((booking) => {
            const trip = booking.trip_details || {};
            const passenger = booking.passenger || {};

            return (
              <div key={booking.id} style={styles.card}>
                <div style={styles.route}>
                  {shortPlace(trip.origin)} → {shortPlace(trip.destination)}
                </div>

                <div style={styles.meta}>
                  Дата: <b>{formatDateTime(trip.departure_time)}</b>
                </div>

                <div style={styles.meta}>
                  Статус поїздки: <b>{tripStatusLabel(trip.status)}</b>
                </div>

               <div style={styles.meta}>
                 Пасажир: <b>{
                   passenger.full_name ||
                   `${passenger.first_name || ""} ${passenger.last_name || ""}`.trim() ||
                   passenger.email ||
                   "—"
                 }</b>
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

                <div style={styles.buttons}>
                  {trip.id && (
                    <>
                      <button
                        style={styles.edit}
                        onClick={() => navigate(`/edit-trip/${trip.id}`)}
                      >
                        Редагувати поїздку
                      </button>

                      <button
                        style={styles.delete}
                        onClick={() => requestDeleteTrip(trip.id)}
                      >
                        Видалити поїздку
                      </button>
                    </>
                  )}
                </div>

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

                {trip.id &&
                  trip.status !== "completed" &&
                  booking.status === "approved" && (
                    <div style={styles.buttons}>
                      <button
                        style={styles.complete}
                        onClick={() => completeTrip(trip.id)}
                      >
                        Завершити поїздку
                      </button>
                    </div>
                  )}

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

      {deleteTripId && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={{ marginTop: 0 }}>Видалити поїздку?</h3>
            <p style={styles.modalText}>
              Цю дію не можна скасувати. Поїздка буде видалена назавжди.
            </p>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.modalCancel}
                onClick={cancelDeleteTrip}
                disabled={deleting}
              >
                Скасувати
              </button>

              <button
                type="button"
                style={styles.modalDelete}
                onClick={confirmDeleteTrip}
                disabled={deleting}
              >
                {deleting ? "Видалення..." : "Видалити"}
              </button>
            </div>
          </div>
        </div>
      )}
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
  edit: {
    background: "#3730a3",
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },
  delete: {
    background: "#111",
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },
  complete: {
    background: "#0f766e",
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },
  review: {
    background: "#7c3aed",
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
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    background: "white",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
  },
  modalText: {
    marginTop: 8,
    marginBottom: 18,
    color: "#555",
    lineHeight: 1.5,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancel: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  modalDelete: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    background: "#b00020",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
};