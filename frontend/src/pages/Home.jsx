import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{ textAlign: "center", marginTop: 80 }}>
      <h1>Знайди попутника легко 🚗</h1>
      <p>Обирай маршрут, переглядай ціни та приєднуйся</p>

      <div style={{ marginTop: 30 }}>
        <Link to="/trips">
          <button style={{ marginRight: 15 }}>
            Переглянути поїздки
          </button>
        </Link>
      </div>
    </div>
  );
}