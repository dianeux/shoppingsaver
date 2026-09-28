/** Ask each brand CDN for a card-sized image. */
export function thumb(url: string | null, width = 600) {
  if (!url) return null;
  if (url.includes("cdn.shopify.com")) return `${url}${url.includes("?") ? "&" : "?"}width=${width}`;
  // Pact publishes a fixed 660×800 "_thumb" next to each 990×1200 image.
  if (url.includes("static.wearpact.com") && !/_thumb\.\w+$/.test(url)) return url.replace(/(\.\w+)$/, "_thumb$1");
  // Quince's image CDN resizes via query params.
  if (url.includes("images.quince.com")) return `${url.split("?")[0]}?w=${width}&q=80&fm=webp`;
  return url;
}

export const usd = (n: number) => `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
