"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, CalendarDays, Heart } from "lucide-react";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/notes", label: "Notes", icon: BookOpen },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "https://donate.overflow.co/spiritchurch/cash", label: "Giving", icon: Heart, external: true },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-stretch border-t border-ink-300 bg-ink-100 will-change-transform"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-lg">
        {tabs.map(({ href, label, icon: Icon, ...rest }) => {
          const isExternal = "external" in rest && rest.external;
          const isActive = !isExternal && (href === "/" ? pathname === "/" : pathname.startsWith(href));
          const sharedClass = "flex flex-1 flex-col items-center justify-center gap-1 transition-colors";
          const iconClass = isActive ? "text-brand-600" : "text-ink-600";
          const labelClass = `text-[10px] font-medium leading-none tracking-wide ${isActive ? "text-brand-600" : "text-ink-600"}`;
          const children = (
            <>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.75} className={iconClass} />
              <span className={labelClass}>{label}</span>
            </>
          );
          return isExternal ? (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={sharedClass}
            >
              {children}
            </a>
          ) : (
            <Link key={href} href={href} className={sharedClass}>
              {children}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
