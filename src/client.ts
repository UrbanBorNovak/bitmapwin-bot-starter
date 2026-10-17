/**
 * BitmapWin trading API client — zero dependencies, works in browsers, Node, Bun and Deno.
 * It only talks HTTP and builds the exact messages to sign; signing stays in the caller's wallet.
 */
import { bidApiMessage, cancelBidApiMessage, unlistApiMessage } from "./messages";

export interface OrderbookResponse {
  best_ask: number | null;
  best_bid: number | null;
  spread: number | null;
  mid: number | null;
  last_price: number | null;
  volume_24h_sats: number;
  trades_24h: number;
  asks: { id: string; bitmap_height: number; price_sats: number; on_hold: boolean }[];
  bids: { id: string; bitmap_height: number; price_sats: number }[];
}

export interface Listing {
  id: string;
  bitmap_height: number;
  inscription_id: string;
  outpoint: string;
  price_sats: number;
  price_btc: number;
  seller_address: string;
  status: string;
  psbt_base64: string;
  reserved_until: string | null;
  on_hold: boolean;
  created_at: string;
}

export interface Trade {
  txid: string;
  bitmap_height: number;
  inscription_id: string;
  price_sats: number;
  seller_address: string | null;
  buyer_address: string | null;
  block_height: number | null;
  block_time: string | null;
  created_at: string;
  confirmed: boolean;
}

export interface Bid {
  id: string;
  bitmap_height: number;
  bidder_address: string;
  price_sats: number;
  expires_at: string | null;
  status: string;
  created_at: string;
}

export interface BlockMeta {
  height: number;
  hash: string;
  timestamp: number;
  size: number;
  weight: number;
  txCount: number;
}

export interface ListingQuery {
  height?: number;
  min_sats?: number;
  max_sats?: number;
  seller?: string;
  sort?: "price_asc" | "price_desc" | "recent";
  limit?: number;
  offset?: number;
}

export class BitmapWinApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message);
    this.name = "BitmapWinApiError";
  }
}

export interface BitmapWinClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Defaults to the current time; injectable for tests. */
  now?: () => Date;
}

function qs(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export class BitmapWinClient {
  readonly baseUrl: string;
  private readonly f: typeof fetch;
  private readonly now: () => Date;

  constructor(opts: BitmapWinClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? "https://bitmapwin.app").replace(/\/+$/, "");
    this.f = opts.fetch ?? ((...a) => globalThis.fetch(...a));
    this.now = opts.now ?? (() => new Date());
  }

  private async call<T>(path: string, body?: unknown): Promise<T> {
    const res = await this.f(`${this.baseUrl}/api/public${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
      body: body === undefined ? null : JSON.stringify(body),
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
      throw new BitmapWinApiError(msg, res.status, data);
    }
    return data as T;
  }

  /** ISO UTC timestamp to put in a signed message (valid 10 minutes, single use). */
  issuedAt(): string {
    return this.now().toISOString();
  }

  readonly market = {
    status: () => this.call<{ ok: boolean; endpoints: string[] }>("/market/status"),
    orderbook: (depth = 20) => this.call<OrderbookResponse>(`/market/orderbook${qs({ depth })}`),
    listings: (q: ListingQuery = {}) =>
      this.call<{ listings: Listing[]; limit: number; offset: number }>(`/market/listings${qs({ ...q })}`),
    trades: (q: { height?: number; limit?: number } = {}) => this.call<{ trades: Trade[] }>(`/market/trades${qs(q)}`),
    bids: (q: { height?: number; limit?: number } = {}) => this.call<{ bids: Bid[] }>(`/market/bids${qs(q)}`),

    /** List: a base64 PSBT already signed by the seller's wallet. */
    list: (psbtBase64: string) => this.call<Record<string, unknown>>("/market/listings", { psbt: psbtBase64 }),
    /** Unlist: sign `messages.unlist(...)` with the seller address (BIP-322). */
    cancelListing: (a: { offerId: string; issuedAt: string; signature: string }) =>
      this.call<{ ok: true; offerId: string }>("/market/listings/cancel", a),
    /** Places a 90s hold and returns the buyer PSBT to sign locally. */
    prepareBuy: (a: {
      offerId: string;
      buyerPaymentAddress: string;
      buyerOrdinalsAddress: string;
      tapInternalKeyHex?: string;
      paymentPublicKeyHex?: string;
    }) => this.call<Record<string, unknown>>("/market/buy/prepare", a),
    /** Broadcast the buyer-signed PSBT; refused if payout/delivery outputs were changed. */
    broadcastBuy: (a: { offerId: string; psbt: string; buyerAddress: string }) =>
      this.call<Record<string, unknown>>("/market/buy/broadcast", a),
    /** Bid: sign `messages.bid(...)` with the bidder address (BIP-322). */
    placeBid: (a: {
      bitmapHeight: number;
      bidderAddress: string;
      priceSats: number;
      expiresInHours?: number;
      issuedAt: string;
      signature: string;
    }) => this.call<Record<string, unknown>>("/market/bids", a),
    cancelBid: (a: { bidId: string; address: string; issuedAt: string; signature: string }) =>
      this.call<Record<string, unknown>>("/market/bids/cancel", a),
  };

  readonly blocks = {
    /** One byte per transaction (parcel size class, small integers starting at 1). Empty when the block is unknown/unavailable. */
    bytes: async (height: number): Promise<{ bytes: Uint8Array; txCount: number; hash: string | null }> => {
      const res = await this.f(`${this.baseUrl}/api/public/blocks/${height}`);
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        throw new BitmapWinApiError((data as { error?: string } | null)?.error ?? `HTTP ${res.status}`, res.status, data);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      return { bytes, txCount: Number(res.headers.get("x-tx-count") ?? bytes.length), hash: res.headers.get("x-block-hash") };
    },
    meta: (height: number) => this.call<BlockMeta>(`/blocks/${height}/meta`),
  };

  /** Exact messages the server verifies — sign these byte-for-byte. */
  readonly messages = {
    bid: (height: number, priceSats: number, bidder: string, issuedAt: string) =>
      bidApiMessage(height, priceSats, bidder, issuedAt),
    cancelBid: (bidId: string, address: string, issuedAt: string) => cancelBidApiMessage(bidId, address, issuedAt),
    unlist: (offerId: string, seller: string, issuedAt: string) => unlistApiMessage(offerId, seller, issuedAt),
  };
}
