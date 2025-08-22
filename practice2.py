from telethon import TelegramClient
from telethon.tl.functions.messages import ImportChatInviteRequest # for joining using telegram Invite link
from telethon.errors import UserAlreadyParticipantError
import asyncio # for async operations
from dotenv import load_dotenv # For loading env variables
import os # Env File access
import re # For regular Expression

load_dotenv()
api_id=os.getenv("API_ID")
api_hash=os.getenv("API_HASH")
group_username=""
phone_number =os.getenv("PHONE_NUMBER")
invite_link="https://t.me/+YmHTkoZHl91hMGNl"
# for Analyzing msgs , regex
keywords=["buy","sell","target","stock","intraday","call","tip"]
stock_tip_pattern =re.compile(r"(buy|sell)\s+[A-za-z]+\s+at\s+\d+",re.IGNORECASE)

client = TelegramClient('session_name',api_id,api_hash)
# goal is to join group and flag messages and tell group name if illegal
async def main():
    # Connect and Sign-in 
    await client.start(phone=phone_number)
    if group_username:
         entity = await client.get_entiy(group_username)
    elif invite_link:
         hash_part=invite_link.split("+")[1]
         try:
            entity=await client(ImportChatInviteRequest(hash_part))
         except UserAlreadyParticipantError:
              entity = await client.get_entity(invite_link)
    else:
         print("X Provide a username or invite link")
         return

    #entity = await client.get_entity("t.me/+YmHTkoZHl91hMGNl")
    print("\n--- First 100 messages from Invite-Only Channel ---")
    messages=[]
    async for message in client.iter_messages(entity,limit=100):
            if message.text:
                 messages.append(message.text)

    #scan messages and mark them
    flagged_messages = []
    flagged=False
    for msg in messages:
         if any(kw.lower() in msg.lower() for kw in keywords) or stock_tip_pattern.search(msg):
              flagged = True
              flagged_messages.append(msg)

    result={
         "channel_name":entity.title if hasattr(entity,"title") else str(entity.id),
         "channel_link":group_username if group_username else invite_link,
         "flagged":flagged,
         "flagged_messages":flagged_messages
    }
    print(result)

if __name__ == "__main__":
     asyncio.run(main())

