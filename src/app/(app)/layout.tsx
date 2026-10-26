import { TabBar } from "@/components/tab-bar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-md px-4 pb-36 pt-safe">{children}</main>
      <TabBar />
    </>
  );
}
