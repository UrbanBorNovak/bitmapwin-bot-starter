"""BitmapWin floor + sales scanner (read-only). Run: pip install requests && python3 bot.py"""
import os, time, requests

BASE = os.environ.get("BITMAPWIN_BASE", "https://bitmapwin.app") + "/api/public"
MAX_SATS = int(os.environ.get("MAX_BUY_SATS", "45000"))
DELAY = max(1.0, float(os.environ.get("POLL_INTERVAL_MS", "8000")) / 1000)
s = requests.Session()

def get(path, **params):
    r = s.get(BASE + path, params=params, timeout=15)
    if r.status_code == 429:
        raise RuntimeError("rate limited")
    r.raise_for_status()
    return r.json()

while True:
    try:
        book = get("/market/orderbook", depth=5)
        asks = [a for a in book["asks"] if not a["on_hold"]]
        trades = get("/market/trades", limit=1)["trades"]
        now = time.strftime("%X")
        if asks:
            f = asks[0]
            print(f"[{now}] floor {f['bitmap_height']}.bitmap @ {f['price_sats']:,} sats")
            if f["price_sats"] <= MAX_SATS:
                print(f"  TARGET: offer {f['id']}")
        else:
            print(f"[{now}] no open asks")
        if trades:
            t = trades[0]
            print(f"  last sale {t['bitmap_height']}.bitmap {t['price_sats']:,} sats tx {t['txid'][:12]}…")
    except Exception as e:
        print("error:", e)
    time.sleep(DELAY)
