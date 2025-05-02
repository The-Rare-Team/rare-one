import { CheckCircle } from "lucide-react";

interface FeatureProps {
  title: string;
  description: string;
}

function Feature({ title, description }: FeatureProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="text-muted-foreground pl-7">{description}</p>
    </div>
  );
}

export default function FeaturesSection() {
  const features = [
    {
      title: "No wasted ad spend",
      description: "Kevin ensures your landing page is working 24/7 so your ad spend is never wasted.",
    },
    {
      title: "Context Aware",
      description:
        "Kevin sees your landing page like a human, and tests it like a human, and works even if you are doing A/B testing.",
    },
    {
      title: "No Scripting or Prompting",
      description: "Just input your landing page URL, and Kevin will do the rest.",
    },
  ];

  return (
    <section className="px-4 py-16" id="features">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center text-3xl font-bold">How Kevin Works</h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Feature key={index} title={feature.title} description={feature.description} />
          ))}
        </div>
      </div>
    </section>
  );
}
