import { EventGridCard } from "@/components/events/EventGridCard";
import { EventsEmptyState } from "@/components/events/EventsEmptyState";

// TODO: Replace with Webflow CMS fetch when API is connected.
const events = [
  {
    id: "1",
    title: "Sunday Service",
    date: "Sun, May 18",
    time: "10:00 AM",
    location: "Main Auditorium",
    category: "Worship",
  },
  {
    id: "2",
    title: "Community Night",
    date: "Wed, May 21",
    time: "6:30 PM",
    location: "Fellowship Hall",
    category: "Community",
  },
  {
    id: "3",
    title: "Young Adults Night",
    date: "Fri, May 23",
    time: "7:00 PM",
    location: "Student Center",
    category: "Young Adults",
  },
  {
    id: "4",
    title: "Prayer & Worship Night",
    date: "Sat, May 24",
    time: "6:00 PM",
    location: "Main Auditorium",
    category: "Prayer",
  },
  {
    id: "5",
    title: "Baptism Sunday",
    date: "Sun, Jun 1",
    time: "10:00 AM",
    location: "Main Auditorium",
    category: "Special Event",
  },
  {
    id: "6",
    title: "Men's Breakfast",
    date: "Sat, Jun 7",
    time: "8:00 AM",
    location: "Fellowship Hall",
    category: "Men",
  },
  {
    id: "7",
    title: "Women's Conference",
    date: "Sat, Jun 14",
    time: "9:00 AM",
    location: "Main Auditorium",
    category: "Women",
  },
  {
    id: "8",
    title: "Volunteer Orientation",
    date: "Sun, Jun 15",
    time: "12:00 PM",
    location: "Room 201",
    category: "Serve",
  },
];

export default function EventsPage() {
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
            <EventGridCard key={event.id} {...event} />
          ))}
        </div>
      )}
    </div>
  );
}
