import type { ReactNode } from "react";
import Link from "@/framework/link";

export const legalOperator = {
  name: "Erlin Hoxha trading as Tamias",
  address: "Studio 24, London Fields East Side, London E8 3SA",
  email: "support@tamias.xyz",
};

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <nav
          aria-label="Public navigation"
          className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-5 px-6 py-6"
        >
          <Link href="/" className="font-serif text-2xl">
            Tamias
          </Link>
          <div className="flex flex-wrap gap-5 text-sm">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/support">Support</Link>
            <Link href="/login">Sign in</Link>
          </div>
        </nav>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
        <p className="mb-5 text-sm text-muted-foreground">Last updated 20 September 2026</p>
        <h1 className="font-serif text-4xl sm:text-5xl">{title}</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{intro}</p>
        <div className="mt-12 space-y-10 text-base leading-7 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-2xl [&_p+p]:mt-4 [&_a]:underline [&_a]:underline-offset-4 [&_li]:my-2 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </main>
      <footer className="mx-auto max-w-5xl border-t border-border px-6 py-8 text-sm leading-6 text-muted-foreground">
        <p>{legalOperator.name}</p>
        <p>{legalOperator.address}</p>
        <a className="underline underline-offset-4" href={`mailto:${legalOperator.email}`}>
          {legalOperator.email}
        </a>
      </footer>
    </div>
  );
}
