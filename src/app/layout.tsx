import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SiteNavbar } from "@/components/site/navbar";
import { AnnouncementBanner } from "@/components/site/announcement-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VEIL",
  description: "Anonymous posts from your campus. Share quietly, read honestly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <SiteNavbar />
        <AnnouncementBanner />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-10">
          {children}
        </main>
        <footer className="border-t border-border/60 py-6">
          <div className="mx-auto grid max-w-2xl gap-3 px-4 text-center">
            <nav
              aria-label="Footer"
              className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
            >
              <Link href="/popular" className="transition-colors hover:text-foreground">
                Popular
              </Link>
              <Link href="/archive" className="transition-colors hover:text-foreground">
                Archive
              </Link>
              <Link href="/activity" className="transition-colors hover:text-foreground">
                My activity
              </Link>
              <Link href="/about" className="transition-colors hover:text-foreground">
                About
              </Link>
              <Link href="/rules" className="transition-colors hover:text-foreground">
                Rules
              </Link>
              <Link href="/moderation-policy" className="transition-colors hover:text-foreground">
                Moderation
              </Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">
                Terms
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-foreground">
                Privacy
              </Link>
            </nav>
            <p className="text-xs text-muted-foreground">
              🎭 VEIL — everything here is anonymous. Be kind out there.
            </p>
          </div>
        </footer>
        <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
