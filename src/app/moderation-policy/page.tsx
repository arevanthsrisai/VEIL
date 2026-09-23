import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moderation — VEIL",
  description: "How moderation works on VEIL.",
};

export default function ModerationPolicyPage() {
  return (
    <article className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Moderation policy 🛡️
        </h1>
        <p className="text-sm text-muted-foreground">
          Human reviewers. Every post. Every time.
        </p>
      </header>

      <div className="grid gap-4 text-sm leading-relaxed text-foreground/90">
        <h2 className="text-base font-semibold text-foreground">
          The workflow
        </h2>
        <p>
          Every post starts pending. A moderator or admin reviews it and either
          approves it (public, keeping your original timestamp) or rejects it.
          Nothing becomes public before a human approves it. No AI moderation.
        </p>

        <h2 className="text-base font-semibold text-foreground">
          After approval
        </h2>
        <p>
          Approved posts can still be hidden or removed by moderators if
          reports or later review show they break the rules — an old link will
          then show as unavailable. Hidden posts can be restored if the
          decision is revisited. You'll be notified when your post is approved,
          rejected, hidden, or restored.
        </p>

        <h2 className="text-base font-semibold text-foreground">Reports</h2>
        <p>
          Anyone signed in can report a post. Reports go to a moderation queue
          and are resolved or dismissed by a human. Report counts never
          automatically remove content — a person always makes the call.
        </p>

        <h2 className="text-base font-semibold text-foreground">
          Appeals and anonymity
        </h2>
        <p>
          If you believe a decision was wrong, contact the moderators —
          decisions are revisited and posts can be restored. Moderators never
          see your password, and your login username is never shown publicly.
          Moderation decisions only ever reference your public identity — or
          nothing at all if you posted without it.
        </p>
      </div>
    </article>
  );
}
