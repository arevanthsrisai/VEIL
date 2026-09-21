import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — VEIL",
  description: "What VEIL stores and never shares.",
};

export default function PrivacyPage() {
  return (
    <article className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Privacy 🔒
        </h1>
        <p className="text-sm text-muted-foreground">
          What we store, and what we never share.
        </p>
      </header>

      <div className="grid gap-4 text-sm leading-relaxed text-foreground/90">
        <h2 className="text-base font-semibold text-foreground">
          What we store
        </h2>
        <p>
          A username, a password (hashed — we can't read it), a public
          nickname, and an emoji avatar. That's the whole list. No email, no
          phone number, no student ID.
        </p>

        <h2 className="text-base font-semibold text-foreground">
          What's public
        </h2>
        <p>
          Your nickname and emoji avatar appear on everything you post. Your
          confessions and reactions are public after moderation.
        </p>

        <h2 className="text-base font-semibold text-foreground">
          What's never shared
        </h2>
        <p>
          Your username and password are never shown to anyone, in any
          response, on any page, ever. There is no link between your public
          identity and your account that anyone can follow.
        </p>

        <h2 className="text-base font-semibold text-foreground">
          No tracking
        </h2>
        <p>
          No analytics trackers, no ads, no third-party scripts following you
          around. The site keeps a session cookie so you stay logged in, and
          that's it.
        </p>

        <h2 className="text-base font-semibold text-foreground">
          Deleting your stuff
        </h2>
        <p>
          This is V1 — there's no self-serve delete yet. Rejected posts are
          never public. If you need something taken down, reach out through
          the moderation report flow.
        </p>
      </div>
    </article>
  );
}
