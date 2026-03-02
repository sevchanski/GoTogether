const API_URL = "http://127.0.0.1:8000";

export async function login(email, password) {
  const res = await fetch(`${API_URL}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || "Login error");
  }

  // зберігаємо токени
  localStorage.setItem("access", data.access);
  localStorage.setItem("refresh", data.refresh);

  return data;
}

export function getAccessToken() {
  return localStorage.getItem("access");
}