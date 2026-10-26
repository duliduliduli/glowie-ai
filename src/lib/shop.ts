const q = encodeURIComponent;

/** Retailer search links for one outfit piece. Amazon gets the affiliate tag when configured. */
export function shopLinks(query: string) {
  const tag = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG;
  return [
    { name: "Amazon", url: `https://www.amazon.com/s?k=${q(query)}${tag ? `&tag=${q(tag)}` : ""}` },
    { name: "Nordstrom", url: `https://www.nordstrom.com/sr?keyword=${q(query)}` },
    { name: "Zara", url: `https://www.zara.com/us/en/search?searchTerm=${q(query)}` },
    { name: "Google", url: `https://www.google.com/search?tbm=shop&q=${q(query)}` },
  ];
}
