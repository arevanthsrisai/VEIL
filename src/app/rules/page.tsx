import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rules — VEIL",
  description: "The posting rules for VEIL.",
};

export default function RulesPage() {
  return (
    <article className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Rules 📏</h1>
        <p className="text-sm text-muted-foreground">
          Short list. Moderators actually enforce it.
        </p>
      </header>

      <div className="grid gap-4 text-sm leading-relaxed text-foreground/90">
        <h2 className="text-base font-semibold text-foreground">
          Everything is reviewed
        </h2>
        <p>
          All confessions pass through moderation before they
          become public. If a post breaks these rules, it gets rejected and
          you'll see why — nobody else will.
        </p>

        <h2 className="text-base font-semibold text-foreground">Not allowed</h2>
        <ul className="grid gap-2">
          <li>
            <strong className="text-foreground">Harassment or bullying</strong>{" "}
            — no targeted attacks on any person or group.
          </li>
          <li>
            <strong className="text-foreground">Doxxing</strong> — no real
            names, roll numbers, phone numbers, photos, or details that could
            identify someone.
          </li>
          <li>
            <strong className="text-foreground">Spam</strong> — no repeats,
            ads, promotions, or flooding the feed.
          </li>
          <li>
            <strong className="text-foreground">Hate speech</strong> — no
            slurs or content attacking anyone's identity.
          </li>
          <li>
            <strong className="text-foreground">Anything illegal</strong> —
            you know what this means.
          </li>
        </ul>

        <h2 className="text-base font-semibold text-foreground">Rate limits</h2>
        <p>
          There's a cap on how fast you can post. If you hit it,
          wait a bit and try again — it exists to keep the feed readable, not
          to silence you.
        </p>

        <h2 className="text-base font-semibold text-foreground">
          Breaking the rules
        </h2>
        <p>
          Rejected posts stay visible only to you, with the reason attached.
          Repeat abuse can lead to your account being restricted. Anonymous
          doesn't mean consequence-free.
        </p>
      </div>
    </article>
  );
}
