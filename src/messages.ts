export type ApiAction = "BID" | "CANCEL BID" | "UNLIST";

export function apiMessage(action: ApiAction, fields: Record<string, string | number>, issuedAt: string): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  return [`BITMAPWIN API ${action}`, ...lines, `issued: ${issuedAt}`].join("\n");
}

export const bidApiMessage = (height: number, priceSats: number, bidder: string, issuedAt: string) =>
  apiMessage("BID", { parcel: `${height}.bitmap`, amount: `${priceSats} sats`, bidder }, issuedAt);
export const cancelBidApiMessage = (bidId: string, address: string, issuedAt: string) =>
  apiMessage("CANCEL BID", { bid: bidId, address }, issuedAt);
export const unlistApiMessage = (offerId: string, address: string, issuedAt: string) =>
  apiMessage("UNLIST", { listing: offerId, address }, issuedAt);
