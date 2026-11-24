"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "トップ" },
  { href: "/pipeline", label: "パイプライン" },
  { href: "/next-actions", label: "ネクストアクション" },
  { href: "/settings", label: "設定" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="flex gap-1">
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" || path.startsWith("/accounts") : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded px-3 py-1.5 text-sm ${active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
