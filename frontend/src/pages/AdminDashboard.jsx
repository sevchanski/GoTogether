import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";

const API = "http://127.0.0.1:8000";

export default function AdminDashboard() {
  const { access, user } = useContext(AuthContext);

  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const authHeaders = {
    Authorization: `Bearer ${access}`,
    "Content-Type": "application/json",
  };

  const loadUsers = async () => {
    const res = await fetch(`${API}/api/admin/users/`, {
      headers: authHeaders,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
    setUsers(Array.isArray(data) ? data : []);
  };

  const loadReviews = async () => {
    const res = await fetch(`${API}/api/admin/reviews/`, {
      headers: authHeaders,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
    setReviews(Array.isArray(data) ? data : []);
  };

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadUsers(), loadReviews()]);
    } catch (e) {
      setError(e.message || "Помилка завантаження");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.is_staff) {
      reload();
    }
  }, [user]);

  const blockUser = async (id) => {
    const res = await fetch(`${API}/api/admin/users/${id}/block/`, {
      method: "POST",
      headers: authHeaders,
    });
    if (res.ok) reload();
  };

  const unblockUser = async (id) => {
    const res = await fetch(`${API}/api/admin/users/${id}/unblock/`, {
      method: "POST",
      headers: authHeaders,
    });
    if (res.ok) reload();
  };

  const hideReview = async (id) => {
    const res = await fetch(`${API}/api/admin/reviews/${id}/hide/`, {
      method: "POST",
      headers: authHeaders,
    });
    if (res.ok) reload();
  };

  const showReview = async (id) => {
    const res = await fetch(`${API}/api/admin/reviews/${id}/show/`, {
      method: "POST",
      headers: authHeaders,
    });
    if (res.ok) reload();
  };

  if (!user?.is_staff) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>Доступ лише для адміністратора</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={{ marginTop: 0 }}>Панель адміністратора</h2>

        <div style={styles.tabs}>
          <button
            style={{ ...styles.tabBtn, ...(tab === "users" ? styles.tabBtnActive : {}) }}
            onClick={() => setTab("users")}
          >
            Користувачі
          </button>
          <button
            style={{ ...styles.tabBtn, ...(tab === "reviews" ? styles.tabBtnActive : {}) }}
            onClick={() => setTab("reviews")}
          >
            Відгуки
          </button>
        </div>

        {loading && <div>Завантаження...</div>}
        {error && <div style={styles.error}>{error}</div>}

        {!loading && tab === "users" && (
          <div style={styles.list}>
            {users.map((u) => (
              <div key={u.id} style={styles.card}>
                <div style={styles.rowTop}>
                  <div>
                    <div style={styles.title}>{u.full_name}</div>
                    <div style={styles.sub}>{u.email}</div>
                  </div>

                  <div style={styles.badges}>
                    {u.is_staff && <span style={styles.badge}>Адмін</span>}
                    {u.is_driver && <span style={styles.badgePurple}>Водій</span>}
                    {u.is_blocked && <span style={styles.badgeRed}>Заблокований</span>}
                  </div>
                </div>

                <div style={styles.metaGrid}>
                  <div>Рейтинг: <b>{u.rating}</b></div>
                  <div>Телефон: <b>{u.phone_number || "—"}</b></div>
                </div>

                <div style={styles.actions}>
                  {/* ПЕРЕВІРКА: якщо це адмін, приховуємо кнопки керування */}
                  {!u.is_staff ? (
                    <>
                      {!u.is_blocked ? (
                        <button style={styles.dangerBtn} onClick={() => blockUser(u.id)}>
                          Заблокувати
                        </button>
                      ) : (
                        <button style={styles.successBtn} onClick={() => unblockUser(u.id)}>
                          Розблокувати
                        </button>
                      )}
                    </>
                  ) : (
                    <span style={{ color: "#888", fontSize: 13, fontStyle: "italic" }}>
                      Керування адмінами неможливе
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && tab === "reviews" && (
          <div style={styles.list}>
            {reviews.map((r) => (
              <div key={r.id} style={styles.card}>
                <div style={styles.rowTop}>
                  <div>
                    <div style={styles.title}>{r.trip_route}</div>
                    <div style={styles.sub}>
                      {r.reviewer?.full_name} → {r.reviewee?.full_name}
                    </div>
                  </div>

                  <div style={styles.badges}>
                    <span style={styles.badge}>{r.rating} ⭐</span>
                    {r.is_hidden && <span style={styles.badgeRed}>Прихований</span>}
                  </div>
                </div>

                <div style={styles.commentBox}>
                  {r.comment || "Без коментаря"}
                </div>

                <div style={styles.actions}>
                  {!r.is_hidden ? (
                    <button style={styles.dangerBtn} onClick={() => hideReview(r.id)}>
                      Приховати
                    </button>
                  ) : (
                    <button style={styles.successBtn} onClick={() => showReview(r.id)}>
                      Показати
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
    maxWidth: 1100,
    margin: "0 auto",
  },
  tabs: {
    display: "flex",
    gap: 10,
    marginBottom: 20,
  },
  tabBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  tabBtnActive: {
    background: "#111",
    color: "white",
    border: "1px solid #111",
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
  rowTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "start",
  },
  title: {
    fontWeight: 800,
    fontSize: 18,
  },
  sub: {
    marginTop: 4,
    color: "#666",
    fontSize: 14,
  },
  badges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  badge: {
    background: "#eef2ff",
    color: "#3730a3",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  badgePurple: {
    background: "#f3e8ff",
    color: "#7c3aed",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  badgeRed: {
    background: "#ffe8ee",
    color: "#b00020",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 14,
  },
  commentBox: {
    marginTop: 14,
    background: "#fafafa",
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 12,
  },
  actions: {
    marginTop: 16,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    minHeight: "40px",
  },
  dangerBtn: {
    background: "#b00020",
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },
  successBtn: {
    background: "#1a7f37",
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },
  error: {
    marginBottom: 14,
    background: "#ffe8ee",
    color: "#b00020",
    padding: 12,
    borderRadius: 12,
  },
};