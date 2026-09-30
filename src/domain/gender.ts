/**
 * The catalog is split into women's and men's sections. Women's pages keep the
 * original URLs (/, /g/tops…); men's live under /men.
 */
export const GENDERS = ["women", "men"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABEL: Record<Gender, string> = { women: "女裝", men: "男裝" };

export function isGender(v: string): v is Gender {
  return (GENDERS as readonly string[]).includes(v);
}

/** Site path within a section: genderPath("men", "/g/tops") → "/men/g/tops". */
export function genderPath(gender: Gender, path: string): string {
  if (gender === "women") return path;
  return path === "/" ? "/men" : `/men${path}`;
}

/** Section of a site path (for the header switch). */
export function genderOfPath(pathname: string): Gender {
  return pathname === "/men" || pathname.startsWith("/men/") ? "men" : "women";
}

/**
 * Product id. Women's ids predate the men's section and stay `${brand}:${sourceId}`
 * (favorites and price history reference them); a unisex item listed in both
 * sections gets a separate men's row.
 */
export function productId(brand: string, sourceId: string, gender: Gender): string {
  return gender === "women" ? `${brand}:${sourceId}` : `${brand}:men:${sourceId}`;
}

/** Page title within a section; men's pages say so ("男裝 Tops"), women's keep the plain title. */
export function sectionTitle(gender: Gender, title: string): string {
  return gender === "women" ? title : `${GENDER_LABEL[gender]} ${title}`;
}
