import CTASection from "./cta-section";
import FeaturesSection from "./features-section";
import Hero from "./hero";

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
