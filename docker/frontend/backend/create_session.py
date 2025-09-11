from telethon import TelegramClient
import os
from dotenv import load_dotenv

load_dotenv()

api_id = os.getenv("API_ID")
api_hash = os.getenv("API_HASH")
phone_number = os.getenv("PHONE_NUMBER")

session_file_path = "/app/data/myapp_session.session"
client = TelegramClient(session_file_path, api_id, api_hash)

async def main():
    await client.start(phone=phone_number)
    print("Session file created successfully!")

    # You can print session_file_path just to verify
    print(f"Session saved to {session_file_path}")

    await client.disconnect()

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
