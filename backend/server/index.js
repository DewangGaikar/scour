import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "./middleware/verifyToken.js";
import { spawn } from "child_process";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// -------------------- Routes --------------------

// Public routes
app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// // Guest login
// app.post("/api/guest", async () => {
//   const { data, error } = await supabase.auth.signInAnonymously();
//   if (error) {
//     console.error("Error signing in anonymously:", error.message);
//   } else if (data && data.session) {
//     setSession(data.session);
//     console.log("Anonymous user signed in:", data.session.user.id);
//   }
// });
// Guest login API
app.post("/api/guest", async (req, res) => {
  try {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      console.error("Error signing in anonymously:", error.message);
      return res.status(400).json({ error: error.message });
    }

    if (data && data.session) {
      console.log("Anonymous user signed in:", data.session.user.id);

      // Send session and user info back to frontend
      return res.json({
        message: "Guest login successful",
        user: data.session.user,
        session: data.session,
      });
    }

    res.status(500).json({ error: "Failed to create anonymous session" });
  } catch (err) {
    console.error("Unexpected error in guest login:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Protected route (requires valid token)
app.get("/api/profile", verifyToken, (req, res) => {
  res.json({ message: "Welcome!", user: req.user });
});

// -------------------- Test Route --------------------
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// const PORT = 5000;
// app.listen(PORT, () =>
//   console.log(`Backend running on http://localhost:${PORT}`)
// );

//Status python scripts
// SSE helper
function streamPythonScript(res, scriptPath) {
  const py = spawn("python", [scriptPath]); // use "python3" if needed

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  py.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    lines.forEach((line) => {
      if (line.trim()) res.write(`data: ${line}\n\n`);
    });
  });

  py.stderr.on("data", (data) => {
    const lines = data.toString().split("\n");
    lines.forEach((line) => {
      if (line.trim()) res.write(`data: ERROR: ${line}\n\n`);
    });
  });

  py.on("close", (code) => {
    res.write(`data: SCRIPT_COMPLETED\n\n`);
    res.end();
  });
}

// SSE routes
app.get("/api/stream-searchweb", (req, res) => {
  streamPythonScript(res, "../backend/searchweb.py");
});

app.get("/api/stream-main", (req, res) => {
  streamPythonScript(res, "../backend/main.py");
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));
