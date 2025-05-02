import { Button } from "./ui/button";

export default function CTASection() {
  return (
    <section className="px-4 py-20" id="cta">
      <div className="mx-auto max-w-4xl rounded-2xl bg-linear-to-r from-purple-50 to-indigo-50 p-12 text-center shadow-lg dark:from-purple-950 dark:to-indigo-950">
        <h2 className="mb-6 text-3xl font-bold md:text-4xl">Ready to give us a try?</h2>
        <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
          Never waste a dollar on ad spend due to broken landing pages.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button asChild className="rounded-lg bg-[#086788] px-6 py-6 text-lg text-white hover:bg-[#07506a]">
            <a href="https://forms.gle/pvm8eMPwNtVtsZSc6" target="_blank" rel="noopener noreferrer">
              Get Early Access
            </a>
          </Button>
          <Button variant="outline" className="rounded-lg px-6 py-6 text-lg">
            Request Demo
          </Button>
        </div>
      </div>
    </section>
  );
}
