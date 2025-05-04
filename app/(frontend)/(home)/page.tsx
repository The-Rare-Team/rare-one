import CTASection from "@/components/cta-section";
import Hero from "@/components/hero";
import FeaturesSection from "./features-section";

export default async function Home() {
  return (
    <>
      <Hero />
      <main className="flex flex-1 flex-col">
        <FeaturesSection />
        <CTASection />
      </main>
    </>
  );
}
