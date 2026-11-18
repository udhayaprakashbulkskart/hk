import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { TabBar } from "@/components/layout/tab-bar";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto min-h-[60dvh] max-w-7xl px-4 pt-5 lg:px-6">{children}</main>
      <Footer />
      <TabBar />
    </>
  );
}
