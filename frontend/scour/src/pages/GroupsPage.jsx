import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient.js";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [error, setError] = useState(null);
  const fetchOnce = useRef(false);
  const [isOpen, setIsOpen] = useState(true);
  const [visitedGroups, setVisitedGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // // Fetch groups once session is active
  // useEffect(() => {
  //   if (fetchOnce.current) return;
  //   fetchOnce.current = true;

  //   const fetchGroups = async () => {
  //     try {
  //       const res = await fetch("http://127.0.0.1:8000/get-messages?limit=10");
  //       if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
  //       const data = await res.json();
  //       setGroups(Array.isArray(data) ? data : [data]);
  //     } catch (err) {
  //       console.error("Fetch Error:", err);
  //       setError(err.message);
  //     }
  //   };

  //   fetchGroups();
  // }, []);

  useEffect(() => {
    const fetchGroups = async () => {
      const { data, error } = await supabase.from("groups").select(`
        group_id,
        group_name,
        invite_link,
        flagged,
        member_count,
        group_messages (
          message_id,
          message_text,
          flagged_reason,
          created_at
        )
      `);

      if (!error) setGroups(data);
      else console.error(error);
    };
    fetchGroups();
  }, []);

  // Filter groups by search term
  const filteredGroups = groups.filter((group) =>
    group.group_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen ">
      {/* Sidebar */}
      <div className="flex-grow-1 bg-gray-700 border-r overflow-y-auto">
        <h2 className="text-xl font-bold p-7 border-b">📌 Flagged Groups</h2>

        {/* Search Bar */}
        <div className="p-4 border-b relative">
          <Search
            className="absolute left-7 top-1/2 transform -translate-y-1/2 text-gray-500 justify-center"
            size={20}
          />
          <input
            type="text"
            placeholder="Search groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 p-2 rounded border border-gray-400 text-gray-200"
          />
        </div>
        {filteredGroups.map((group, idx) => {
          const isSelected = selectedGroup?.group_id === group.group_id;
          const isNew = !visitedGroups.includes(group.group_id);
          const displayName =
            group.group_name.length > 32
              ? group.group_name.slice(0, 31) + "..."
              : group.group_name;

          return (
            <div
              key={idx}
              onClick={() => {
                setSelectedGroup(group);
                setVisitedGroups((prev) =>
                  prev.includes(group.group_id)
                    ? prev
                    : [...prev, group.group_id]
                );
              }}
              className={`p-4 cursor-pointer border-b hover:bg-gray-900 transition ${
                isSelected ? "bg-gray-700 text-white" : "text-gray-200"
              }`}
            >
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">{displayName}</h3>
                {isNew && (
                  <span className="w-2 h-2 bg-red-500 rounded-full ml-2"></span>
                )}
              </div>
              <p className="text-sm text-gray-200 mt-1">
                {group.group_messages?.length || 0} flagged messages
              </p>
            </div>
          );
        })}

        {groups.map((group, idx) => {
          const isSelected = selectedGroup?.group_id === group.group_id;
          const isNew = !visitedGroups.includes(group.group_id); // visitedGroups state
          const displayName =
            group.group_name.length > 32
              ? group.group_name.slice(0, 31) + "..."
              : group.group_name;

          return (
            <div
              key={idx}
              onClick={() => {
                setSelectedGroup(group);
                setVisitedGroups((prev) =>
                  prev.includes(group.group_id)
                    ? prev
                    : [...prev, group.group_id]
                );
              }}
              className={`p-4 cursor-pointer border-b hover:bg-gray-900 transition ${
                isSelected ? "bg-gray-700 text-white" : "text-gray-200"
              }`}
            >
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">{displayName}</h3>
                {isNew && (
                  <span className="w-2 h-2 bg-red-500 rounded-full ml-2"></span>
                )}
              </div>
              <p className="text-sm text-gray-200 mt-1">
                {group.group_messages?.length || 0} flagged messages
              </p>
            </div>
          );
        })}
      </div>

      {/* Main Group Messages */}
      <div className="flex flex-col flex-grow-3">
        {selectedGroup ? (
          <>
            <div className="p-4 border-b shadow-sm bg-gray-700 text-white">
              <h2 className="text-lg font-bold">{selectedGroup.group_name}</h2>
              <a
                href={selectedGroup.invite_link}
                target="_blank"
                rel="noreferrer"
                className="text-blue-300 text-sm underline"
              >
                {selectedGroup.invite_link}
              </a>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
              {selectedGroup.group_messages &&
              selectedGroup.group_messages.length > 0 ? (
                <div className="flex flex-col space-y-3">
                  {selectedGroup.group_messages.map((msg, i) => (
                    <div key={i} className="flex justify-start">
                      <div className="max-w-md p-3 rounded-2xl shadow-md text-sm break-words bg-white text-gray-900 rounded-bl-none">
                        <div
                          className="whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{
                            __html: msg.message_text
                              .replace(/\*(.*?)\*/g, "<b>$1</b>")
                              .replace(/_(.*?)_/g, "<i>$1</i>")
                              .replace(/~(.*?)~/g, "<s>$1</s>")
                              .replace(/`(.*?)`/g, "<code>$1</code>"),
                          }}
                        />
                        <div className="text-[10px] text-gray-500 text-right mt-1">
                          {new Date(msg.created_at).toLocaleTimeString()}
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
      <div
        className={`relative transition-all duration-300 border-l bg-gray-200 overflow-y-auto text-black flex-grow-0.3
      ${isOpen ? "flex-grow-1 p-4" : "w-12 p-2"}`}
      >
        {/* Toggle button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute -center top-6 bg-gray-300 rounded-full p-1 shadow-md hover:bg-gray-400"
        >
          {isOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>

        {isOpen ? (
          selectedGroup ? (
            <div className="flex flex-col items-center">
              <img
                src={
                  selectedGroup.profile_picture ||
                  "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"
                }
                alt={`${selectedGroup.group_name} Profile`}
                className="w-24 h-24 rounded-full mb-4 object-cover shadow-md"
              />
              <h2 className="text-lg font-bold mb-4 text-center">
                Group Details
              </h2>
              <div className="w-full text-left">
                <p className="mb-2">
                  <span className="font-semibold">Name:</span>{" "}
                  {selectedGroup.group_name}
                </p>
                <p className="mb-2">
                  <span className="font-semibold">Link:</span>{" "}
                  <a
                    href={selectedGroup.invite_link}
                    className="text-blue-600 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selectedGroup.invite_link}
                  </a>
                </p>
                <p className="mb-2">
                  <span className="font-semibold">Flagged Messages:</span>{" "}
                  {selectedGroup.group_messages?.length || 0}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-500 text-center">
                Select a group to view details
              </p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="rotate-90 text-xs font-semibold">Details</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default GroupsPage;
