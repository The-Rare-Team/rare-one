import { Button } from "./ui/button";

export default function Hero() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-16 text-center md:px-6 lg:px-8">
      <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">Meet Kevin</h1>
      <p className="text-muted-foreground mx-auto max-w-2xl text-xl md:text-2xl">
        The autonomous AI teammate that ensures your landing page is working 24/7.
      </p>
      <div className="flex w-full justify-center">
        <div className="relative aspect-video w-full max-w-2xl">
          <iframe
            className="absolute top-0 left-0 h-full w-full rounded-lg shadow-lg"
            src="https://www.youtube.com/embed/LKgAx7FWva4"
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
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
  );
}
