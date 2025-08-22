from telethon import TelegramClient
from telethon.tl.functions.messages import ImportChatInviteRequest
import asyncio
from dotenv import load_dotenv
import os

load_dotenv()
api_id=os.getenv("API_ID")
api_hash=os.getenv("API_HASH")
phone_number =os.getenv("PHONE_NUMBER")

client = TelegramClient('session_name',api_id,api_hash)

async def main():
    # Connect and Sign-in 
    await client.start(phone=phone_number)

    #Public Channel username (without @)
    #BANKNIFTY NIFTY INTRADAY STOCK OPTIONS
    # channel_username="Bloomberg"
    # public_channel = await client.get_entity(channel_username)

    # print("\n--- First 100 Messages from Public Channel---")
    # async for message in client.iter_messages(public_channel,limit=100):
    #     if message.text:
    #         print(message.id,":",message.text)

    # using invite link
    # invite_link="https://t.me/+YmHTkoZHl91hMGNl"
    # hash_part=invite_link.split("+")[1]
    # private_channel=await client(ImportChatInviteRequest(hash_part))
    entity = await client.get_entity("t.me/+YmHTkoZHl91hMGNl")

    print("\n--- First 100 messages from Invite-Only Channel ---")

    async for message in client.iter_messages(entity,limit=100):
            if message.text:
                 print(message.id,":",message.text)

with client:
    client.loop.run_until_complete(main())

