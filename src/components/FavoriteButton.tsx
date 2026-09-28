"use client";

import { toggleFavorite, useFavorites } from "@/lib/favorites";

export function FavoriteButton({ id, name, className = "" }: { id: string; name: string; className?: string }) {
  const on = useFavorites().includes(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        // The heart sits on the product link; don't navigate.
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(id);
      }}
      aria-pressed={on}
      aria-label={on ? `從最愛移除 ${name}` : `加入最愛 ${name}`}
      title={on ? "從最愛移除" : "加入最愛"}
      className={`grid place-items-center h-9 w-9 rounded-full bg-paper/90 backdrop-blur-sm border border-ink/10 shadow-[0_2px_8px_-4px_rgba(28,26,23,.5)] transition-transform hover:scale-105 active:scale-95 ${className}`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden className={on ? "text-madder" : "text-ink-soft"}>
        <path
          d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"
          fill={on ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
