from telethon import TelegramClient
from telethon.tl.functions.messages import ImportChatInviteRequest # for joining using telegram Invite link
from telethon.tl.functions.channels import JoinChannelRequest # for joining public channels
from telethon.errors import UserAlreadyParticipantError
import asyncio # for async operations
from dotenv import load_dotenv # For loading env variables
import os # Env File access
import re # For regular Expression
import uvicorn
from fastapi import FastAPI,Query
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware #To avoid Cross Origin Resource Sharing Errors
import json
from supabase import create_client,client

load_dotenv()
api_id=os.getenv("API_ID")
api_hash=os.getenv("API_HASH")
group_username=""
phone_number =os.getenv("PHONE_NUMBER")
url=os.getenv("SUPABASE_URL")
key=os.getenv("SUPABASE_SERVICE_ROLE_KEY")
pub_key=os.getenv("SUPABASE_ANON_KEY")
supabase = create_client(url,key)

#Load Json File for groups/Public Channels
with open("groups.json","r") as f:
     groups_config=json.load(f)

# invite_link="https://t.me/+YmHTkoZHl91hMGNl"
# for Analyzing msgs , regex
keywords=["buy","sell","target","stock","intraday","call","tip"]
stock_tip_pattern =re.compile(r"(buy|sell)\s+[A-za-z]+\s+at\s+\d+",re.IGNORECASE)
client = TelegramClient('session_name',api_id,api_hash)

@asynccontextmanager
async def lifespan(app:FastAPI):
     await client.start(phone=phone_number)
     yield
     await client.disconnect()

app=FastAPI(lifespan=lifespan)
app.add_middleware(
     CORSMiddleware,
     allow_origins=["http://localhost:5173","http://127.0.0.1:5173"],
     allow_methods=["GET"],
     allow_headers=["Content-Type"],
     allow_credentials=False,
)

# goal is to join group and flag messages and tell group name if illegal
async def scan_groups(invite_link:str):
     #Join group and scan messages
     entity=None

     try:
          if "+"  in invite_link :
               hash_part = invite_link.split("+")[1]
               try:
                    await client(ImportChatInviteRequest(hash_part))
                    entity = await client.get_entity(invite_link)
               except UserAlreadyParticipantError:
                    entity = await client.get_entity(invite_link)     
          elif  "/joinchat/" in invite_link:
               username=invite_link.split("/joinchat/")[1]
               try:
                    await client(ImportChatInviteRequest(username))
                    entity = await client.get_entity(invite_link)
               except UserAlreadyParticipantError:
                    try:
                         entity = await client.get_entity(username)
                    except:
                         entity = await client.get_entity(invite_link)
          elif "/c/" in invite_link:
               parts=invite_link.split("/")
               chat_id=int("-100" + parts[-2])
               entity= await client.get_entity(chat_id)

          elif "/" in invite_link:
               username = invite_link.split("/")[-1]
               try:
                    await client(JoinChannelRequest(username))
                    entity=await client.get_entity(username)
               except UserAlreadyParticipantError:
                    entity = await client.get_entity(username)
          # elif "@" in invite_link: 
          #      username=invite_link.strip("@")
          #      try:
          #           await client(JoinChannelRequest(username))
          #      except UserAlreadyParticipantError:
          #           entity = await.get_entity(username)
     
     except Exception as e:
          print(f"Skipping {invite_link} due to error {e}")

     if not entity:
          return None  
     
     messages=[]
     async for message in client.iter_messages(entity,limit=100):
          if message.text:
               messages.append(message.text)

     flagged_messages=[]
     flagged=False
     for msg in messages:
          if any(kw.lower() in msg.lower() for kw in keywords) or stock_tip_pattern.search(msg):
               flagged=True
               flagged_messages.append(msg)

     group_record=(
          supabase.table("groups")
          .select("group_id")
          .eq("invite_link",invite_link)
          .execute()
     )

     if group_record.data:
          group_id=group_record.data[0]["group_id"]
          supabase.table("groups").update(
               {
                    "group_name":entity.title if hasattr(entity,"title") else str(entity.id),
                    "member_count":getattr(entity,"participants_count",None),
                    "flagged":flagged,
               }
          ).eq("group_id",group_id).execute()

     else:
          inserted=supabase.table("groups").insert(
               {
                    "invite_link":invite_link,
                    "group_name":entity.title if hasattr(entity,"title") else str (entity.id),
                    "member_count":getattr(entity,"participants_count",None),
                    "flagged":flagged,
               }
          ).execute()
          group_id =inserted.data[0]["group_id"]

     for msg in flagged_messages:
          supabase.table("group_messages").insert(
               {
                    "group_id":group_id,
                    "message_text":msg,
                    "flagged_reason": "stock_tip_pattern" if stock_tip_pattern.search(msg) else "keyword_match",

               }
          ).execute()

     return{
          "channel_name": entity.title if hasattr(entity,"title") else str(entity.id),
          "channel_link": invite_link,
          "flagged": flagged,
          "flagged_messages": flagged_messages,
     }

@app.get("/get-messages")
async def get_messages(limit:int=Query(5,ge=1,le=50)):
    results=[]
    groups=supabase.table("found_links").select("invite_link").execute()
    for i,group in enumerate(groups.data):
         if i>=limit:
              break
         result = await scan_groups(group["invite_link"])
         if result:
              results.append(result)
         await asyncio.sleep(2)
    return results

if __name__ == "__main__":
     uvicorn.run(app,host="127.0.0.1",port=8000)

