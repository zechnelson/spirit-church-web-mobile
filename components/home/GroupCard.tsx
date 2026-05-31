import Image from "next/image";

interface GroupCardProps {
  title: string;
  location?: string;
  schedule?: string;
  imageSrc?: string;
  href?: string;
}

export function GroupCard({
  title,
  location,
  schedule,
  imageSrc = "/images/placeholder-image.png",
  href = "#",
}: GroupCardProps) {
  return (
    <a
      href={href}
      className="flex w-48 flex-shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-ink-300 bg-white active:opacity-80"
    >
      {/* 16:9 image */}
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
        {location && (
          <p className="text-[11px] font-medium text-brand-600">{location}</p>
        )}
        {schedule && (
          <p className="text-[11px] leading-snug text-ink-600">{schedule}</p>
        )}
      </div>
    </a>
  );
}
