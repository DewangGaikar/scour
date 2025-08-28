import json
import re
import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
import os

#Output File
groups_file="groups.json"
if os.path.exists(groups_file) :
    with open("groups.json","r") as f:
        try:
            groups_config=json.load(f)
        except json.JSONDecodeError:
            groups_config=[]
else:
    groups_config=[]

    

#keywords to search
keywords=["telegram stock tips group","telegram sebi registered stock tips","telegram intraday tips","telegram real time stock signals","best telegram stock market groups"
]

#Regex for telegram invite links
telegram_regex= r"(https?://t\.me/[a-zA-Z0-9_]+)"

def fetch_search_results(query,max_results=10):
    #Search duckduckgo for query and return urls
    urls=[]
    with DDGS() as ddgs:
        for r in ddgs.text(query,max_results=max_results):
            urls.append(r["href"])
    return urls

def scrape_telegram_links(url):
    #Scrape webpage and extract telegram links
    links=[]
    try:
        resp=requests.get(url,timeout=10,headers={"User-Agent":"Mozilla/5.0"})
        if resp.status_code==200:
            soup=BeautifulSoup(resp.text,"html.parser")
            text=soup.get_text(" ",strip=True)
            found = re.findall(telegram_regex,text)
            links.extend(found)

            #also check anchor tages
            for a in soup.find_all("a",href=True):
                if "t.me" in a["href"]:
                    links.append(a["href"])
    except Exception as e:
        print(f"Error scraping {url}:{e}")
    return list(set(links))

def save_groups(data):
    #Save to JSON file
    try:
        with open(groups_file,"r") as f:
            existing = json.load(f)
    except FileNotFoundError:
        existing = []
    
    #Deduplicate by invite_link
    existing_links ={g["invite_link"] for g in existing}
    for entry in data:
        if entry["invite_link"] not in existing_links:
            existing.append(entry)
    
    with open(groups_file,"w") as f:
        json.dump(existing,f,indent=2)

def main():
    found_data =[]
    #Search using Keyword
    for keyword in keywords:
        print(f"\n Searching:{keyword}")
        urls = fetch_search_results(keyword,max_results=5)
        #Visit urls in collected urls
        for url in urls:
            tg_links = scrape_telegram_links(url)
            #Collect telegram links in urls
            for link in tg_links:
                #Add invite link in a array
                found_data.append({
                    "invite_link":link,
                    "source":url
                    })
                print(f"Found:{link} on {url}")
    #Add the array in json file and save
    save_groups(found_data)
    print("\n All groups saved to groups.json")

if __name__ =="__main__":
    main()