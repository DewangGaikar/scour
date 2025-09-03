import { useState } from "react";
import axios from "axios";

export default function LoginPage({ setSession }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setLoading(true);
    setMessage("");
    try {
      const res = await axios.post("http://localhost:5000/api/signup", {
        email,
        password,
      });
      setMessage("Signup successful! Check your email.");
    } catch (err) {
      setMessage(err.response?.data?.error || "Signup failed");
    }
    setLoading(false);
  }

  async function handleLogin() {
    setLoading(true);
    setMessage("");
    try {
      const res = await axios.post("http://localhost:5000/api/login", {
        email,
        password,
      });
      const token = res.data.session?.access_token;
      if (!token) throw new Error("Login failed: no session returned");
      localStorage.setItem("token", token);
      setSession({ access_token: token });
      setMessage("Login successful!");
    } catch (err) {
      setMessage(err.response?.data?.error || err.message || "Login failed");
    }
    setLoading(false);
  }

  async function handleGuest() {
    setLoading(true);
    setMessage("");
    try {
      const res = await axios.post("http://localhost:5000/api/guest");
      const token = res.data.session?.access_token;
      if (!token) throw new Error("Guest login failed: no session returned");
      localStorage.setItem("token", token);
      setSession({ access_token: token });
      setMessage("Guest login successful!");
    } catch (err) {
      setMessage(
        err.response?.data?.error || err.message || "Guest login failed"
      );
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-gray-900 text-white p-4">
      <div className="w-full max-w-md bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center">
        <h1 className="text-2xl mb-6 text-white font-bold">Login</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 p-3 rounded w-full text-white bg-gray-700 placeholder-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 p-3 rounded w-full text-white bg-gray-700 placeholder-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <div className="flex flex-col sm:flex-row gap-3 w-full mb-4">
          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded text-white"
          >
            Sign Up
          </button>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full sm:w-auto bg-green-500 hover:bg-green-600 px-4 py-2 rounded text-white"
          >
            Login
          </button>
          <button
            onClick={handleGuest}
            disabled={loading}
            className="w-full sm:w-auto bg-gray-500 hover:bg-gray-600 px-4 py-2 rounded text-white"
          >
            Guest
          </button>
        </div>

        {message && (
          <p className="text-center text-white mt-2 break-words">{message}</p>
        )}
      </div>
    </div>
  );
}
