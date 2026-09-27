"use client";

import { useSyncExternalStore } from "react";

/**
 * Favorites live in this browser only (localStorage) — no account. Stored as
 * product ids ("everlane:2437"), newest first. Storage can be unavailable
 * (private mode, blocked site data); everything degrades to an empty list.
 */
const KEY = "shoppingsaver:favorites:v1";
const MAX = 500;
const EMPTY: readonly string[] = Object.freeze([]);

const listeners = new Set<() => void>();
let cache: readonly string[] | null = null;

function read(): readonly string[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(ids: readonly string[]) {
  cache = ids;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Storage full or blocked: keep the in-memory list for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Another tab changed the list.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useFavorites(): readonly string[] {
  // Server render and first client render see an empty list, so hearts don't mismatch on hydration.
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function toggleFavorite(id: string) {
  const ids = read();
  write(ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids].slice(0, MAX));
}

export function removeFavorites(remove: readonly string[]) {
  const drop = new Set(remove);
  write(read().filter((x) => !drop.has(x)));
}
