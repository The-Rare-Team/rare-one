import Hero from "@/components/hero";
import FeaturesSection from "@/components/features-section";
import CTASection from "@/components/cta-section";

export default async function Home() {
  return (
    <>
      <Hero />
      <main className="flex-1 flex flex-col">
        <FeaturesSection />
        <CTASection />
      </main>
    </>
  );
}
