import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export default function Hero() {
  return (
    <div className="flex flex-col gap-8 items-center py-16 px-4 md:px-6 lg:px-8 max-w-5xl mx-auto text-center">
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
        Rare QA
      </h1>
      <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
        The autonomous AI teammate that fully owns the QA process for software teams
      </p>
      <div className="flex flex-col sm:flex-row gap-4 mt-4">
        <Button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-6 text-lg rounded-lg">
          Get Started
        </Button>
        <Button variant="outline" className="px-6 py-6 text-lg rounded-lg">
          Request Demo
        </Button>
      </div>
    </div>
  );
}
