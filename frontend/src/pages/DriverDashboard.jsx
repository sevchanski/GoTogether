import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function DriverDashboard() {
  const { user } = useContext(AuthContext);

  return (
    <div style={{ maxWidth: 900, margin: "30px auto", padding: 16 }}>
      <h2>Driver Dashboard</h2>
      <p>
        Вітаю{user?.first_name ? `, ${user.first_name}` : ""}! Тут буде панель водія.
      </p>

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
        <h3>Наступні кроки</h3>
        <ul>
          <li>Створення поїздки (форма)</li>
          <li>Перегляд моїх поїздок</li>
          <li>Заявки пасажирів (approve / reject)</li>
        </ul>
      </div>
    </div>
  );
}