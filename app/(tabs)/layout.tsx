import { BottomNav } from "@/components/nav/BottomNav";

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mx-auto w-full max-w-lg pb-20">{children}</div>
      <BottomNav />
    </>
  );
}
