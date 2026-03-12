import { Link, useNavigate, useLocation } from "react-router-dom";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../context/AuthContext";

const API = "http://localhost:8000"; // для avatar

export default function Navbar() {
  const { isAuthenticated, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Закривати dropdown при переході на інший маршрут
  useEffect(() => setOpen(false), [location.pathname]);

  // Закриття по кліку поза меню + ESC
  useEffect(() => {
    const onClick = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const isDriver = !!user?.is_driver;

  const avatarSrc = useMemo(() => {
    if (!user?.avatar) return "";
    if (user.avatar.startsWith("http")) return user.avatar;

    const normalized = user.avatar.startsWith("/")
      ? user.avatar
      : `/${user.avatar}`;

    return `${API}${normalized}`;
  }, [user]);

  const initials = useMemo(() => {
    const f = (user?.first_name || "").trim();
    const l = (user?.last_name || "").trim();
    const first = f ? f[0].toUpperCase() : "";
    const last = l ? l[0].toUpperCase() : "";
    return `${first}${last}`.trim() || "U";
  }, [user]);

  const displayName = useMemo(() => {
    const full = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
    return full || user?.email || "Користувач";
  }, [user]);

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/");
  };

  return (
    <nav style={styles.nav}>
      <Link to="/" style={styles.logo}>
        GoTogether 🚗
      </Link>

      <div style={styles.right}>
        {/* ✅ Для водія — кнопка "Створити поїздку" */}
        {isAuthenticated && isDriver && (
          <Link to="/createtrip" style={styles.primaryLink}>
            Створити поїздку
          </Link>
        )}

        {/* ✅ Для всіх — "Пошук поїздок" */}
        <Link to="/trips" style={styles.link}>
          Пошук поїздок
        </Link>

        {/* Avatar dropdown */}
        <div ref={wrapRef} style={styles.menuWrap}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={styles.avatarBtn}
            aria-label="Меню користувача"
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="avatar" style={styles.avatarImg} />
            ) : (
              <div style={styles.avatarFallback}>{initials}</div>
            )}

            <span style={{ ...styles.caret, ...(open ? styles.caretOpen : {}) }}>
              ▾
            </span>
          </button>

          {open && (
            <div style={styles.dropdown}>
              {!isAuthenticated ? (
                <>
                  <MenuItem onClick={() => go("/login")}>Авторизація</MenuItem>
                  <MenuItem onClick={() => go("/register")}>Реєстрація</MenuItem>
                </>
              ) : (
                <>
                  <div style={styles.dropdownHeader}>
                    <div style={styles.dropdownName}>{displayName}</div>
                    <div style={styles.dropdownSub}>
                      {isDriver ? "Водій" : "Пасажир"}
                    </div>
                  </div>

                  <div style={styles.hr} />

                  {isDriver && (
                    <MenuItem onClick={() => go("/driver-dashboard")}>
                      Кабінет водія
                    </MenuItem>
                  )}

                  <MenuItem onClick={() => go("/my-trips")}>Ваші поїздки</MenuItem>
                  <MenuItem onClick={() => go("/profile")}>Профіль</MenuItem>

                  {isDriver ? (
                    <MenuItem onClick={() => go("/payouts")}>Виплати (водій)</MenuItem>
                  ) : (
                    <MenuItem onClick={() => go("/payments")}>
                      Платежі та відшкодування
                    </MenuItem>
                  )}

                  <div style={styles.hr} />

                  <MenuItem danger onClick={handleLogout}>
                    Вийти
                  </MenuItem>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function MenuItem({ children, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...styles.item, ...(danger ? styles.itemDanger : {}) }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    padding: "14px 28px",
    backgroundColor: "#0052cc", // Синій фон
    color: "white",
    alignItems: "center",
    position: "sticky",
    top: 0,
    zIndex: 10,
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  },
  logo: {
    color: "white",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: 20,
    letterSpacing: 0.4,
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  link: {
    color: "white",
    textDecoration: "none",
    fontSize: 14,
    opacity: 0.9,
  },
  primaryLink: {
    color: "#0052cc", // Синій текст для білої кнопки
    background: "#fff",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 700,
    padding: "8px 12px",
    borderRadius: 10,
  },
  menuWrap: { position: "relative" },
  avatarBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer",
  },
  caret: {
    color: "white",
    opacity: 0.8,
    fontSize: 12,
    transform: "translateY(1px)",
    transition: "transform 0.15s ease",
  },
  caretOpen: {
    transform: "translateY(1px) rotate(180deg)",
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: "999px",
    objectFit: "cover",
    display: "block",
    border: "2px solid rgba(255,255,255,0.4)",
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: "999px",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.2)",
    border: "2px solid rgba(255,255,255,0.4)",
    color: "white",
    fontWeight: 800,
    fontSize: 13,
  },
  dropdown: {
    position: "absolute",
    right: 0,
    top: 46,
    width: 260,
    background: "#0041a3", // Темніший синій для меню
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
    zIndex: 50,
  },
  dropdownHeader: {
    padding: "12px 12px 10px",
  },
  dropdownName: {
    fontWeight: 800,
    fontSize: 14,
    color: "white",
  },
  dropdownSub: {
    marginTop: 2,
    fontSize: 12,
    color: "white",
    opacity: 0.7,
  },
  hr: {
    height: 1,
    background: "rgba(255,255,255,0.15)",
  },
  item: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    background: "transparent",
    border: "none",
    color: "white",
    cursor: "pointer",
    fontSize: 14,
  },
  itemDanger: {
    color: "#ffabab", // Ніжно-червоний для синього фону
    fontWeight: 700,
  },
};