import Image from "next/image";

interface EventCardProps {
  title: string;
  subtitle: string;
  category: string;
  date: string;
  imageSrc?: string;
  href?: string;
}

export function EventCard({
  title,
  subtitle,
  category,
  date,
  imageSrc = "/images/placeholder-image.png",
  href = "#",
}: EventCardProps) {
  return (
    <a
      href={href}
      className="flex w-48 flex-shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-ink-300 bg-white active:opacity-80"
    >
      {/* 4:3 image */}
      <div className="relative aspect-video w-full">
        <Image
          src={imageSrc}
          alt=""
          fill
          className="object-cover"
          sizes="192px"
        />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1 p-3">
        <p className="text-[13px] font-semibold leading-snug text-ink-900 line-clamp-2">
          {title}
        </p>
        <p className="text-[11px] text-brand-600 font-medium">{date}</p>
        <p className="text-[11px] leading-snug text-ink-600">{subtitle}</p>
      </div>
    </a>
  );
}
