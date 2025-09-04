// src/App.jsx
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
import LoginPage from "./pages/Login";
import GroupsPage from "./pages/GroupsPage";
import Dashboard from "./pages/Dashboard";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import {
  Menu,
  X,
  Settings,
  Filter,
  Home,
  Users,
  History,
  Link as LinkIcon,
  MessageSquare,
} from "lucide-react";
import GroupLinksPage from "./pages/GroupLinksPage.jsx";

function App() {
  const [session, setSession] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Check Supabase session on load
  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    }
    checkSession();

    const { subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  // Guest login handler via backend API
  const handleGuestLogin = async () => {
    try {
      const res = await fetch("http://127.0.0.1:5000/api/guest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }

      const data = await res.json();

      if (data.error) {
        alert(`Guest login failed: ${data.error}`);
        return;
      }

      // Store session in state or localStorage
      setSession(data.session);

      console.log("Guest login successful:", data.user.id);
      alert("Logged in as guest!");
    } catch (err) {
      console.error("Guest login error:", err);
      alert("Something went wrong while logging in as guest.");
    }
  };

  // Show login page if no session
  if (!session) {
    return (
      <LoginPage setSession={setSession} onGuestLogin={handleGuestLogin} />
    );
  }

  return (
    <Router>
      <div className="flex h-screen w-screen bg-gray-900 text-white">
        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? "w-64" : "w-16"
          } bg-gray-800 p-4 flex flex-col transition-all duration-300`}
        >
          {/* Toggle button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mb-6 flex items-center justify-center w-10 h-10 rounded-lg bg-gray-700 hover:bg-gray-600"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Sidebar Links */}
          <nav className="flex flex-col gap-4">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 hover:bg-gray-700 p-2 rounded-lg"
            >
              <Home size={20} />
              {sidebarOpen && <span>Dashboard</span>}
            </Link>
            <Link
              to="/groups"
              className="flex items-center gap-2 hover:bg-gray-700 p-2 rounded-lg"
            >
              <MessageSquare size={20} />
              {sidebarOpen && <span>Group Messages</span>}
            </Link>
            {/* <Link
              to="/groups"
              className="flex items-center gap-2 hover:bg-gray-700 p-2 rounded-lg"
            >
              <History size={20} />
              {sidebarOpen && <span>Groups History</span>}
            </Link> */}
            <Link
              to="/links"
              className="flex items-center gap-2 hover:bg-gray-700 p-2 rounded-lg"
            >
              <LinkIcon size={20} />
              {sidebarOpen && <span>Groups Links</span>}
            </Link>
            <Link
              to="/filters"
              className="flex items-center gap-2 hover:bg-gray-700 p-2 rounded-lg"
            >
              <Filter size={20} />
              {sidebarOpen && <span>Filters</span>}
            </Link>
            <Link
              to="/settings"
              className="flex items-center gap-2 hover:bg-gray-700 p-2 rounded-lg"
            >
              <Settings size={20} />
              {sidebarOpen && <span>Settings</span>}
            </Link>
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto scrollbar-hide">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/links" element={<GroupLinksPage />} />

            <Route
              path="/links"
              element={<div className="text-xl">📌 Groups Links Page</div>}
            />
            <Route
              path="/filters"
              element={<div className="text-xl">⚡ Filters Page</div>}
            />
            <Route
              path="/settings"
              element={<div className="text-xl">⚙️ Settings Page</div>}
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
