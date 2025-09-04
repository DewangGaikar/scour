// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { supabase } from "../supabaseClient";
import axios from "axios";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalGroups: 0,
    joinedGroups: 0,
    maliciousGroups: 0,
    flaggedMessages: 0,
  });
  const [topGroups, setTopGroups] = useState([]);
  const [recentGroups, setRecentGroups] = useState([]);
  const [recentlyScanned, setRecentlyScanned] = useState([]);

  const [logs, setLogs] = useState([]); // live output
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch total groups
        const { data: allGroups, error: groupsError } = await supabase
          .from("groups")
          .select("*");

        const { data: FoundlinkGroups, error: FoundlinkGroupsError } =
          await supabase.from("found_links").select("*");

        if (groupsError) throw groupsError;
        if (FoundlinkGroupsError) throw FoundlinkGroupsError;

        const totalGroups = FoundlinkGroups.length;
        const res = await fetch("http://127.0.0.1:8000/joined-groups-count");
        const joinedData = await res.json();
        const joinedGroups = joinedData.joined_groups_count;
        const maliciousGroups = allGroups.filter((g) => g.flagged).length;

        // Fetch flagged messages
        const { data: flaggedMsgs, error: msgError } = await supabase
          .from("group_messages")
          .select("*");

        if (msgError) throw msgError;

        const flaggedMessages = flaggedMsgs.length;

        // Top 5 groups by number of flagged messages
        const topGroups = await Promise.all(
          allGroups.map(async (g) => {
            const { data: msgs } = await supabase
              .from("group_messages")
              .select("*")
              .eq("group_id", g.group_id);
            return {
              name: g.group_name,
              flaggedMessages: msgs?.length || 0,
            };
          })
        );
        topGroups.sort((a, b) => b.flaggedMessages - a.flaggedMessages);

        // Recent groups (last 5 inserted)
        const recentGroups = allGroups
          .slice(-5)
          .map((g) => ({ name: g.group_name }));

        // Recently scanned (last 5 scanned)
        const recentlyScanned = allGroups
          .filter((g) => g.last_scanned_at)
          .sort(
            (a, b) => new Date(b.last_scanned_at) - new Date(a.last_scanned_at)
          )
          .slice(0, 5)
          .map((g) => ({
            name: g.group_name,
            result: g.flagged ? "Flagged" : "OK",
          }));

        // Update state
        setStats({
          totalGroups,
          joinedGroups,
          maliciousGroups,
          flaggedMessages,
        });
        setTopGroups(topGroups.slice(0, 5));
        setRecentGroups(recentGroups);
        setRecentlyScanned(recentlyScanned);
      } catch (err) {
        console.error("Error fetching Supabase data:", err);
      }
    }

    fetchData();
  }, []);

  // Timer effect to reduce cooldown every second
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);
  //status fetching
  const startScript = (url) => {
    setLogs([]);
    setLoading(true);

    const eventSource = new EventSource(url);

    eventSource.onmessage = (e) => {
      if (e.data === "SCRIPT_COMPLETED") {
        setLoading(false);
        eventSource.close();
      } else {
        setLogs((prev) => [...prev, e.data]);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE error:", err);
      setLoading(false);
      eventSource.close();
    };
  };

  //Handle Scan
  const handleScan = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        "http://127.0.0.1:8000/get-messages?limit=10"
      );

      if (res.data.cooldown) {
        setCooldown(res.data.cooldown);
        alert(
          `Flood detected! Wait for ${res.data.cooldown} seconds before scanning again.`
        );
      } else {
        console.log(res.data.results);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  //Leave all groups function
  const handleLeaveAllGroups = async () => {
    if (!window.confirm("Are you sure you want to leave all groups?")) return;

    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/leave-all-groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      console.log("Leave groups result:", data);
      alert(
        `Left ${data.left.length} groups.\nSkipped ${data.skipped.length} important groups.`
      );
    } catch (err) {
      console.error("Error leaving groups:", err);
      alert("Failed to leave groups. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-950 h-screen text-white overflow-y-auto scrollbar-hide">
      <h1 className="text-2xl font-bold mb-4">📊 Dashboard</h1>

      {/* Action Buttons */}
      <div className="flex space-x-4 mb-4">
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() =>
            startScript("http://localhost:5000/api/stream-searchweb")
          }
          disabled={loading}
        >
          Start Scanning Internet for Groups
        </Button>
        <div>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleScan}
            disabled={loading || cooldown > 0}
          >
            {loading
              ? "Scanning Groups for Malicious Messages..."
              : "Start Scanning Groups for Malicious Messages"}
          </Button>
          {cooldown > 0 && <p>Cooldown: {cooldown} seconds</p>}
        </div>
        <Button
          className="bg-red-600 hover:bg-red-700"
          onClick={handleLeaveAllGroups}
          disabled={loading}
        >
          Leave all currently joined groups
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gray-800 text-white shadow-md">
          <CardHeader>
            <CardTitle>Total Groups links found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalGroups}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 text-white shadow-md">
          <CardHeader>
            <CardTitle>Groups Joined</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {stats.joinedGroups}/{stats.totalGroups}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 text-white shadow-md">
          <CardHeader>
            <CardTitle>Malicious Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {stats.maliciousGroups}/{stats.totalGroups}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 text-white shadow-md">
          <CardHeader>
            <CardTitle>Flagged Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.flaggedMessages}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 flagged groups */}
      <Card className="bg-gray-900">
        <CardHeader>
          <CardTitle>🔥 Highest Flagged Groups (Top 5)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {topGroups.length > 0 ? (
              topGroups.map((g, i) => (
                <li
                  key={i}
                  className="flex justify-between p-3 rounded-lg bg-gray-800"
                >
                  <span>{g.name}</span>
                  <span className="text-red-400">
                    {g.flaggedMessages} flagged
                  </span>
                </li>
              ))
            ) : (
              <p className="text-gray-400">No flagged groups yet.</p>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Recent groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-900">
          <CardHeader>
            <CardTitle>🆕 Recently Added Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recentGroups.length > 0 ? (
                recentGroups.map((g, i) => (
                  <li key={i} className="p-2 bg-gray-800 rounded-lg">
                    {g.name}
                  </li>
                ))
              ) : (
                <p className="text-gray-400">No recent groups found.</p>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gray-900">
          <CardHeader>
            <CardTitle>🔍 Recently Scanned Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recentlyScanned.length > 0 ? (
                recentlyScanned.map((g, i) => (
                  <li key={i} className="p-2 bg-gray-800 rounded-lg">
                    {g.name} -{" "}
                    <span className="text-sm text-gray-400">
                      {g.result || "OK"}
                    </span>
                  </li>
                ))
              ) : (
                <p className="text-gray-400">No recent scans.</p>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
      {/*status lines*/}
      <Card className="bg-gray-900">
        <CardHeader className="text-2xl font-bold mb-2 ">
          <CardTitle>🚀 Real-Time Scanner Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 p-4 rounded shadow h-24 overflow-hidden">
            {logs.length === 0 ? (
              <p className="text-gray-400 text-sm">Logs will appear here...</p>
            ) : (
              <div className="text-sm space-y-1">
                {/* Show only the last 2 lines */}
                {logs.slice(-2).map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
