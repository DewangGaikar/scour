# main.py
from telethon import TelegramClient
from telethon.tl.functions.messages import ImportChatInviteRequest
from telethon.tl.functions.channels import JoinChannelRequest, LeaveChannelRequest
from telethon.errors import UserAlreadyParticipantError, FloodWaitError
import asyncio
from dotenv import load_dotenv
import os
import re
import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
import uvicorn
from fastapi import FastAPI, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from supabase import create_client
import pytz
import spacy
from textblob import TextBlob

# ------------------ Load Env ------------------
load_dotenv()

# ------------------ Supabase ------------------
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

# ------------------ Telegram ------------------
api_id = os.getenv("API_ID")
api_hash = os.getenv("API_HASH")
phone_number = os.getenv("PHONE_NUMBER")
client = TelegramClient("session_name", api_id, api_hash)

# ------------------ NLP ------------------
nlp = spacy.load("en_core_web_sm")  # Use small model, fast for Named Entities

# ------------------ Keywords & Patterns ------------------
telegram_keywords = [
    "buy", "sell", "target", "stock", "intraday", "call", "tip", "signal", 
    "profit", "loss", "broker", "registered", "SEBI", "investment", "trade", 
    "alerts", "trading", "equity", "nifty", "sensex", "shares"
]

internet_keywords = [
    "telegram stock tips group", "telegram sebi registered stock tips",
    "telegram intraday tips", "telegram real time stock signals", 
    "best telegram stock market groups", "telegram trading alerts", 
    "telegram investment tips", "telegram day trading signals"
]

# Improved regex for telegram invite links
telegram_regex = re.compile(
    r"(https?://t\.me/(joinchat/)?(\+?[a-zA-Z0-9_-]{5,})|https?://t\.me/c/\d+/[0-9]+)"
)

stock_tip_pattern = re.compile(r"(buy|sell)\s+[A-Za-z]+\s+at\s+\d+", re.IGNORECASE)

# ------------------ SearchWeb Integration ------------------
def fetch_search_results(query, max_results=10):
    urls = []
    with DDGS() as ddgs:
        for r in ddgs.text(query, max_results=max_results):
            urls.append(r["href"])
    return urls

def scrape_telegram_links(url):
    links = []
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            text = soup.get_text(" ", strip=True)
            links.extend(telegram_regex.findall(text))

            for a in soup.find_all("a", href=True):
                if "t.me" in a["href"]:
                    links.append(a["href"])
    except Exception as e:
        print(f"Error scraping {url}: {e}")
    return list(set(links))

def save_to_db(invite_link, source_url):
    source = supabase.table("external_sources").select("source_id").eq("url", source_url).execute()
    if source.data:
        source_id = source.data[0]["source_id"]
    else:
        inserted = supabase.table("external_sources").insert({
            "url": source_url,
            "domain": source_url.split("/")[2]
        }).execute()
        source_id = inserted.data[0]["source_id"]

    existing = supabase.table("found_links").select("found_id") \
        .eq("invite_link", invite_link).eq("source_id", source_id).execute()
    if not existing.data:
        supabase.table("found_links").insert({
            "source_id": source_id,
            "invite_link": invite_link,
            "confidence_score": 0.8
        }).execute()
        print(f"Saved {invite_link} (source:{source_url})")
    else:
        print(f"Skipped duplicate {invite_link} from {source_url}")

async def scan_new_groups():
    for keyword in internet_keywords:
        print(f"\nSearching: {keyword}")
        urls = fetch_search_results(keyword, max_results=5)
        for url in urls:
            tg_links = scrape_telegram_links(url)
            for link in tg_links:
                save_to_db(link, url)

# ------------------ FastAPI ------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.path.exists("session_name.session"):
        await client.start()
    else:
        await client.start(phone=phone_number)
    yield
    await client.disconnect()

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

class SingleLink(BaseModel):
    invite_link: str

