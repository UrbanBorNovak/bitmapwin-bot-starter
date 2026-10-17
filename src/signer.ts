/**
 * Signed actions (bid, cancel bid, unlist) need a BIP-322 signature over the
 * EXACT message from client.messages.*. Messages are single-use and expire after
 * 10 minutes. Sign with your own wallet or a BIP-322 library (e.g. `bip322-js`);
 * keys never go to BitmapWin.
 */
import { BitmapWinClient } from "./client";

/** Any function that returns a base64 BIP-322 signature of `message` for `address`. */
export type Bip322Signer = (address: string, message: string) => Promise<string>;

export async function placeBid(client: BitmapWinClient, sign: Bip322Signer, height: number, priceSats: number, bidder: string) {
  const issuedAt = client.issuedAt();
  const signature = await sign(bidder, client.messages.bid(height, priceSats, bidder, issuedAt));
  return client.market.placeBid({ bitmapHeight: height, bidderAddress: bidder, priceSats, issuedAt, signature });
}

export async function cancelBid(client: BitmapWinClient, sign: Bip322Signer, bidId: string, address: string) {
  const issuedAt = client.issuedAt();
  const signature = await sign(address, client.messages.cancelBid(bidId, address, issuedAt));
  return client.market.cancelBid({ bidId, address, issuedAt, signature });
}

export async function unlist(client: BitmapWinClient, sign: Bip322Signer, offerId: string, seller: string) {
  const issuedAt = client.issuedAt();
  const signature = await sign(seller, client.messages.unlist(offerId, seller, issuedAt));
  return client.market.cancelListing({ offerId, issuedAt, signature });
}

/* Example with bip322-js (npm i bip322-js) — use a throwaway key, never your main wallet:
import { Signer } from "bip322-js";
const sign: Bip322Signer = async (address, message) => Signer.sign(process.env.PRIVATE_KEY_WIF!, address, message) as string;
*/
