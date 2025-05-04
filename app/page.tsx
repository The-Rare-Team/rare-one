import CTASection from "@/components/cta-section";
import FeaturesSection from "@/components/features-section";
import Hero from "@/components/hero";

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
