import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE } from "@/i18n/locales";

/**
 * Language routing. Pages live under app/[lang]; Chinese keeps the unprefixed
 * URLs, English is /en. Nothing here sets cookies, so cached pages stay cacheable;
 * the language switch sets the cookie in the browser.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/en" || pathname.startsWith("/en/")) return NextResponse.next();

  // /zh/… is the internal form of the default language: send visitors to the clean URL.
  if (pathname === "/zh" || pathname.startsWith("/zh/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (prefersEnglish(request)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? "/en" : `/en${pathname}`;
    return NextResponse.redirect(url, 307);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.rewrite(url);
}

/** An explicit choice wins; otherwise a browser whose first language is English (and not Chinese). */
function prefersEnglish(request: NextRequest): boolean {
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
  if (chosen) return chosen === "en";
  const first = request.headers.get("accept-language")?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("en");
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
