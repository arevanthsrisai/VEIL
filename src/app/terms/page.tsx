import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms — VEIL",
  description: "The terms of use for VEIL.",
};

export default function TermsPage() {
  return (
    <article className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Terms 📄</h1>
        <p className="text-sm text-muted-foreground">
          Short, readable, and actually followed.
        </p>
      </header>

      <div className="grid gap-4 text-sm leading-relaxed text-foreground/90">
        <h2 className="text-base font-semibold text-foreground">Your account</h2>
        <p>
          VEIL accounts need a username and password — nothing else. Your
          username is private and used only to log in. Your public identity is
          whatever nickname and avatar you pick, and you can post without it
          entirely.
        </p>

        <h2 className="text-base font-semibold text-foreground">Your posts</h2>
        <p>
          Everything you post is reviewed by moderators before it becomes
          public. Posts that break the community rules are rejected — you'll
          see why, nobody else will. You cannot edit or delete a post after
          submitting it; moderators can remove posts that break the rules.
        </p>

        <h2 className="text-base font-semibold text-foreground">Acceptable use</h2>
        <p>
          No harassment, threats, doxxing, hate, spam, or illegal content.
          Automated abuse, mass account creation, and attempts to break the
          anonymity of others will get accounts restricted or removed. Many
          people may share a network — restrictions target accounts, not
          networks.
        </p>

        <h2 className="text-base font-semibold text-foreground">Changes</h2>
        <p>
          These terms may be updated as the platform grows. Material changes
          will be announced on the site. Continued use after a change means you
          accept it.
        </p>
      </div>
    </article>
  );
}
