/**
 * BitmapWin floor monitor — read-only by default. Nothing is signed or broadcast
 * unless you wire your own signer in (see src/signer.ts).
 * Run: npx tsx src/bot.ts
 */
import { BitmapWinClient, BitmapWinApiError } from "./client";

const client = new BitmapWinClient({ baseUrl: process.env.BITMAPWIN_BASE ?? "https://bitmapwin.app" });
const MAX_SATS = Number(process.env.MAX_BUY_SATS ?? 45_000);
const POLL_MS = Math.max(1_000, Number(process.env.POLL_INTERVAL_MS ?? 6_000)); // stay under 120 reads/min

async function tick() {
  try {
    const book = await client.market.orderbook(5);
    const floor = book.asks.find((a) => !a.on_hold);
    if (!floor) return console.log(`[${new Date().toISOString()}] no open asks`);
    const bestBid = book.bids[0]?.price_sats ?? 0;
    console.log(
      `[${new Date().toISOString()}] floor ${floor.bitmap_height}.bitmap @ ${floor.price_sats.toLocaleString()} sats` +
        ` | best bid ${bestBid.toLocaleString()} sats`,
    );
    if (floor.price_sats <= MAX_SATS) {
      console.log(`  TARGET: offer ${floor.id} is at or under ${MAX_SATS.toLocaleString()} sats`);
      // To buy: client.market.prepareBuy({ offerId: floor.id, buyerPaymentAddress, buyerOrdinalsAddress })
      // → sign the returned PSBT in YOUR wallet → client.market.broadcastBuy(...). Real bitcoin is spent.
    }
  } catch (e) {
    if (e instanceof BitmapWinApiError && e.status === 429) console.warn("rate limited — backing off");
    else console.error("tick failed:", (e as Error).message);
  }
}

tick();
setInterval(tick, POLL_MS);
