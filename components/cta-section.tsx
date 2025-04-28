import { Button } from "./ui/button";

export default function CTASection() {
  return (
    <section className="px-4 py-20" id="cta">
      <div className="mx-auto max-w-4xl rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 p-12 text-center shadow-lg dark:from-purple-950 dark:to-indigo-950">
        <h2 className="mb-6 text-3xl font-bold md:text-4xl">Ready to transform your QA process?</h2>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
          Say goodbye to manual testing overhead and hello to reliable, autonomous QA that evolves
          with your product.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button className="rounded-lg bg-purple-600 px-8 py-6 text-lg text-white hover:bg-purple-700">
            Get Started
          </Button>
          <Button variant="outline" className="rounded-lg px-8 py-6 text-lg">
            Request Demo
          </Button>
        </div>
      </div>
    </section>
  );
}
