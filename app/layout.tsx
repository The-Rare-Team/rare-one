import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import NavItems from "@/components/nav-items";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { ThemeProvider } from "next-themes";
import { Outfit } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { ToastContainer } from "react-toastify";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Autonomous QA Teammate - The Rare One",
};

const geistSans = Outfit({
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <main className="flex min-h-screen flex-col items-center">
            <div className="flex w-full flex-col items-center gap-2">
              <nav className="border-b-foreground/10 flex h-16 w-full justify-center border-b">
                <div className="flex w-full max-w-5xl items-center justify-between p-3 px-5">
                  <div className="flex items-center gap-3 font-semibold">
                    <Link href={"/"} className="flex gap-x-2 text-lg">
                      <Image
                        src="/logo_sm.png"
                        alt="Green Chair logo"
                        width={380 * 0.4}
                        height={86 * 0.4}
                        className=""
                      />
                    </Link>
                    <NavItems />
                  </div>
                  <HeaderAuth />
                </div>
              </nav>
              <div className="flex w-full max-w-5xl flex-col gap-2 p-5">
                {children}
                <ToastContainer theme="colored" />
              </div>
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
