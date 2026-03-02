import { useState } from "react";
import { useNavigate } from "react-router-dom";


const API = "http://localhost:8000";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    password: "",
    password2: "",
  });

  const [error, setError] = useState("");

  const onChange = (e) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    const response = await fetch(`${API}/api/register/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(form)
    });

    const data = await response.json();

    if (response.ok) {
      alert("Реєстрація успішна");
      navigate("/login");
    } else {
      setError(JSON.stringify(data));
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Register</h2>

        <form onSubmit={handleRegister}>

          <input
            className="input"
            name="first_name"
            placeholder="Імʼя"
            value={form.first_name}
            onChange={onChange}
            required
          />

          <input
            className="input"
            name="last_name"
            placeholder="Прізвище"
            value={form.last_name}
            onChange={onChange}
            required
          />

          <input
            className="input"
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={onChange}
            required
          />

          <input
            className="input"
            name="phone_number"
            placeholder="Номер телефону"
            value={form.phone_number}
            onChange={onChange}
            required
          />

          <input
            className="input"
            name="password"
            type="password"
            placeholder="Пароль"
            value={form.password}
            onChange={onChange}
            required
          />

          <input
            className="input"
            name="password2"
            type="password"
            placeholder="Повторіть пароль"
            value={form.password2}
            onChange={onChange}
            required
          />

          <button className="button button-primary">
            Зареєструватися
          </button>

        </form>

        {error && (
          <p style={{ color: "red", marginTop: 15 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}