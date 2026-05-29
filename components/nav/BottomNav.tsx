"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, CalendarDays, Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/notes", label: "Notes", icon: BookOpen },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/giving", label: "Giving", icon: Heart },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScrollY.current && y > 60) {
        setHidden(true);
      } else if (y < lastScrollY.current) {
        setHidden(false);
      }
      lastScrollY.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 flex h-16 items-stretch border-t border-ink-300 bg-ink-100 will-change-transform transition-transform duration-300 ease-in-out ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-lg">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center justify-center gap-1 transition-colors"
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.75}
                className={isActive ? "text-brand-600" : "text-ink-600"}
              />
              <span
                className={`text-[10px] font-medium leading-none tracking-wide ${
                  isActive ? "text-brand-600" : "text-ink-600"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
