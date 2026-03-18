import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";

const API = "http://localhost:8000";

export default function Profile() {
  const { access, isAuthenticated } = useContext(AuthContext);

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    avatar: null,
  });

  const loadMe = async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError("");

    const res = await fetch(`${API}/api/me/`, {
      headers: {
        Authorization: `Bearer ${access}`,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(typeof data === "string" ? data : JSON.stringify(data));
      setLoading(false);
      return;
    }

    setMe(data);
    setForm({
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      phone_number: data.phone_number || "",
      avatar: null,
    });
    setLoading(false);
  };

  useEffect(() => {
    loadMe();
  }, [isAuthenticated, access]);

  const onChange = (e) => {
    const { name, value, files } = e.target;

    if (name === "avatar") {
      setForm((prev) => ({
        ...prev,
        avatar: files?.[0] || null,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const body = new FormData();
    body.append("first_name", form.first_name);
    body.append("last_name", form.last_name);
    body.append("phone_number", form.phone_number);

    if (form.avatar) {
      body.append("avatar", form.avatar);
    }

    const res = await fetch(`${API}/api/me/`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${access}`,
      },
      body,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(typeof data === "string" ? data : JSON.stringify(data));
      setSaving(false);
      return;
    }

    setMe(data);
    setForm((prev) => ({ ...prev, avatar: null }));
    setEditing(false);
    setSaving(false);
  };

  if (!isAuthenticated) {
    return (
      <div style={styles.centerBox}>
        <h2>Профіль</h2>
        <p>Увійдіть, щоб переглянути профіль.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.centerBox}>
        <p>Завантаження...</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div style={styles.centerBox}>
        <p>Не вдалося завантажити профіль.</p>
      </div>
    );
  }

  const avatarSrc = me.avatar_url || (me.avatar ? `${API}${me.avatar}` : "");

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.profileTop}>
            <div style={styles.avatarWrap}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="avatar" style={styles.avatar} />
              ) : (
                <div style={styles.avatarFallback}>
                  {(me.first_name?.[0] || "").toUpperCase()}
                  {(me.last_name?.[0] || "").toUpperCase()}
                </div>
              )}
            </div>

            <div>
              <h2 style={{ marginBottom: 8 }}>
                {me.first_name} {me.last_name}
              </h2>
              <p style={styles.email}>{me.email}</p>
              <p style={styles.role}>
                {me.is_driver ? "Водій" : "Пасажир"}
              </p>
            </div>
          </div>

          <button
            style={styles.editBtn}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Скасувати" : "Редагувати профіль"}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {editing && (
          <form onSubmit={saveProfile} style={styles.form}>
            <div style={styles.formGrid}>
              <label style={styles.label}>
                Ім’я
                <input
                  style={styles.input}
                  name="first_name"
                  value={form.first_name}
                  onChange={onChange}
                />
              </label>

              <label style={styles.label}>
                Прізвище
                <input
                  style={styles.input}
                  name="last_name"
                  value={form.last_name}
                  onChange={onChange}
                />
              </label>

              <label style={styles.label}>
                Телефон
                <input
                  style={styles.input}
                  name="phone_number"
                  value={form.phone_number}
                  onChange={onChange}
                />
              </label>

              <label style={styles.label}>
                Аватар
                <input
                  style={styles.input}
                  type="file"
                  name="avatar"
                  accept="image/*"
                  onChange={onChange}
                />
              </label>
            </div>

            <div style={styles.actions}>
              <button type="submit" style={styles.saveBtn} disabled={saving}>
                {saving ? "Збереження..." : "Зберегти зміни"}
              </button>
            </div>
          </form>
        )}

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Рейтинг</div>
            <div style={styles.statValue}>{me.rating} ⭐</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Відгуків</div>
            <div style={styles.statValue}>{me.reviews_count}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Поїздок як пасажир</div>
            <div style={styles.statValue}>{me.trips_as_passenger}</div>
          </div>

          {me.is_driver && (
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Поїздок як водій</div>
              <div style={styles.statValue}>{me.trips_as_driver}</div>
            </div>
          )}

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Телефон</div>
            <div style={styles.statValueSmall}>
              {me.phone_number || "Не вказано"}
            </div>
          </div>
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
  centerBox: {
    maxWidth: 600,
    margin: "40px auto",
    textAlign: "center",
  },
  card: {
    maxWidth: 900,
    margin: "0 auto",
    background: "white",
    border: "1px solid #eee",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 20,
  },
  profileTop: {
    display: "flex",
    gap: 18,
    alignItems: "center",
  },
  avatarWrap: {
    flexShrink: 0,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #eee",
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    background: "#3730a3",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 28,
  },
  email: {
    margin: 0,
    color: "#555",
  },
  role: {
    marginTop: 6,
    fontWeight: 600,
    color: "#3730a3",
  },
  editBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    background: "#3730a3",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  form: {
    marginBottom: 24,
    padding: 18,
    border: "1px solid #eee",
    borderRadius: 16,
    background: "#fafafa",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  label: {
    display: "grid",
    gap: 6,
    fontWeight: 600,
    fontSize: 14,
  },
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "white",
  },
  actions: {
    marginTop: 16,
    display: "flex",
    justifyContent: "flex-end",
  },
  saveBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    background: "#3730a3",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  statCard: {
    padding: 16,
    border: "1px solid #eee",
    borderRadius: 14,
    background: "white",
  },
  statLabel: {
    color: "#777",
    fontSize: 13,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 800,
  },
  statValueSmall: {
    fontSize: 18,
    fontWeight: 700,
  },
  error: {
    marginBottom: 14,
    background: "#ffe8ee",
    color: "#b00020",
    padding: 12,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
  },
};