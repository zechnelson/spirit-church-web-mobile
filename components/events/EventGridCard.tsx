import Image from "next/image";

interface EventGridCardProps {
  title: string;
  date: string;
  time: string;
  location: string;
  category: string;
  imageSrc?: string;
  href?: string;
}

export function EventGridCard({
  title,
  date,
  time,
  location,
  category,
  imageSrc = "/images/placeholder-image.png",
  href = "#",
}: EventGridCardProps) {
  return (
    <a
      href={href}
      className="flex flex-col overflow-hidden rounded-2xl border border-ink-300 bg-white active:opacity-80"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full">
        <Image
          src={imageSrc}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 512px) 50vw, 256px"
        />
        {/* Category badge over image */}
        <span className="absolute left-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {category}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1 p-3">
        <p className="text-[13px] font-semibold leading-snug text-ink-900 line-clamp-2">
          {title}
        </p>
        <p className="text-[11px] text-brand-600 font-medium">{date} · {time}</p>
        <p className="text-[11px] text-ink-600 leading-snug">{location}</p>
      </div>
    </a>
  );
}
