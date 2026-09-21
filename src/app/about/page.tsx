import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — VEIL",
  description: "What VEIL is and how it works.",
};

export default function AboutPage() {
  return (
    <article className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">About 🎭</h1>
        <p className="text-sm text-muted-foreground">
          The what, the why, and the how.
        </p>
      </header>

      <div className="grid gap-4 text-sm leading-relaxed text-foreground/90">
        <h2 className="text-base font-semibold text-foreground">
          What is this?
        </h2>
        <p>
          VEIL is an anonymous board for your campus. Post what you'd never
          say out loud, react to others, and read what the campus is really
          thinking — all without anyone knowing it was you.
        </p>

        <h2 className="text-base font-semibold text-foreground">
          How does anonymity work?
        </h2>
        <p>
          You create a private account with a username and password. On the
          public side, you appear only as a nickname and an emoji avatar.
          Nobody — not other students, not moderators, not us — can see which
          real account posted what.
        </p>

        <h2 className="text-base font-semibold text-foreground">
          Why moderation?
        </h2>
        <p>
          Every confession is reviewed before it goes public.
          This keeps the board fun instead of harmful. Rejected posts are
          never shown to anyone but you, along with the reason.
        </p>

        <h2 className="text-base font-semibold text-foreground">
          The short version
        </h2>
        <p>
          Anonymous. Honest. Moderated. Be kind out there. 🤝
        </p>
      </div>
    </article>
  );
}
