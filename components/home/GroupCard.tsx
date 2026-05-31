import Image from "next/image";

interface GroupCardProps {
  title: string;
  category?: string;
  imageSrc?: string;
  href?: string;
}

export function GroupCard({
  title,
  category,
  imageSrc = "/images/placeholder-image.png",
  href = "#",
}: GroupCardProps) {
  return (
    <a
      href={href}
      className="flex w-44 flex-shrink-0 snap-start overflow-hidden rounded-xl border border-ink-300 bg-white active:opacity-80"
    >
      {/* Thumbnail */}
      <div className="relative h-full w-16 flex-shrink-0">
        <Image
          src={imageSrc}
          alt=""
          fill
          className="object-cover"
          sizes="64px"
        />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-center gap-1 p-3">
        <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-ink-900">
          {title}
        </p>
        {category && (
          <span className="w-fit rounded-full bg-ink-200 px-2 py-0.5 text-[10px] font-medium text-ink-800">
            {category}
          </span>
        )}
      </div>
    </a>
  );
}
