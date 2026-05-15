import { EventGridCard } from "@/components/events/EventGridCard";
import { EventsEmptyState } from "@/components/events/EventsEmptyState";
import { getEvents } from "@/lib/webflow";

export default async function EventsPage() {
  const events = await getEvents().catch(() => []);

  return (
    <div className="px-4 pb-6 pt-6">
      <h1 className="mb-1 text-[26px] font-bold tracking-tight text-ink-900">
        Upcoming Events
      </h1>
      <p className="mb-5 text-[13px] text-ink-600">
        What&apos;s happening at Spirit Church
      </p>

      {events.length === 0 ? (
        <EventsEmptyState />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {events.map((event) => (
            <EventGridCard
              key={event.id}
              title={event.title}
              date={event.date}
              time={event.time}
              location={event.location}
              category={event.category}
              imageSrc={event.imageSrc}
              href={event.href}
            />
          ))}
        </div>
      )}
    </div>
  );
}
