import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient.js";
import { Link as RouterLink } from "react-router-dom";
import { LinkIcon } from "lucide-react";

function GroupLinksPage() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLinks = async () => {
      try {
        // Fetch all found links with optional join on groups table
        const { data, error } = await supabase.from("found_links").select(`
            found_id,
            invite_link,
            last_scanned_at,
            valid_link,
            groups (
              group_id,
              group_name,
              member_count,
              flagged
            )
          `);

        if (error) throw error;
        setLinks(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLinks();
  }, []);

  if (loading) return <p className="p-4 text-gray-500">Loading...</p>;
  if (error) return <p className="p-4 text-red-500">Error: {error}</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">All Group Links</h2>

      {links.length === 0 ? (
        <p className="text-gray-500">No links found yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-800 text-white rounded-lg overflow-hidden">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left">Found ID</th>
                <th className="px-4 py-2 text-left">Invite Link</th>
                <th className="px-4 py-2 text-left">Last Scanned</th>
                <th className="px-4 py-2 text-left">Valid Link</th>
                <th className="px-4 py-2 text-left">Group ID</th>
                <th className="px-4 py-2 text-left">Group Name</th>
                <th className="px-4 py-2 text-left">Member Count</th>
                <th className="px-4 py-2 text-left">Flagged</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const group = link.groups?.[0]; // supabase returns array when joining
                return (
                  <tr key={link.found_id} className="border-b border-gray-600">
                    <td className="px-4 py-2">{link.found_id}</td>
                    <td className="px-4 py-2 break-all">
                      <a
                        href={link.invite_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 underline"
                      >
                        {link.invite_link}
                      </a>
                    </td>
                    <td className="px-4 py-2">
                      {link.last_scanned_at
                        ? new Date(link.last_scanned_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-2">
                      {link.valid_link ? "✅" : "❌"}
                    </td>
                    <td className="px-4 py-2">{group?.group_id || "-"}</td>
                    <td className="px-4 py-2">{group?.group_name || "-"}</td>
                    <td className="px-4 py-2">{group?.member_count || "-"}</td>
                    <td className="px-4 py-2">{group?.flagged ? "⚠️" : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default GroupLinksPage;
