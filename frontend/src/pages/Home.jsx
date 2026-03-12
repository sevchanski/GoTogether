import React from "react";
import { Link } from "react-router-dom";
import Lottie from "lottie-react";
// Заміни './assets/car-animation.json' на шлях до свого файлу
import carAnimation from "../assets/car-animation.json";

export default function Home() {
  return (
    <div style={styles.container}>
      <style>{`
        .main-button {
          background-color: #0072e8;
          color: #fff;
          padding: 16px 35px;
          font-size: 1.1rem;
          font-weight: 600;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(0, 114, 232, 0.2);
          display: inline-block;
          text-decoration: none;
        }
        .main-button:hover {
          background-color: #0056b3;
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(0, 114, 232, 0.4);
        }
        @media (max-width: 850px) {
          .content-wrapper {
            flex-direction: column !important;
            text-align: center !important;
            padding: 40px 20px !important;
          }
          .side-content {
            padding-left: 0 !important;
            margin-top: 20px;
          }
          .lottie-container {
            width: 80% !important;
          }
        }
      `}</style>

      <div className="content-wrapper" style={styles.wrapper}>

        {/* Ліва частина: Lottie Анімація */}
        <div className="lottie-container" style={styles.leftSide}>
          <Lottie
            animationData={carAnimation}
            loop={true}
            // Збільшуємо maxWidth та ставимо width: 120% для масштабування
            style={{ width: "200%", maxWidth: "800px", transform: "scale(1.1)" }}
          />
        </div>

        {/* Права частина: Контент */}
        <div className="side-content" style={styles.rightSide}>
          <h1 style={styles.title}>Знайди попутника легко </h1>
          <p style={styles.description}>
            Обирай маршрут, переглядай ціни та приєднуйся
          </p>

          <Link to="/trips">
            <button className="main-button">
              Переглянути поїздки
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    fontFamily: "'Inter', -apple-system, sans-serif",
    overflowX: "hidden",
  },
  wrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: "1200px",
    width: "100%",
    padding: "0 40px",
  },
  leftSide: {
    flex: 1.2,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  rightSide: {
    flex: 1,
    paddingLeft: "80px",
    textAlign: "left",
  },
  title: {
    fontSize: "3.2rem",
    fontWeight: "800",
    color: "#1a1a1a",
    lineHeight: "1.1",
    marginBottom: "24px",
    letterSpacing: "-1px",
  },
  description: {
    fontSize: "1.25rem",
    color: "#4a4a4a",
    lineHeight: "1.6",
    marginBottom: "40px",
    maxWidth: "450px",
  },
};