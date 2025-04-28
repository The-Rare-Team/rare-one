import { Button } from "./ui/button";

export default function CTASection() {
  return (
    <section className="py-20 px-4" id="cta">
      <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 rounded-2xl p-12 shadow-lg">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          Ready to transform your QA process?
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Say goodbye to manual testing overhead and hello to reliable, autonomous QA that evolves with your product.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg rounded-lg">
            Get Started
          </Button>
          <Button variant="outline" className="px-8 py-6 text-lg rounded-lg">
            Request Demo
          </Button>
        </div>
      </div>
    </section>
  );
} 