# ------------------ Telegram Scanning Core ------------------
async def scan_group(invite_link: str):
    entity = None
    try:
        if "+" in invite_link:
            hash_part = invite_link.split("+")[1]
            try:
                await client(ImportChatInviteRequest(hash_part))
                entity = await client.get_entity(invite_link)
            except UserAlreadyParticipantError:
                entity = await client.get_entity(invite_link)
        elif "/joinchat/" in invite_link:
            username = invite_link.split("/joinchat/")[1]
            try:
                await client(ImportChatInviteRequest(username))
                entity = await client.get_entity(invite_link)
            except UserAlreadyParticipantError:
                entity = await client.get_entity(username)
        elif "/c/" in invite_link:
            parts = invite_link.split("/")
            chat_id = int("-100" + parts[-2])
            entity = await client.get_entity(chat_id)
        elif "/" in invite_link:
            username = invite_link.split("/")[-1]
            try:
                await client(JoinChannelRequest(username))
                entity = await client.get_entity(username)
            except UserAlreadyParticipantError:
                entity = await client.get_entity(username)
    except FloodWaitError as e:
        return {"cooldown": e.seconds, "invite_link": invite_link}
    except Exception as e:
        print(f"Skipping {invite_link} due to error: {e}")
        supabase.table("found_links").update({"valid_link": False}).eq("invite_link", invite_link).execute()
        return None

    if not entity:
        supabase.table("found_links").update({"valid_link": False}).eq("invite_link", invite_link).execute()
        return None

    messages = [msg.text for msg in await client.get_messages(entity, limit=100) if msg.text]

    # ------------------ Pre-NLP filtering ------------------
    flagged_messages = [
        msg for msg in messages
        if any(kw.lower() in msg.lower() for kw in telegram_keywords) or stock_tip_pattern.search(msg)
    ]
    flagged = len(flagged_messages) > 0

    # ------------------ NLP analysis ------------------
    nlp_results = []
    for msg in flagged_messages:
        doc = nlp(msg)
        entities = [(ent.text, ent.label_) for ent in doc.ents]
        sentiment = TextBlob(msg).sentiment.polarity
        nlp_results.append({
            "message": msg,
            "entities": entities,
            "sentiment": sentiment
        })

    # ------------------ Update Supabase ------------------
    group_record = supabase.table("groups").select("group_id").eq("invite_link", invite_link).execute()
    if group_record.data:
        group_id = group_record.data[0]["group_id"]
        supabase.table("groups").update({
            "group_name": getattr(entity, "title", str(entity.id)),
            "member_count": getattr(entity, "participants_count", None),
            "flagged": flagged,
            "last_scanned_at": datetime.now(timezone.utc).isoformat()
        }).eq("group_id", group_id).execute()
    else:
        inserted = supabase.table("groups").insert({
            "invite_link": invite_link,
            "group_name": getattr(entity, "title", str(entity.id)),
            "member_count": getattr(entity, "participants_count", None),
            "flagged": flagged,
            "last_scanned_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        group_id = inserted.data[0]["group_id"]

    for res in nlp_results:
        reason = "stock_tip_pattern" if stock_tip_pattern.search(res["message"]) else "keyword_match"
        existing = supabase.table("group_messages")\
            .select("message_id")\
            .eq("group_id", group_id)\
            .eq("message_text", res["message"])\
            .eq("flagged_reason", reason)\
            .execute()
        if not existing.data:
            supabase.table("group_messages").insert({
                "group_id": group_id,
                "message_text": res["message"],
                "flagged_reason": reason,
                "nlp_entities": str(res["entities"]),
                "sentiment_score": res["sentiment"]
            }).execute()

    return {
        "channel_name": getattr(entity, "title", str(entity.id)),
        "channel_link": invite_link,
        "flagged": flagged,
        "flagged_messages": flagged_messages,
        "nlp_results": nlp_results
    }

# ------------------ FastAPI Endpoints ------------------
@app.post("/check-single-link")
async def check_single_link(data: SingleLink):
    result = await scan_group(data.invite_link)
    if result is None:
        return {"error": "Invalid or unreachable group link."}
    return result

@app.post("/scan-internet")
async def trigger_scan_internet(background_tasks: BackgroundTasks):
    background_tasks.add_task(scan_new_groups)
    return {"status": "Scanning started"}

@app.get("/joined-groups-count")
async def trigger_joined_groups_count():
    dialogs = await client.get_dialogs()
    count = sum(1 for d in dialogs if getattr(d.entity, "megagroup", False) or getattr(d.entity, "broadcast", False))
    return {"joined_groups_count": count}

@app.post("/leave-all-groups")
async def leave_all_groups():
    SKIP_GROUPS = [-2300365028]
    dialogs = await client.get_dialogs()
    left, skipped = [], []
    for dialog in dialogs:
        entity = dialog.entity
        if entity.id in SKIP_GROUPS:
            skipped.append({"id": entity.id, "title": getattr(entity, "title", "Unknown")})
            continue
        try:
            await client(LeaveChannelRequest(entity))
            left.append({"id": entity.id, "title": getattr(entity, "title", "Unknown")})
        except Exception as e:
            left.append({"id": entity.id, "title": getattr(entity, "title", "Unknown"), "error": str(e)})
    return {"left": left, "skipped": skipped}

@app.get("/get-messages")
async def get_messages(limit: int = Query(5, ge=1, le=100)):
    results = []
    today = datetime.now(pytz.UTC).date()

    # Fetch only links that are marked valid
    groups = supabase.table("found_links") \
        .select("found_id, invite_link, last_scanned_at, valid_link") \
        .eq("valid_link", True) \
        .execute()

    groups_data = groups.data or []
    if not groups_data:
        print("No valid links found to scan.")
        return {"results": []}

    # Prioritize never scanned and not scanned today
    never_scanned = [g for g in groups_data if not g.get("last_scanned_at")]
    not_scanned_today = [
        g for g in groups_data 
        if g.get("last_scanned_at") and datetime.fromisoformat(g["last_scanned_at"]).date() < today
    ]

    if never_scanned:
        groups_to_scan = never_scanned
    elif not_scanned_today:
        groups_to_scan = not_scanned_today
    else:
        groups_to_scan = groups_data

    for i, group in enumerate(groups_to_scan):
        if i >= limit:
            break

        invite_link = group["invite_link"]
        print(f"Starting scan for {invite_link}")
        
        result = await scan_group(invite_link)

        if result:
            if "cooldown" in result:
                print(f"Flood detected. Cooldown: {result['cooldown']}s for {invite_link}")
                return {"cooldown": result["cooldown"], "invite_link": invite_link}

            results.append(result)
            print(f"Scanned {invite_link}, flagged={result['flagged']}")

            # Update last scanned timestamp
            supabase.table("found_links").update({
                "last_scanned_at": datetime.now(pytz.UTC).isoformat()
            }).eq("found_id", group["found_id"]).execute()
        else:
            print(f"Skipping {invite_link}, result is None.")

        await asyncio.sleep(2)  # small delay to avoid hitting Telegram too fast

    return {"results": results}


# ------------------ Run Server ------------------
# if __name__ == "__main__":
#     uvicorn.run(app, host="127.0.0.1", port=8000)

# For Deployment on render
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))

