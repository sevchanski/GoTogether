import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

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

function formatCardNumber(value) {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function Checkout() {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("card");

  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const access = localStorage.getItem("access");
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

  const loadBooking = async () => {
    setLoading(true);
    setError("");

    const res = await authFetch(`${API}/api/bookings/${bookingId}/`);
    if (!res) return;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(typeof data === "string" ? data : JSON.stringify(data));
      setLoading(false);
      return;
    }

    setBooking(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!access) {
      navigate("/login");
      return;
    }
    loadBooking();
  }, [bookingId]);

  const trip = booking?.trip_details || booking?.trip || {};

  const total = useMemo(() => {
    if (!booking) return "0.00";
    const price = Number(trip?.price_per_seat || 0);
    const seats = Number(booking?.seats_booked || 0);
    return (price * seats).toFixed(2);
  }, [booking, trip]);

  const validateCardForm = () => {
    if (paymentMethod !== "card") return true;

    if (cardNumber.replace(/\s/g, "").length !== 16) {
      setError("Введи коректний номер картки");
      return false;
    }

    if (!cardName.trim()) {
      setError("Введи ім’я власника картки");
      return false;
    }

    if (expiry.length !== 5) {
      setError("Введи термін дії у форматі MM/YY");
      return false;
    }

    if (cvc.length < 3) {
      setError("Введи CVV/CVC");
      return false;
    }

    return true;
  };

  const handlePay = async () => {
    setError("");

    if (!validateCardForm()) return;

    setPaying(true);

    // Імітація справжньої обробки платежу
    await new Promise(resolve => setTimeout(resolve, 1800));

    const res = await authFetch(`${API}/api/bookings/${bookingId}/confirm_payment/`, {
      method: "POST"
    });

    if (!res) {
      setPaying(false);
      return;
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(typeof data === "string" ? data : JSON.stringify(data));
      setPaying(false);
      return;
    }

    setPaying(false);
    setPaid(true);

    setTimeout(() => {
      navigate("/my-trips");
    }, 1800);
  };

  if (loading) {
    return <div style={styles.page}>Завантаження checkout...</div>;
  }

  if (!booking) {
    return <div style={styles.page}>Бронювання не знайдено</div>;
  }

  if (paid) {
    return (
      <div style={styles.page}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✓</div>
          <h2>Оплата успішна</h2>
          <p>Ваше бронювання підтверджено.</p>
          <p style={{ opacity: 0.7 }}>Зараз перенаправимо вас до ваших поїздок…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.left}>
          <div style={styles.card}>
            <h2 style={{ marginTop: 0 }}>Оплата поїздки</h2>
            <div style={styles.route}>
              {shortPlace(trip.origin)} → {shortPlace(trip.destination)}
            </div>
            <div style={styles.meta}>
              {formatDateTime(trip.departure_time)}
            </div>

            <div style={styles.summary}>
              <div style={styles.row}>
                <span>Кількість місць</span>
                <b>{booking.seats_booked}</b>
              </div>
              <div style={styles.row}>
                <span>Ціна за місце</span>
                <b>{trip.price_per_seat} грн</b>
              </div>
              <div style={styles.row}>
                <span>Статус</span>
                <b>{booking.status}</b>
              </div>
            </div>

            <div style={styles.totalBox}>
              <span>До сплати</span>
              <strong>{total} грн</strong>
            </div>
          </div>
        </div>

        <div style={styles.right}>
          <div style={styles.card}>
            <h3 style={{ marginTop: 0 }}>Спосіб оплати</h3>

            <div style={styles.methods}>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                style={{
                  ...styles.methodBtn,
                  ...(paymentMethod === "card" ? styles.methodActive : {})
                }}
              >
                💳 Картка
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("apple")}
                style={{
                  ...styles.methodBtn,
                  ...(paymentMethod === "apple" ? styles.methodActive : {})
                }}
              >
                 Pay
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("google")}
                style={{
                  ...styles.methodBtn,
                  ...(paymentMethod === "google" ? styles.methodActive : {})
                }}
              >
                G Pay
              </button>
            </div>

            {paymentMethod === "card" ? (
              <>
                <div style={styles.fakeCard}>
                  <div style={styles.fakeCardTop}>GoTogether Pay</div>
                  <div style={styles.fakeCardNumber}>
                    {cardNumber || "0000 0000 0000 0000"}
                  </div>
                  <div style={styles.fakeCardBottom}>
                    <span>{cardName || "CARDHOLDER NAME"}</span>
                    <span>{expiry || "MM/YY"}</span>
                  </div>
                </div>

                <div style={styles.form}>
                  <label style={styles.label}>
                    Номер картки
                    <input
                      style={styles.input}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="4242 4242 4242 4242"
                    />
                  </label>

                  <label style={styles.label}>
                    Ім’я власника
                    <input
                      style={styles.input}
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="IVAN PETRENKO"
                    />
                  </label>

                  <div style={styles.twoCols}>
                    <label style={styles.label}>
                      Дійсна до
                      <input
                        style={styles.input}
                        value={expiry}
                        onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                        placeholder="MM/YY"
                      />
                    </label>

                    <label style={styles.label}>
                      CVV
                      <input
                        style={styles.input}
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="123"
                      />
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <div style={styles.altPayBox}>
                <p style={{ marginTop: 0 }}>
                  Це демонстраційний режим {paymentMethod === "apple" ? "Apple Pay" : "Google Pay"}.
                </p>
                <p style={{ opacity: 0.75 }}>
                  Після натискання кнопки нижче система імітує успішну оплату.
                </p>
              </div>
            )}

            <div style={styles.secureBox}>
              🔒 Ваш платіж захищений. Дані картки не зберігаються.
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <button
              onClick={handlePay}
              disabled={paying || booking.status !== "pending_payment"}
              style={{
                ...styles.payBtn,
                opacity: paying || booking.status !== "pending_payment" ? 0.6 : 1,
                cursor: paying || booking.status !== "pending_payment" ? "not-allowed" : "pointer"
              }}
            >
              {paying ? "Обробка платежу..." : `Оплатити ${total} грн`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: 40,
    background: "#f5f6f9",
    minHeight: "100vh"
  },
  wrapper: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "1fr 1.1fr",
    gap: 20,
    alignItems: "start"
  },
  left: {},
  right: {},
  card: {
    background: "white",
    borderRadius: 18,
    padding: 22,
    border: "1px solid #eee",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
  },
  route: {
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 8
  },
  meta: {
    opacity: 0.75,
    marginBottom: 18
  },
  summary: {
    display: "grid",
    gap: 10,
    marginBottom: 18
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottom: "1px solid #f1f1f1"
  },
  totalBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    background: "#f7f8ff",
    border: "1px solid #e3e6ff",
    fontSize: 18
  },
  methods: {
    display: "flex",
    gap: 10,
    marginBottom: 18,
    flexWrap: "wrap"
  },
  methodBtn: {
    border: "1px solid #ddd",
    background: "white",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 600
  },
  methodActive: {
    border: "1px solid #111",
    background: "#111",
    color: "white"
  },
  fakeCard: {
    background: "linear-gradient(135deg, #111, #333)",
    color: "white",
    borderRadius: 18,
    padding: 20,
    marginBottom: 18,
    minHeight: 180,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between"
  },
  fakeCardTop: {
    fontWeight: 700,
    opacity: 0.85
  },
  fakeCardNumber: {
    fontSize: 24,
    letterSpacing: 2,
    fontWeight: 700
  },
  fakeCardBottom: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    opacity: 0.85
  },
  form: {
    display: "grid",
    gap: 14
  },
  label: {
    display: "grid",
    gap: 6,
    fontSize: 13
  },
  input: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #ddd",
    outline: "none"
  },
  twoCols: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12
  },
  secureBox: {
    marginTop: 18,
    marginBottom: 14,
    background: "#f8fafc",
    border: "1px solid #e6edf5",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    opacity: 0.85
  },
  altPayBox: {
    background: "#fafafa",
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12
  },
  payBtn: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "none",
    background: "#111",
    color: "white",
    fontWeight: 800,
    fontSize: 15
  },
  error: {
    marginBottom: 14,
    background: "#ffe8ee",
    color: "#b00020",
    borderRadius: 12,
    padding: 12,
    whiteSpace: "pre-wrap"
  },
  successCard: {
    maxWidth: 500,
    margin: "80px auto",
    background: "white",
    borderRadius: 18,
    padding: 30,
    textAlign: "center",
    border: "1px solid #eee",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
  },
  successIcon: {
    width: 70,
    height: 70,
    borderRadius: "50%",
    margin: "0 auto 18px",
    background: "#e9fbe9",
    color: "#1a7f37",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    fontWeight: 800
  }
};