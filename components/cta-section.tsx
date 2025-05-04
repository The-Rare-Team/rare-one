import Link from "next/link";
import { Button } from "./ui/button";

export default function CTASection() {
  return (
    <section className="px-4 py-20" id="cta">
      <div className="mx-auto max-w-4xl rounded-2xl bg-linear-to-r from-green-50 to-green-50 p-12 text-center shadow-lg dark:from-purple-950 dark:to-indigo-950">
        <h2 className="mb-6 text-3xl font-bold md:text-4xl">Ready to Give It a Try?</h2>
        <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
          Protect every ad dollar. Keep your landing page conversion-ready, always.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button asChild className="rounded-lg bg-[#3f6c51] px-6 py-6 text-lg text-white hover:bg-[#345942]">
            <a href="https://forms.gle/GLC4EzvdtZcBSzKf7" target="_blank" rel="noopener noreferrer">
              Get Early Access
            </a>
          </Button>
          <Button variant="outline" className="rounded-lg px-6 py-6 text-lg" asChild>
            <Link target="_blank" href="https://calendar.app.google/rEVV34yx8janoZkSA">
              Request Demo
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
