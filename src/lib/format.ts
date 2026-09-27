/** Brand CDNs resize on the fly; ask Shopify for the width we display. */
export function thumb(url: string | null, width = 600) {
  if (!url) return null;
  if (url.includes("cdn.shopify.com")) return `${url}${url.includes("?") ? "&" : "?"}width=${width}`;
  return url;
}

export const usd = (n: number) => `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
