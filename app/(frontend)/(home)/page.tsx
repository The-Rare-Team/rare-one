import Hero from "./hero";
import FeaturesSection from "./features-section";
import CTASection from "./cta-section";

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
