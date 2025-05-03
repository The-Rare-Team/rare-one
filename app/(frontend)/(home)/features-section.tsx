import { CheckCircle } from "lucide-react";

interface FeatureProps {
  title: string;
  description: string;
}

function Feature({ title, description }: FeatureProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-[#086788]" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="text-muted-foreground pl-7">{description}</p>
    </div>
  );
}

export default function FeaturesSection() {
  const features = [
    {
      title: "Never Waste Ad Spend Again",
      description:
        "Green Chair monitors your landing page 24/7, so you are not burning budget on broken links or failed loadouts.",
    },
    {
      title: "Smarter Than Scripts",
      description:
        "Green Chair understands your landing page like a human—detecting issues even during A/B tests and dynamic changes.",
    },
    {
      title: "Zero Setup Required",
      description: "Just drop in your landing page URL. No test scripting. No prompting. Green Chair handles the rest.",
    },
  ];

  return (
    <section className="px-4 py-16" id="features">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center text-3xl font-bold">How Green Chair Works</h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Feature key={index} title={feature.title} description={feature.description} />
          ))}
        </div>
      </div>
    </section>
  );
}
