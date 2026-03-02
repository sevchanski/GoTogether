import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Trips() {
  const [trips, setTrips] = useState([]);
  const navigate = useNavigate();
  const token = localStorage.getItem("access");

  useEffect(() => {
    fetch("http://localhost:8000/api/trips/")
      .then(res => res.json())
      .then(data => setTrips(data));
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h2>Доступні поїздки</h2>

      {trips.map(trip => (
        <div key={trip.id} style={{
          border: "1px solid #ccc",
          padding: 15,
          marginBottom: 15
        }}>
          <strong>{trip.origin} → {trip.destination}</strong>
          <p>Ціна: {trip.price_per_seat} грн</p>

          {token ? (
            <button>Приєднатись</button>
          ) : (
            <button onClick={() => navigate("/login")}>
              Увійти щоб приєднатись
            </button>
          )}
        </div>
      ))}
    </div>
  );
}