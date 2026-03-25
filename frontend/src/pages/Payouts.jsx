import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://127.0.0.1:8000";

function shortPlace(s) {
  if (!s) return "";
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
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

export default function Payouts() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openTripId, setOpenTripId] = useState(null);

  const refresh = localStorage.getItem("refresh");

  const refreshAccess = async () => {
    if (!refresh) return null;
    try {
      const res = await fetch(`${API}/api/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return null;
      localStorage.setItem("access", data.access);
      return data.access;
    } catch {
      return null;
    }
  };

  const authFetch = async (url, options = {}) => {
    let token = localStorage.getItem("access");
    let res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
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

  const driverPaidBookings = useMemo(() => {
    if (!currentUser?.id) return [];
    return bookings.filter((booking) => {
      const driverId = booking.trip_details?.driver?.id;
      return driverId === currentUser.id && booking.status === "approved";
    });
  }, [bookings, currentUser]);

  const groupedTrips = useMemo(() => {
    const map = new Map();
    for (const booking of driverPaidBookings) {
      const trip = booking.trip_details;
      if (!trip?.id) continue;

      if (!map.has(trip.id)) {
        map.set(trip.id, {
          trip,
          bookings: [],
          seatsSold: 0,
          totalRevenue: 0,
        });
      }
      const group = map.get(trip.id);
      group.bookings.push(booking);
      group.seatsSold += Number(booking.seats_booked || 0);
      group.totalRevenue += Number(booking.total_price || 0);
    }

    return Array.from(map.values()).sort((a, b) => {
      const aDate = new Date(a.trip.departure_time).getTime();
      const bDate = new Date(b.trip.departure_time).getTime();
      return bDate - aDate;
    });
  }, [driverPaidBookings]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={{ marginTop: 0 }}>Виплати водію</h2>

        {loading && <div>Завантаження...</div>}
        {error && <div style={styles.error}>{error}</div>}

        {!loading && groupedTrips.length === 0 && (
          <div style={styles.empty}>Поки немає оплачених поїздок.</div>
        )}

        <div style={styles.list}>
          {groupedTrips.map((group) => {
            const { trip, bookings, seatsSold, totalRevenue } = group;
            const isOpen = openTripId === trip.id;

            return (
              <div key={trip.id} style={styles.card}>
                <button
                  type="button"
                  onClick={() => setOpenTripId(isOpen ? null : trip.id)}
                  style={styles.cardButton}
                >
                  <div style={styles.headerTop}>
                    <div>
                      <div style={styles.route}>
                        {shortPlace(trip.origin)} → {shortPlace(trip.destination)}
                      </div>
                      <div style={styles.meta}>
                        {formatDateTime(trip.departure_time)}
                      </div>
                    </div>
                    <div style={styles.badge}>{isOpen ? "▲" : "▼"}</div>
                  </div>

                  <div style={styles.statsGrid}>
                    <div style={styles.statBox}>
                      <span style={styles.statLabel}>Викуплено місць</span>
                      <b>{seatsSold}</b>
                    </div>
                    <div style={styles.statBox}>
                      <span style={styles.statLabel}>Виплата</span>
                      <b>{totalRevenue.toFixed(2)} грн</b>
                    </div>
                    <div style={styles.statBox}>
                      <span style={styles.statLabel}>Пасажирів</span>
                      <b>{bookings.length}</b>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div style={styles.dropdown}>
                    <div style={styles.dropdownTitle}>Оплатили поїздку:</div>
                    {bookings.map((booking) => {
                      // Логіка формування імені пасажира
                      const p = booking.passenger;
                      const constructedName = `${p?.first_name || ""} ${p?.last_name || ""}`.trim();
                      const displayName = p?.full_name || constructedName || p?.email || "Пасажир";

                      return (
                        <div key={booking.id} style={styles.passengerRow}>
                          <div>
                            <div style={styles.passengerName}>{displayName}</div>
                            <div style={styles.passengerSub}>
                              Рейтинг: {p?.rating ?? "—"} ⭐
                            </div>
                          </div>
                          <div style={styles.passengerInfo}>
                            <div>{booking.seats_booked} місц.</div>
                            <div>{Number(booking.total_price || 0).toFixed(2)} грн</div>
                          </div>
                        </div>
                      );
                    })}
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
  page: { padding: 30, background: "#f5f6f9", minHeight: "100vh" },
  container: { maxWidth: 980, margin: "0 auto" },
  list: { display: "grid", gap: 14 },
  card: {
    background: "white",
    borderRadius: 18,
    border: "1px solid #eee",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  cardButton: {
    width: "100%",
    border: "none",
    background: "white",
    padding: 18,
    cursor: "pointer",
    textAlign: "left",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "start",
    marginBottom: 14,
  },
  route: { fontWeight: 800, fontSize: 17 },
  meta: { marginTop: 6, opacity: 0.75, fontSize: 14 },
  badge: {
    minWidth: 34,
    height: 34,
    borderRadius: 999,
    background: "#f3f4f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },
  statBox: {
    background: "#fafafa",
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 6,
  },
  statLabel: { fontSize: 12, opacity: 0.7 },
  dropdown: {
    borderTop: "1px solid #eee",
    padding: 16,
    background: "#fcfcfc",
    display: "grid",
    gap: 10,
  },
  dropdownTitle: { fontWeight: 800, marginBottom: 4 },
  passengerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    background: "white",
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 12,
  },
  passengerName: { fontWeight: 700 },
  passengerSub: { marginTop: 4, fontSize: 13, opacity: 0.75 },
  passengerInfo: {
    textAlign: "right",
    fontSize: 14,
    display: "grid",
    gap: 4,
    minWidth: 110,
  },
  error: {
    marginBottom: 14,
    background: "#ffe8ee",
    color: "#b00020",
    padding: 12,
    borderRadius: 12,
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