// src/App.jsx
import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient.js";
import LoginPage from "./pages/Login"; // Your login page component

function App() {
  const [session, setSession] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [error, setError] = useState(null);
  const fetchOnce = useRef(false);

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

  // Fetch groups once session is active (user or guest)
  useEffect(() => {
    if (!session) return;
    if (fetchOnce.current) return;
    fetchOnce.current = true;

    const fetchGroups = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/get-messages?limit=10");
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        const data = await res.json();
        setGroups(Array.isArray(data) ? data : [data]);
      } catch (err) {
        console.error("Fetch Error:", err);
        setError(err.message);
      }
    };

    fetchGroups();
  }, [session]);

  // Guest login handler
  const handleGuestLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email: `guest${Date.now()}@example.com`, // temporary guest email
    });
    if (error) {
      alert(error.message);
      return;
    }
    alert("Guest login initiated. Check email for login link.");
  };

  // If no session, show login page
  if (!session) {
    return (
      <LoginPage setSession={setSession} onGuestLogin={handleGuestLogin} />
    );
  }

  // Main dashboard
  return (
    <div className="flex h-screen w-screen">
      {/* Sidebar */}
      <div className="w-[20%] bg-gray-500 border-r overflow-y-auto">
        <h2 className="text-xl font-bold p-7 border-b">📌 Flagged Groups</h2>
        {groups.map((group, idx) => (
          <div
            key={idx}
            onClick={() => setSelectedGroup(group)}
            className={`p-4 cursor-pointer border-b hover:bg-gray-900 text-black-700 transition ${
              selectedGroup?.channel_name === group.channel_name
                ? "bg-gray-700 text-black-700"
                : ""
            }`}
          >
            <h3 className="font-semibold">{group.channel_name}</h3>
            <p className="text-sm text-gray-600">
              {group.flagged_messages.length} flagged messages
            </p>
          </div>
        ))}
      </div>

      {/* Right pane */}
      <div className="w-[60%] flex flex-col">
        {selectedGroup ? (
          <>
            <div className="p-4 border-b shadow-sm bg-gray-700">
              <h2 className="text-lg font-bold">
                {selectedGroup.channel_name}
              </h2>
              <a
                href={selectedGroup.channel_link}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 text-sm underline"
              >
                {selectedGroup.channel_link}
              </a>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
              {selectedGroup.flagged_messages.length > 0 ? (
                <div className="flex flex-col space-y-3">
                  {selectedGroup.flagged_messages.map((msg, i) => (
                    <div key={i} className="flex justify-start">
                      <div className="max-w-md p-3 rounded-2xl shadow-md text-sm break-words bg-white text-gray-900 rounded-bl-none">
                        <div
                          className="whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{
                            __html: msg
                              .replace(/\*(.*?)\*/g, "<b>$1</b>")
                              .replace(/_(.*?)_/g, "<i>$1</i>")
                              .replace(/~(.*?)~/g, "<s>$1</s>")
                              .replace(/`(.*?)`/g, "<code>$1</code>"),
                          }}
                        />
                        <div className="text-[10px] text-gray-500 text-right mt-1">
                          10:{i.toString().padStart(2, "0")} AM
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No flagged messages found.</p>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 text-gray-500">
            Select a group to view flagged messages
          </div>
        )}
      </div>

      {/* Group Details */}
      <div className="w-[20%] bg-gray-200 border-l p-4 overflow-y-auto flex flex-col items-center text-black">
        {selectedGroup ? (
          <>
            <img
              src={
                selectedGroup.profile_picture ||
                "https://i.pravatar.cc/150?img=12"
              }
              alt={`${selectedGroup.channel_name} Profile`}
              className="w-24 h-24 rounded-full mb-4 object-cover shadow-md"
            />
            <h2 className="text-lg font-bold mb-4 text-center">
              Group Details
            </h2>
            <div className="w-full text-left">
              <p className="mb-2">
                <span className="font-semibold">Name:</span>{" "}
                {selectedGroup.channel_name}
              </p>
              <p className="mb-2">
                <span className="font-semibold">Link:</span>{" "}
                <a
                  href={selectedGroup.channel_link}
                  className="text-blue-600 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {selectedGroup.channel_link}
                </a>
              </p>
              <p className="mb-2">
                <span className="font-semibold">Flagged Messages:</span>{" "}
                {selectedGroup.flagged_messages.length}
              </p>
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-center">
            Select a group to view details
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
