from telethon import TelegramClient
from telethon.tl.functions.messages import ImportChatInviteRequest
from telethon.tl.functions.channels import JoinChannelRequest,LeaveChannelRequest
from telethon.errors import UserAlreadyParticipantError,FloodWaitError
import asyncio
from dotenv import load_dotenv
import os
import re
import uvicorn
from fastapi import FastAPI, Query
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
from fastapi import BackgroundTasks
from pydantic import BaseModel
from datetime import datetime, timezone

import pytz


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

# Keywords & patterns
keywords = ["buy", "sell", "target", "stock", "intraday", "call", "tip"]
stock_tip_pattern = re.compile(r"(buy|sell)\s+[A-Za-z]+\s+at\s+\d+", re.IGNORECASE)

# ------------------ FastAPI ------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.path.exists("session_name.session"):
        await client.start()  # uses saved session
    else:
        await client.start(phone=phone_number)  # first-time login, interactive
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

@app.post("/check-single-link")
async def check_single_link(data: SingleLink):
    result = await scan_group(data.invite_link)

    if result is None:
        return {"error": "Invalid or unreachable group link."}

    return {
        "group_name": result.get("channel_name"),
        "flagged": result.get("flagged"),
        "flagged_messages": result.get("flagged_messages"),
        "channel_link": result.get("channel_link"),
    }
@app.get("/joined-groups-count")
async def trigger_joined_groups_count():
    count = await get_joined_groups_count()
    return {"joined_groups_count": count}


@app.post("/scan-internet")
async def trigger_scan_internet(background_tasks: BackgroundTasks):
    # Trigger scanning of new Telegram groups in the background
    background_tasks.add_task(scan_new_groups)  # define scan_new_groups separately
    return {"status": "Scanning started"}

@app.post("/scan-groups")
async def trigger_scan_existing_groups(background_tasks: BackgroundTasks):
    # Trigger scanning messages of existing groups
    background_tasks.add_task(scan_existing_groups)  # define scan_existing_groups separately
    return {"status": "Group scanning started"}

@app.post("/list-groups")
async def trigger_list_groups(background_tasks: BackgroundTasks):
    # Trigger scanning messages of existing groups
    background_tasks.add_task(list_groups)  # define scan_existing_groups separately
    return {"status": "Group Listing started"}

async def trigger_scan_new_groups():
    # Example: get keywords, fetch links, save to supabase
    # This is basically your searchweb.py logic
    keywords = ["telegram stock tips group", "best telegram stock groups"]
    for keyword in keywords:
        urls = fetch_search_results(keyword)
        for url in urls:
            links = scrape_telegram_links(url)
            for link in links:
                save_to_db(link, url)

async def trigger_scan_existing_groups():
    # Example: fetch found_links from supabase and scan them
    groups = supabase.table("found_links").select("invite_link").execute()
    for group in groups.data:
        await scan_group(group["invite_link"])
        await asyncio.sleep(1)

# ------------------ Utility: Count Joined Groups ------------------
async def get_joined_groups_count():
    """
    Returns the number of groups/channels the client has joined.
    """
    count = 0
    dialogs = await client.get_dialogs()

    for dialog in dialogs:
        entity = dialog.entity
        # Check for group types
        if getattr(entity, "megagroup", False) or getattr(entity, "broadcast", False):
            count += 1
        elif entity.__class__.__name__ in ["Chat", "Channel"]:
            count += 1

    return count-1

async def list_groups():
    dialogs = await client.get_dialogs()
    groups = []
    for dialog in dialogs:
        entity = dialog.entity
        if getattr(entity, "megagroup", False) or getattr(entity, "broadcast", False):
            groups.append({
                "id": entity.id,
                "title": getattr(entity, "title", None),
                "username": getattr(entity, "username", None)
            })
    return groups


