const q = encodeURIComponent;

/**
 * Retailer search links for one outfit piece at a price cap.
 * Amazon and Google get real price filters; Amazon gets the affiliate tag when configured.
 */
export function shopLinks(query: string, maxUsd?: number) {
  const tag = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG;
  const words = maxUsd ? (maxUsd <= 40 ? `affordable ${query}` : maxUsd >= 250 ? `designer ${query}` : query) : query;
  return [
    { name: "Amazon", url: `https://www.amazon.com/s?k=${q(words)}${maxUsd ? `&rh=p_36%3A-${maxUsd * 100}` : ""}${tag ? `&tag=${q(tag)}` : ""}` },
    { name: "Nordstrom", url: `https://www.nordstrom.com/sr?keyword=${q(words)}` },
    { name: "Zara", url: `https://www.zara.com/us/en/search?searchTerm=${q(query)}` },
    { name: "Google", url: `https://www.google.com/search?tbm=shop&q=${q(words)}${maxUsd ? `&tbs=mr:1,price:1,ppr_max:${maxUsd}` : ""}` },
  ];
}

/** Splits an outfit budget across pieces by their share, rounded to a sensible price. */
export function pieceBudget(totalUsd: number, share: number, shares: number[]) {
  const sum = shares.reduce((a, b) => a + b, 0) || 1;
  return Math.max(10, Math.round(((totalUsd * share) / sum) / 5) * 5);
}
