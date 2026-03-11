import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

function shortPlace(s) {
  if (!s) return "";
  const parts = s.split(",").map(x => x.trim()).filter(Boolean);
  return parts.slice(0, 2).join(", ");
}

function statusLabel(status) {
  switch (status) {
    case "pending":
      return "Очікує рішення";
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

export default function DriverDashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("access");

  const loadBookings = async () => {
    setLoading(true);

    const res = await fetch(`${API}/api/bookings/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => []);
    const items = Array.isArray(data) ? data : data.results || [];

    setBookings(items);
    setLoading(false);
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const approveBooking = async (id) => {
    await fetch(`${API}/api/bookings/${id}/approve/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    loadBookings();
  };

  const rejectBooking = async (id) => {
    await fetch(`${API}/api/bookings/${id}/reject/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    loadBookings();
  };

  if (loading) {
    return <div style={styles.page}>Завантаження...</div>;
  }

  const driverRelevant = bookings.filter(
    (booking) => booking.trip_details?.driver?.id
  );

  return (
    <div style={styles.page}>
      <h2>Заявки на ваші поїздки</h2>

      {driverRelevant.length === 0 && <p>Поки немає заявок.</p>}

      {driverRelevant.map((booking) => {
        const trip = booking.trip_details;

        return (
          <div key={booking.id} style={styles.card}>
            <div style={styles.route}>
              {shortPlace(trip.origin)} → {shortPlace(trip.destination)}
            </div>

            <div style={styles.meta}>
              Пасажир: {booking.passenger?.full_name}
            </div>

            <div style={styles.meta}>
              Місць: {booking.seats_booked}
            </div>

            <div style={styles.meta}>
              Статус: {statusLabel(booking.status)}
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
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  page: {
    padding: 30,
  },
  card: {
    border: "1px solid #ddd",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    background: "white",
  },
  route: {
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 6,
  },
  meta: {
    marginTop: 5,
  },
  buttons: {
    marginTop: 12,
    display: "flex",
    gap: 10,
  },
  approve: {
    background: "green",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },
  reject: {
    background: "red",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },
};