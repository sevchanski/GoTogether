import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API = "http://127.0.0.1:8000";

export default function LeaveReview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tripId = searchParams.get("trip");
  const revieweeId = searchParams.get("reviewee");

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const token = localStorage.getItem("access");

  const submitReview = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch(`${API}/api/reviews/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        trip: Number(tripId),
        reviewee: Number(revieweeId),
        rating: Number(rating),
        comment
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(typeof data === "string" ? data : JSON.stringify(data));
      setSaving(false);
      return;
    }

    setSuccess(true);

    setTimeout(() => {
      navigate("/my-trips");
    }, 1800);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Залишити відгук</h2>
          <p style={styles.subtext}>
            Поділись враженнями про поїздку та постав оцінку.
          </p>

          <div style={styles.summaryBox}>
            <div style={styles.summaryLabel}>Поїздка</div>
            <div style={styles.summaryValue}>#{tripId || "—"}</div>

            <div style={{ ...styles.summaryLabel, marginTop: 12 }}>
              Кому залишаєте відгук
            </div>
            <div style={styles.summaryValue}>#{revieweeId || "—"}</div>
          </div>

          <form onSubmit={submitReview} style={styles.form}>
            <label style={styles.label}>
              Оцінка
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                style={styles.input}
              >
                <option value={5}>5 ⭐ — Відмінно</option>
                <option value={4}>4 ⭐ — Добре</option>
                <option value={3}>3 ⭐ — Нормально</option>
                <option value={2}>2 ⭐ — Погано</option>
                <option value={1}>1 ⭐ — Дуже погано</option>
              </select>
            </label>

            <label style={styles.label}>
              Коментар
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={styles.textarea}
                placeholder="Напишіть короткий відгук про поїздку"
              />
            </label>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.actions}>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => navigate(-1)}
              >
                Назад
              </button>

              <button
                type="submit"
                style={styles.primaryBtn}
                disabled={saving}
              >
                {saving ? "Публікація..." : "Опублікувати відгук"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {success && (
        <div style={styles.toast}>
          ⭐ Дякуємо за відгук!
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
    position: "relative",
  },
  container: {
    maxWidth: 760,
    margin: "0 auto",
  },
  card: {
    background: "white",
    borderRadius: 18,
    padding: 22,
    border: "1px solid #eee",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  },
  subtext: {
    marginTop: 0,
    marginBottom: 18,
    fontSize: 14,
    opacity: 0.75,
  },
  summaryBox: {
    background: "white",
    border: "1px solid #eee",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 800,
    marginTop: 4,
  },
  form: {
    display: "grid",
    gap: 14,
  },
  label: {
    display: "grid",
    gap: 6,
    fontSize: 14,
    fontWeight: 600,
  },
  input: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #ddd",
    outline: "none",
    fontSize: 14,
    background: "#fff",
  },
  textarea: {
    minHeight: 140,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #ddd",
    outline: "none",
    fontSize: 14,
    resize: "vertical",
    background: "#fff",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  secondaryBtn: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "white",
    color: "#111",
    cursor: "pointer",
    fontWeight: 700,
  },
  primaryBtn: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "#3730a3",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  error: {
    background: "#ffe8ee",
    color: "#b00020",
    padding: 12,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
  },
  toast: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#16a34a",
    color: "white",
    padding: "14px 20px",
    borderRadius: 14,
    fontWeight: 700,
    boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
    zIndex: 1000,
  },
};