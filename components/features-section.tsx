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
      <p className="pl-7 text-muted-foreground">{description}</p>
    </div>
  );
}

export default function FeaturesSection() {
  const features = [
    {
      title: "Context-Aware Testing",
      description:
        "Reads PRDs, codebase, and interacts with your product to build complete understanding",
    },
    {
      title: "No Manual Scripting",
      description:
        "Automatically generates, runs, and maintains tests without requiring manual scripts or prompts",
    },
    {
      title: "Adaptive Test Coverage",
      description:
        "Intelligently adapts as your product evolves, catching regressions before production",
    },
    {
      title: "Proactive Risk Identification",
      description: "Acts like a true QA teammate by proactively identifying risks in your system",
    },
    {
      title: "Zero Maintenance",
      description: "Maintains test suites automatically, reducing traditional manual overhead",
    },
    {
      title: "Release Confidence",
      description: "Gives teams confidence to release without the traditional QA bottlenecks",
    },
  ];

  return (
    <section className="px-4 py-16" id="features">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center text-3xl font-bold">How Rare QA Works</h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Feature key={index} title={feature.title} description={feature.description} />
          ))}
        </div>
      </div>
    </section>
  );
}
