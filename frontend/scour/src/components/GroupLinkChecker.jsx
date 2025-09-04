import { Dialog } from "@headlessui/react"; // optional for modal
import { useState } from "react";
import { Button } from "../components/ui/button";
import axios from "axios";
// GroupLinkChecker.jsx
export default function GroupLinkChecker({ onClose }) {
  const [link, setLink] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/check-single-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_link: link }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-md relative shadow-xl">
        {/* Close button */}
        <button
          className="absolute top-3 right-3 text-red-500 text-xl font-bold hover:text-red-400"
          onClick={onClose}
        >
          ✖
        </button>

        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-center">
            Telegram Link Safety Checker
          </h2>
        </div>

        {/* Input & Button */}
        <div className="p-6 space-y-4">
          <input
            type="text"
            placeholder="Paste Telegram link here..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCheck}
            disabled={loading || !link.trim()}
            className={`w-full p-3 rounded-lg font-semibold text-white ${
              loading
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Checking..." : "Check Link"}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`p-4 rounded-b-xl ${
              result.error
                ? "bg-red-500 text-white"
                : result.flagged
                ? "bg-red-600 text-white"
                : "bg-green-600 text-white"
            }`}
          >
            {result.error ? (
              <p className="text-center font-bold">{result.error}</p>
            ) : (
              <>
                <p className="font-bold text-lg text-center">
                  {result.flagged ? "⚠️ Unsafe Group" : "✅ Safe Group"}
                </p>
                <p className="mt-2 text-sm text-center">
                  {result.group_name || result.channel_link}
                </p>
                {result.flagged_messages?.length > 0 && (
                  <div className="mt-3 bg-gray-800 p-3 rounded text-sm max-h-40 overflow-y-auto">
                    <p className="font-semibold mb-2">Flagged Messages:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {result.flagged_messages.map((msg, i) => (
                        <li key={i}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
