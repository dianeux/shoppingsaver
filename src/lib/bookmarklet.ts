import { CLIP_BRANDS } from "@/domain/clip";

/**
 * Runs inside the visitor's browser on a brand product page (never on our side).
 * Collects the page's product JSON-LD — compacted to one variant per color —,
 * og tags and page text, then opens /add with it in the URL fragment. Written as
 * plain self-contained JS because it's serialized with Function#toString.
 */
function clip(origin: string, hosts: string[]) {
  if (hosts.indexOf(location.hostname) < 0) {
    alert("ShoppingSaver：請在 Uniqlo、GU、Zara 或 H&M 美國官網的商品頁使用。");
    return;
  }
  const d = document;
  type J = Record<string, unknown>;
  const ld: string[] = [];
  d.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    let data: unknown;
    try {
      data = JSON.parse(s.textContent || "");
    } catch {
      return;
    }
    const keep: J[] = [];
    const visit = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object") {
        const o = v as J;
        const t = String(o["@type"]);
        if (/Product|Breadcrumb/.test(t)) keep.push(o);
        if (o["@graph"]) visit(o["@graph"]);
      }
    };
    visit(data);
    for (const o of keep) {
      // One variant per color (prefer an in-stock one): sizes don't change price here.
      if (Array.isArray(o.hasVariant)) {
        const byColor: Record<string, J> = {};
        for (const v of o.hasVariant as J[]) {
          const c = String(v.color || "");
          const offer = (Array.isArray(v.offers) ? v.offers[0] : v.offers) as J | undefined;
          const inStock = /InStock/.test(String(offer && offer.availability));
          if (!byColor[c] || inStock) byColor[c] = { color: v.color, image: v.image, offers: offer && { price: offer.price, availability: offer.availability } };
        }
        o.hasVariant = Object.keys(byColor).map((k) => byColor[k]);
      }
      delete o.review;
      delete o.description;
      ld.push(JSON.stringify(o));
    }
  });
  const meta: Record<string, string> = {};
  d.querySelectorAll('meta[property^="og:"],meta[name="description"]').forEach((m) => {
    meta[m.getAttribute("property") || m.getAttribute("name") || ""] = m.getAttribute("content") || "";
  });
  const copy = d.body.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("script,style,noscript,svg,iframe,template").forEach((e) => e.remove());
  const payload = {
    v: 1, url: location.href, title: d.title, ld, meta,
    text: (d.body.innerText || "").slice(0, 20000),
    hidden: (copy.textContent || "").replace(/\s+/g, " ").slice(0, 30000),
  };
  const url = `${origin}/add#${encodeURIComponent(JSON.stringify(payload))}`;
  // Runs on the brand's page, so this is a cross-site navigation, not an internal one.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (!window.open(url, "_blank")) location.href = url;
}

const HOSTS = Object.values(CLIP_BRANDS).flatMap((b) => b!.hosts);

/** The `javascript:` URL to drag to the bookmarks bar. */
export function bookmarkletHref(origin: string): string {
  return `javascript:${encodeURIComponent(`(${clip.toString()})(${JSON.stringify(origin)},${JSON.stringify(HOSTS)})`)}`;
}