# ------------------ Core Logic ------------------
async def scan_group(invite_link: str):
    entity = None
    try:
        # ---- Join / get entity logic ----
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
        # Return cooldown info for React frontend
        wait_seconds = e.seconds
        print(f"FloodWaitError! Need to wait {wait_seconds} seconds before retrying.")
        return {"cooldown": wait_seconds, "invite_link": invite_link}

    except Exception as e:
        print(f"Skipping {invite_link} due to error: {e}")
        # Mark permanently invalid links
        supabase.table("found_links").update({"valid_link": False}).eq("invite_link", invite_link).execute()
        return None

    if not entity:
        # Mark invalid if entity couldn't be fetched
        supabase.table("found_links").update({"valid_link": False}).eq("invite_link", invite_link).execute()
        return None

    # ---- Fetch last 100 messages ----
    try:
        messages = [msg.text for msg in await client.get_messages(entity, limit=100) if msg.text]
    except FloodWaitError as e:
        wait_seconds = e.seconds
        print(f"FloodWaitError while fetching messages! Wait {wait_seconds} seconds.")
        return {"cooldown": wait_seconds, "invite_link": invite_link}

    # ---- Flag messages ----
    flagged_messages = [
        msg for msg in messages
        if any(kw.lower() in msg.lower() for kw in keywords) or stock_tip_pattern.search(msg)
    ]
    flagged = len(flagged_messages) > 0

    # ---- Update groups table ----
    group_record = supabase.table("groups").select("group_id").eq("invite_link", invite_link).execute()
    if group_record.data:
        group_id = group_record.data[0]["group_id"]
        supabase.table("groups").update({
            "group_name": getattr(entity, "title", str(entity.id)),
            "member_count": getattr(entity, "participants_count", None),
            "flagged": flagged,
            "last_scanned_at": datetime.now(timezone.utc).isoformat() ,
        }).eq("group_id", group_id).execute()
    else:
        inserted = supabase.table("groups").insert({
            "invite_link": invite_link,
            "group_name": getattr(entity, "title", str(entity.id)),
            "member_count": getattr(entity, "participants_count", None),
            "flagged": flagged,
            "last_scanned_at": datetime.now(timezone.utc).isoformat() ,
        }).execute()
        group_id = inserted.data[0]["group_id"]

    # ---- Update group_messages table ----
    for msg in flagged_messages:
        reason = "stock_tip_pattern" if stock_tip_pattern.search(msg) else "keyword_match"
        existing = supabase.table("group_messages")\
            .select("message_id")\
            .eq("group_id", group_id)\
            .eq("message_text", msg)\
            .eq("flagged_reason", reason)\
            .execute()
        if not existing.data:
            supabase.table("group_messages").insert({
                "group_id": group_id,
                "message_text": msg,
                "flagged_reason": reason,
            }).execute()

    

    # ---- Return result for frontend ----
    return {
        "channel_name": getattr(entity, "title", str(entity.id)),
        "channel_link": invite_link,
        "flagged": flagged,
        "flagged_messages": flagged_messages,
    }

# async def scan_group(invite_link: str):
#     entity = None
#     try:
#         if "+" in invite_link:
#             hash_part = invite_link.split("+")[1]
#             try:
#                 await client(ImportChatInviteRequest(hash_part))
#                 entity = await client.get_entity(invite_link)
#             except UserAlreadyParticipantError:
#                 entity = await client.get_entity(invite_link)
#         elif "/joinchat/" in invite_link:
#             username = invite_link.split("/joinchat/")[1]
#             try:
#                 await client(ImportChatInviteRequest(username))
#                 entity = await client.get_entity(invite_link)
#             except UserAlreadyParticipantError:
#                 entity = await client.get_entity(username)
#         elif "/c/" in invite_link:
#             parts = invite_link.split("/")
#             chat_id = int("-100" + parts[-2])
#             entity = await client.get_entity(chat_id)
#         elif "/" in invite_link:
#             username = invite_link.split("/")[-1]
#             try:
#                 await client(JoinChannelRequest(username))
#                 entity = await client.get_entity(username)
#             except UserAlreadyParticipantError:
#                 entity = await client.get_entity(username)
#     except Exception as e:
#         print(f"Skipping {invite_link} due to error: {e}")

#     if not entity:
#         return None

#     # Fetch last 100 messages
#     messages = [msg.text for msg in await client.get_messages(entity, limit=100) if msg.text]
    
#     flagged_messages = [
#         msg for msg in messages
#         if any(kw.lower() in msg.lower() for kw in keywords) or stock_tip_pattern.search(msg)
#     ]
#     flagged = len(flagged_messages) > 0

