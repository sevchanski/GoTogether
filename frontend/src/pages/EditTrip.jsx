import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API = "http://127.0.0.1:8000";

export default function EditTrip() {
  const { tripId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    origin: "",
    destination: "",
    departure_time: "",
    seats_total: 1,
    price_per_seat: "",
    city: "",
    route_summary: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const toLocalDateTimeInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");

    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const mins = pad(d.getMinutes());

    return `${year}-${month}-${day}T${hours}:${mins}`;
  };

  const loadTrip = async () => {
    setLoading(true);
    setError("");

    const res = await authFetch(`${API}/api/trips/${tripId}/`);
    if (!res) return;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(typeof data === "string" ? data : JSON.stringify(data));
      setLoading(false);
      return;
    }

    setForm({
      origin: data.origin || "",
      destination: data.destination || "",
      departure_time: toLocalDateTimeInput(data.departure_time),
      seats_total: data.seats_total || 1,
      price_per_seat: data.price_per_seat || "",
      city: data.city || "",
      route_summary: data.route_summary || "",
    });

    setLoading(false);
  };

  useEffect(() => {
    loadTrip();
  }, [tripId]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveTrip = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      origin: form.origin,
      destination: form.destination,
      departure_time: form.departure_time,
      seats_total: Number(form.seats_total),
      price_per_seat: Number(form.price_per_seat),
      city: form.city,
      route_summary: form.route_summary,
    };

    const res = await authFetch(`${API}/api/trips/${tripId}/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(typeof data === "string" ? data : JSON.stringify(data));
      setSaving(false);
      return;
    }

    navigate("/driver-dashboard");
  };

  if (loading) {
    return (
      <div style={styles.center}>
        <p>Завантаження поїздки...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Редагувати поїздку</h2>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={saveTrip} style={styles.form}>
          <label style={styles.label}>
            Місто
            <input
              style={styles.input}
              name="city"
              value={form.city}
              onChange={onChange}
            />
          </label>

          <label style={styles.label}>
            Звідки
            <input
              style={styles.input}
              name="origin"
              value={form.origin}
              onChange={onChange}
            />
          </label>

          <label style={styles.label}>
            Куди
            <input
              style={styles.input}
              name="destination"
              value={form.destination}
              onChange={onChange}
            />
          </label>

          <label style={styles.label}>
            Дата і час
            <input
              style={styles.input}
              type="datetime-local"
              name="departure_time"
              value={form.departure_time}
              onChange={onChange}
            />
          </label>

          <div style={styles.grid2}>
            <label style={styles.label}>
              Кількість місць
              <input
                style={styles.input}
                type="number"
                min="1"
                name="seats_total"
                value={form.seats_total}
                onChange={onChange}
              />
            </label>

            <label style={styles.label}>
              Ціна за місце
              <input
                style={styles.input}
                type="number"
                min="0"
                step="0.01"
                name="price_per_seat"
                value={form.price_per_seat}
                onChange={onChange}
              />
            </label>
          </div>

          <label style={styles.label}>
            Короткий опис маршруту
            <textarea
              style={styles.textarea}
              name="route_summary"
              value={form.route_summary}
              onChange={onChange}
            />
          </label>

          <div style={styles.actions}>
            <button
              type="button"
              style={styles.cancelBtn}
              onClick={() => navigate("/driver-dashboard")}
            >
              Скасувати
            </button>

            <button type="submit" style={styles.saveBtn} disabled={saving}>
              {saving ? "Збереження..." : "Зберегти"}
            </button>
          </div>
        </form>
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
  center: {
    padding: 40,
    textAlign: "center",
  },
  card: {
    maxWidth: 760,
    margin: "0 auto",
    background: "white",
    border: "1px solid #eee",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  },
  form: {
    display: "grid",
    gap: 14,
  },
  grid2: {
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
  textarea: {
    minHeight: 120,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "white",
    resize: "vertical",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "white",
    cursor: "pointer",
    fontWeight: 700,
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
  error: {
    marginBottom: 14,
    background: "#ffe8ee",
    color: "#b00020",
    padding: 12,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
  },
};