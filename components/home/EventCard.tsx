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
      className="flex w-64 flex-shrink-0 snap-start overflow-hidden rounded-xl border border-ink-300 bg-white active:opacity-80"
    >
      {/* Thumbnail */}
      <div className="relative h-full w-20 flex-shrink-0">
        <Image
          src={imageSrc}
          alt=""
          fill
          className="object-cover"
          sizes="80px"
        />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between p-3">
        <div>
          <p className="text-[13px] font-semibold leading-snug text-ink-900">
            {title}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-600">
            {subtitle}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-ink-600">{date}</span>
        </div>
      </div>
    </a>
  );
}
