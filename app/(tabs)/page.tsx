import { HomeHeader } from "@/components/home/HomeHeader";
import { HeroBanner } from "@/components/home/HeroBanner";
import { CarouselSection } from "@/components/home/CarouselSection";
import { EventCard } from "@/components/home/EventCard";
import { NextStepCard } from "@/components/home/NextStepCard";
import { GroupCard } from "@/components/home/GroupCard";
import { ViewAllCard } from "@/components/home/ViewAllCard";
import { getEvents, getGroups, getHeaderCards } from "@/lib/webflow";

const nextSteps = [
  { id: "1", title: "New here?",        href: "#", color: "#304c3f" },
  { id: "2", title: "Commit to Christ", href: "#", color: "#4c725e" },
  { id: "3", title: "Get baptized",     href: "#", color: "#84aa98" },
  { id: "4", title: "Join a team",      href: "#", color: "#c6c5ab" },
];

export default async function HomePage() {
  const [events, sliderCards, groups] = await Promise.all([
    getEvents().catch(() => []),
    getHeaderCards().catch(() => []),
    getGroups().catch(() => []),
  ]);

  const hero = sliderCards[0];

  return (
    <div className="pb-6">
      <HomeHeader />

      {hero ? (
        <HeroBanner text={hero.text} href={hero.href} imageSrc={hero.imageSrc} />
      ) : (
        <HeroBanner text="Welcome to Spirit Church" href="#" />
      )}

      <CarouselSection title="Upcoming events">
        {events.slice(0, 8).map((event) => (
          <EventCard
            key={event.id}
            title={event.title}
            subtitle={event.time || event.location}
            category={event.category}
            date={event.date}
            imageSrc={event.imageSrc}
            href={event.href}
          />
        ))}
        <ViewAllCard href="https://www.spiritchurch.co/events" />
      </CarouselSection>

      <CarouselSection title="Your next step">
        {nextSteps.map((step) => (
          <NextStepCard key={step.id} {...step} />
        ))}
      </CarouselSection>

      {groups.length > 0 ? (
        <CarouselSection title="Join a group">
          {groups.slice(0, 8).map((group) => (
            <GroupCard key={group.id} {...group} />
          ))}
          <ViewAllCard href="https://www.spiritchurch.co/groups-finder" />
        </CarouselSection>
      ) : (
        <div className="px-4 pt-6">
          <p className="mb-3 text-[15px] font-bold text-ink-900">Join a group</p>
          <a
            href="https://www.spiritchurch.co/groups-finder"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-300 bg-white px-6 py-8 text-center active:opacity-70"
          >
            <p className="text-[14px] font-semibold text-ink-900">No groups found</p>
            <p className="text-[12px] text-ink-600">We may be preparing for a new semester</p>
          </a>
        </div>
      )}
    </div>
  );
}
