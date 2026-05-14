import { HomeHeader } from "@/components/home/HomeHeader";
import { HeroBanner } from "@/components/home/HeroBanner";
import { CarouselSection } from "@/components/home/CarouselSection";
import { EventCard } from "@/components/home/EventCard";
import { NextStepCard } from "@/components/home/NextStepCard";
import { GroupCard } from "@/components/home/GroupCard";
import { ViewAllCard } from "@/components/home/ViewAllCard";

const events = [
  {
    id: "1",
    title: "Sunday Service",
    subtitle: "Doors open at 9:30am",
    category: "Worship",
    date: "Sun, May 18",
  },
  {
    id: "2",
    title: "Community Night",
    subtitle: "Connect with your people",
    category: "Community",
    date: "Wed, May 21",
  },
  {
    id: "3",
    title: "Young Adults Night",
    subtitle: "For ages 18–25",
    category: "Young Adults",
    date: "Fri, May 23",
  },
  {
    id: "4",
    title: "Prayer & Worship",
    subtitle: "Come as you are",
    category: "Prayer",
    date: "Sat, May 24",
  },
  {
    id: "5",
    title: "Baptism Sunday",
    subtitle: "Celebrate new life with us",
    category: "Special Event",
    date: "Sun, Jun 1",
  },
];

const nextSteps = [
  { id: "1", title: "New here?",        href: "#", color: "#304c3f" }, // brand-700
  { id: "2", title: "Commit to Christ", href: "#", color: "#4c725e" }, // brand-500
  { id: "3", title: "Get baptized",     href: "#", color: "#84aa98" }, // brand-350
  { id: "4", title: "Join a team",      href: "#", color: "#c6c5ab" }, // warm-300
];

const groups = [
  { id: "1", title: "Young Professionals", category: "Small Group" },
  { id: "2", title: "Married Couples", category: "Small Group" },
  { id: "3", title: "Men's Group", category: "Small Group" },
  { id: "4", title: "Women's Group", category: "Small Group" },
  { id: "5", title: "College Ministry", category: "Small Group" },
];

export default function HomePage() {
  return (
    <div className="pb-6">
      <HomeHeader />

      <HeroBanner
        text="It's a good day to have a great day!"
        href="#"
        handle="@spiritchurch.co"
      />

      <CarouselSection title="Upcoming events">
        {events.slice(0, 8).map((event) => (
          <EventCard key={event.id} {...event} />
        ))}
        <ViewAllCard href="https://www.spiritchurch.co/events" />
      </CarouselSection>

      <CarouselSection title="Your next step">
        {nextSteps.map((step) => (
          <NextStepCard key={step.id} {...step} />
        ))}
      </CarouselSection>

      <CarouselSection title="Join a group">
        {groups.slice(0, 8).map((group) => (
          <GroupCard key={group.id} {...group} />
        ))}
        <ViewAllCard href="https://www.spiritchurch.co/groups-finder" />
      </CarouselSection>
    </div>
  );
}
