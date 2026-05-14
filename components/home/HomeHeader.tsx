"use client";

import Image from "next/image";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning from";
  if (hour < 17) return "Good afternoon from";
  return "Good evening from";
}

export function HomeHeader() {
  return (
    <div className="flex items-center gap-3 px-4 pb-3 pt-5">
      <Image
        src="/images/app-icon.png"
        alt="Spirit Church"
        width={44}
        height={44}
        className="rounded-full"
        priority
      />
      <div className="flex flex-col">
        <span className="text-xs leading-tight text-ink-600">
          {getGreeting()}
        </span>
        <span className="text-[17px] font-bold leading-tight tracking-tight text-ink-900">
          Spirit Church
        </span>
      </div>
    </div>
  );
}
