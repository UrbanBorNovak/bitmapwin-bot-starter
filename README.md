# BitmapWin Bot Starter

Zero-custody starter kit for trading Bitcoin BITMAPs with the [BitmapWin public API](https://bitmapwin.app/api).

- **Keys stay with you.** Listings are seller-signed PSBTs, buys are buyer-signed PSBTs, bids/cancels/unlists are BIP-322 signatures.
- **Replay-safe.** Signed messages carry an `issued` time, expire after 10 minutes and are accepted once.
- **Snipe-safe buys.** `buy/prepare` places a 90-second hold; `buy/broadcast` refuses PSBTs whose payout or delivery outputs were changed.

## Quickstart

```bash
npm install
cp .env.example .env
npm start            # TypeScript floor monitor (read-only)
python3 bot.py       # Python floor + sales scanner (read-only)
```

## Files

| File | What it does |
| --- | --- |
| `src/client.ts` | Typed, zero-dependency API client (same one the site ships) |
| `src/messages.ts` | Exact messages the server verifies — sign them byte-for-byte |
| `src/bot.ts` | Floor monitor that flags asks under `MAX_BUY_SATS` |
| `src/signer.ts` | Bid / cancel / unlist helpers for any BIP-322 signer |
| `bot.py` | Python read-only scanner |

## Endpoints (base `https://bitmapwin.app/api/public`)

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/market/status`, `/market/orderbook`, `/market/listings`, `/market/trades`, `/market/bids` | none |
| POST | `/market/listings` | seller-signed PSBT |
| POST | `/market/listings/cancel` | BIP-322 |
| POST | `/market/buy/prepare` → `/market/buy/broadcast` | buyer-signed PSBT |
| POST | `/market/bids`, `/market/bids/cancel` | BIP-322 |
| GET | `/blocks/{height}`, `/blocks/{height}/meta`, `/blocks/tx-counts?heights=` | none |

## Limits

120 reads/min per IP · 20 writes/min per IP · 10 writes/min per wallet · max 2 live checkout holds per buyer. Back off on HTTP 429. Minimum output is 546 sats.

## Safety

Buying spends real bitcoin. The examples never sign or broadcast on their own — you wire in your wallet deliberately. Use a throwaway key for signed actions and never commit `.env`.

MIT licensed.
