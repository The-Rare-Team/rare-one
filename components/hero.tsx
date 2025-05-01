import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export default function Hero() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-16 text-center md:px-6 lg:px-8">
      <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">Rare QA</h1>
      <p className="text-muted-foreground mx-auto max-w-2xl text-xl md:text-2xl">
        The autonomous AI teammate that fully owns the QA process for software teams
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        <Button className="rounded-lg bg-purple-600 px-6 py-6 text-lg text-white hover:bg-purple-700">
          Get Started
        </Button>
        <Button variant="outline" className="rounded-lg px-6 py-6 text-lg">
          Request Demo
        </Button>
      </div>
    </div>
  );
}
