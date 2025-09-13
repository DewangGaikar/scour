# 🚀 Scour - Smart Content Observer for Unregulated Reach

- Telegram Group Scraper & Analyzer

This application is designed to automatically discover and analyze Telegram groups that share stock market tips, investment advice, and trading signals. It uses web scraping, advanced keyword and pattern matching, and the Telethon library to detect and join groups, scan messages, and flag suspicious content related to financial advice. The flagged data is stored in a Supabase database, enabling users to analyze potential scams, pump-and-dump schemes, and unregulated financial tips. In the future, this project can evolve into a comprehensive platform offering real-time alerts, detailed analytics, and integration with regulatory bodies (like SEBI) to help protect retail investors and enhance market transparency.

## ✅ Features

- Automatically scrape web pages for Telegram stock tips
- Automatially joins telegram channels using invite links and group id
- Scan Telegram groups for flagged messages
- Manage and list joined Telegram groups
- Save data in Supabase for later analysis

## ⚡ Project Structure

```
frontend/
├── backend/     # FastAPI backend (main logic, secrets, Telegram Client)
├── server/      # API server frontend (server-side logic)
└── scour/       # Web UI (npm + Vite)
```

## 🚀 How To Run Locally (For Testing)

### 1️⃣ Clone the Repo

```bash
git clone https://github.com/yourusername/scour.git
cd scour/frontend
```

### 2️⃣ Setup Environment Variables

Create `.env` files inside each folder with these variables:

#### Backend (`backend/.env`)

```
API_ID=YOUR_API_ID
API_HASH=YOUR_API_HASH
PHONE_NUMBER=YOUR_PHONE_NUMBER
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### Scour (`scour/.env`)

```
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
```

#### Server (`server/.env`)

```
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> ⚠️ **Important Note:**  
> These `.env` files contain sensitive keys and are not included in the repository.  
> Make sure you set your own values before running.

### 3️⃣ Install Dependencies

#### Backend

```bash
cd backend
pip install -r requirements.txt
```

#### Scour

```bash
cd ../scour
npm install
```

#### Server

```bash
cd ../server
npm install
```

### 4️⃣ Run Each Service

#### Start Backend API

```bash
cd ../backend
python mainNoNLP.py
```

#### Start Web Scour Interface

```bash
cd ../scour
npm run dev
```

#### Start Server

```bash
cd ../server
npm start
```

## 🚧 Why Secrets Are Not Included

For security reasons, sensitive API keys and secrets (like `API_ID`, `SUPABASE_SERVICE_ROLE_KEY`) are not stored in the repository.  
Testers must use their own `.env` files to run the app.

## ✅ Recommended `.env.example`

You can copy this template into `.env.example` in each folder.

#### Backend - `.env.example`

```
API_ID=your_api_id_here
API_HASH=your_api_hash_here
PHONE_NUMBER=your_phone_number_here
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

#### Scour - `.env.example`

```
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_publishable_key_here
```

#### Server - `.env.example`

```
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## ✅ License

Copyright (c) 2025 Dewang Gaikar

All rights reserved.

This software and its source code are the intellectual property of Dewang Gaikar.  
You are NOT allowed to use,copy, modify, distribute, or sell this code for personal or commercial use without explicit written permission from the author.

For permission requests, please contact:  
📧 dewanggaikar@gmail.com
