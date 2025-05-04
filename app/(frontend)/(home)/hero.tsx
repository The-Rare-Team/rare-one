import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Hero() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-12 text-center md:px-6 lg:px-8">
      <h1 className="text-4xl font-medium tracking-tight md:text-5xl lg:text-6xl">
        Meet <span className="font-bold text-[#3f6c51]">Green Chair</span> QA
      </h1>
      <p className="text-muted-foreground mx-auto max-w-2xl text-xl md:text-2xl">
        Your autonomous AI teammate that makes sure your landing page is always up and running - day or night.
      </p>
      <div className="flex w-full justify-center">
        <div className="relative aspect-video w-full max-w-2xl">
          <iframe
            className="absolute top-0 left-0 h-full w-full rounded-lg shadow-lg"
            src="https://www.youtube.com/embed/NpEaa2P7qZI"
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        <Button asChild className="rounded-lg bg-[#3f6c51] px-6 py-6 text-lg text-white hover:bg-[#345b44]">
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
  );
}
