import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "./middleware/verifyToken.js";

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

// Guest login
app.post("/api/guest", async (req, res) => {
  const { data, error } = await supabase.auth.signUp({
    email: `guest_${Date.now()}@example.com`,
    password: Math.random().toString(36).slice(-12),
  });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ guest: true, ...data });
});

// Protected route (requires valid token)
app.get("/api/profile", verifyToken, (req, res) => {
  res.json({ message: "Welcome!", user: req.user });
});

const PORT = 5000;
app.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT}`)
);
