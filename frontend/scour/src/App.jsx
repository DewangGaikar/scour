// src/App.jsx
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
import LoginPage from "./pages/Login";
import GroupsPage from "./pages/GroupsPage";
import Dashboard from "./pages/Dashboard";
import { Button } from "./components/ui/button";
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
            sidebarOpen ? "w-56" : "w-16"
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
          <nav className="flex flex-col gap-4 h-screen">
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
            {/* <Link
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
            </Link> */}
          </nav>
          <Button
            className="bg-gray-800 hover:bg-gray-900 text-white flex items-center gap-2"
            onClick={() =>
              window.open("https://github.com/DewangGaikar/scour", "_blank")
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.26.82-.577 0-.285-.01-1.04-.016-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.753-1.333-1.753-1.09-.745.083-.73.083-.73 1.205.084 1.838 1.24 1.838 1.24 1.07 1.835 2.807 1.305 3.492.997.108-.774.418-1.305.762-1.605-2.665-.3-5.467-1.335-5.467-5.932 0-1.31.465-2.382 1.235-3.222-.123-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23a11.53 11.53 0 0 1 3-.405c1.02.005 2.045.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.655 1.653.243 2.873.12 3.176.77.84 1.23 1.912 1.23 3.222 0 4.61-2.807 5.628-5.48 5.922.43.37.815 1.096.815 2.21 0 1.595-.014 2.882-.014 3.27 0 .32.216.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            {sidebarOpen && <span>View on GitHub</span>}
          </Button>
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
