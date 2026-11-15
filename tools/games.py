#!/usr/bin/env python3
"""Builds server/games.json (top mobile games with App Store icons) at CI time."""
import json, sys, time, urllib.request, urllib.parse, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "server" / "games.json"
UA = {"user-agent": "Mozilla/5.0"}
CURATED = ["PUBG MOBILE", "Free Fire", "eFootball", "EA SPORTS FC Mobile", "Call of Duty: Mobile", "Minecraft", "Roblox",
           "Clash Royale", "Clash of Clans", "Brawl Stars", "Genshin Impact", "Honkai: Star Rail", "Fortnite", "Asphalt Legends",
           "Mobile Legends: Bang Bang", "Subway Surfers", "Among Us", "Pokémon GO", "Pokémon UNITE", "Clash of Clans",
           "Arena Breakout", "Delta Force", "Warzone Mobile", "Wuthering Waves", "Zenless Zone Zero", "Stumble Guys",
           "8 Ball Pool", "Ludo King", "Carrom Pool", "Candy Crush Saga", "Rise of Kingdoms", "Free Fire MAX", "Valorant Mobile",
           "Apex Legends", "Fall Guys", "Sonic Dash", "Geometry Dash", "Hill Climb Racing 2", "Real Racing 3", "CarX Street",
           "Dream League Soccer", "NBA 2K", "Mortal Kombat", "Tekken", "Dead by Daylight Mobile", "Resident Evil", "GTA San Andreas",
           "Stardew Valley", "Terraria", "Hay Day", "Royal Match", "Monopoly GO", "Squad Busters", "Honor of Kings"]

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        return json.load(r)

items, seen = [], set()
def add(i, name, icon):
    if not name or not icon or i in seen: return
    seen.add(i); items.append({"id": str(i), "name": name, "icon": icon})

for name in CURATED:
    try:
        j = get("https://itunes.apple.com/search?entity=software&limit=1&country=us&term=" + urllib.parse.quote(name))
        for a in j.get("results", []):
            if "6014" in a.get("genreIds", []):
                add(a["trackId"], a["trackName"], a.get("artworkUrl512") or a.get("artworkUrl100"))
        time.sleep(0.4)
    except Exception as ex:
        print("search", name, ex, file=sys.stderr)

for country in ("us", "sa"):
    for feed in ("topfreeapplications", "topgrossingapplications"):
        try:
            j = get(f"https://itunes.apple.com/{country}/rss/{feed}/limit=100/genre=6014/json")
            for e in j["feed"]["entry"]:
                icon = e["im:image"][-1]["label"]
                icon = icon.replace("/100x100bb.", "/512x512bb.").replace("/53x53bb.", "/512x512bb.")
                add(e["id"]["attributes"]["im:id"], e["im:name"]["label"], icon)
        except Exception as ex:
            print("rss", country, feed, ex, file=sys.stderr)

if len(items) < 10 and OUT.exists():
    print("catalog fetch failed; keeping existing", file=sys.stderr); sys.exit(0)
OUT.write_text(json.dumps(items, ensure_ascii=False))
print("games:", len(items))