#     # Update Supabase tables
#     group_record = supabase.table("groups").select("group_id").eq("invite_link", invite_link).execute()
#     if group_record.data:
#         group_id = group_record.data[0]["group_id"]
#         supabase.table("groups").update({
#             "group_name": getattr(entity, "title", str(entity.id)),
#             "member_count": getattr(entity, "participants_count", None),
#             "flagged": flagged,
#         }).eq("group_id", group_id).execute()
#     else:
#         inserted = supabase.table("groups").insert({
#             "invite_link": invite_link,
#             "group_name": getattr(entity, "title", str(entity.id)),
#             "member_count": getattr(entity, "participants_count", None),
#             "flagged": flagged,
#         }).execute()
#         group_id = inserted.data[0]["group_id"]
        
#     for msg in flagged_messages:
#         reason = "stock_tip_pattern" if stock_tip_pattern.search(msg) else "keyword_match"
#         # Check if this exact message already exists
#         existing = supabase.table("group_messages")\
#         .select("message_id")\
#         .eq("group_id", group_id)\
#         .eq("message_text", msg)\
#         .eq("flagged_reason", reason)\
#         .execute()
#         if not existing.data:  # Only insert if not exists
#             supabase.table("group_messages").insert({
#             "group_id": group_id,
#             "message_text": msg,
#             "flagged_reason": reason,
#         }).execute()

#     return {
#         "channel_name": getattr(entity, "title", str(entity.id)),
#         "channel_link": invite_link,
#         "flagged": flagged,
#         "flagged_messages": flagged_messages,
#     }

# # ------------------ API Route ------------------
# @app.get("/get-messages")
# async def get_messages(limit: int = Query(5, ge=1, le=100)):
#     results = []
#     groups = supabase.table("found_links").select("invite_link").execute()
#     for i, group in enumerate(groups.data):
#         if i >= limit:
#             break
#         result = await scan_group(group["invite_link"])
#         if result:
#             results.append(result)
#         await asyncio.sleep(2)  # small delay to avoid hitting Telegram too fast
#     return results

# ------------------ API Route ------------------
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

            if result.get("invalid"):
                print(f"Marking {invite_link} as invalid.")
                supabase.table("found_links").update({"valid_link": False}).eq("invite_link", invite_link).execute()
                continue

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


# @app.get("/get-messages")
# async def get_messages(limit: int = Query(5, ge=1, le=100)):
#     results = []
#     today = datetime.now(pytz.UTC).date()

#     # Step 1: Fetch all groups
#     groups = supabase.table("found_links") \
#         .select("found_id, invite_link, last_scanned_at") \
#         .execute()

#     groups_data = groups.data or []

#     # Step 2: Prioritize groups
#     never_scanned = [g for g in groups_data if not g.get("last_scanned_at")]
#     not_scanned_today = [
#         g for g in groups_data
#         if g.get("last_scanned_at") and datetime.fromisoformat(g["last_scanned_at"]).date() < today
#     ]

#     if never_scanned:
#         groups_to_scan = never_scanned
#     elif not_scanned_today:
#         groups_to_scan = not_scanned_today
#     else:
#         # fallback: all groups already scanned today → scan sequentially
#         groups_to_scan = groups_data

#     # Step 3: Scan up to the limit
#     for i, group in enumerate(groups_to_scan):
#         if i >= limit:
#             break

#         result = await scan_group(group["invite_link"])
#         if result:
#             results.append(result)

#             # Step 4: Update last_scanned_at timestamp
#             supabase.table("found_links").update({
#                 "last_scanned_at": datetime.now(pytz.UTC).isoformat()
#             }).eq("found_id", group["found_id"]).execute()

#         await asyncio.sleep(2)  # small delay for Telegram API

#     return results

# ------------------ Utility: Leave Groups ------------------
# List of group names/usernames/IDs you want to skip
SKIP_GROUPS = [
    -2300365028           
]

@app.post("/leave-all-groups")
async def leave_all_groups():
    # await ensure_client()
    dialogs = await client.get_dialogs()

    left = []
    skipped = []

    for dialog in dialogs:
        entity = dialog.entity

        # Some entities may not have an ID (skip them safely)
        if not hasattr(entity, "id"):
            continue  

        if entity.id in SKIP_GROUPS:
            skipped.append({"id": entity.id, "title": getattr(entity, "title", "Unknown")})
            continue

        try:
            await client(LeaveChannelRequest(entity))
            left.append({"id": entity.id, "title": getattr(entity, "title", "Unknown")})
        except Exception as e:
            left.append({
                "id": entity.id,
                "title": getattr(entity, "title", "Unknown"),
                "error": str(e)
            })

    return {"left": left, "skipped": skipped}


# ------------------ Run Server ------------------
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
