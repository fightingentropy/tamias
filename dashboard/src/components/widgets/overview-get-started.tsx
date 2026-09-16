"use client";

import { Button } from "@tamias/ui/button";
import { Icons } from "@tamias/ui/icons";
import Link from "@/framework/link";

const steps = [
  {
    title: "Add income or an expense",
    description: "Record a payment for a job, materials or another business cost.",
    label: "Add a transaction",
    href: "/transactions?createTransaction=true",
    icon: Icons.Transactions,
  },
  {
    title: "Keep your receipts together",
    description: "Upload a receipt so it’s ready when you review your expenses.",
    label: "Upload a receipt",
    href: "/inbox",
    icon: Icons.ReceiptLong,
  },
  {
    title: "Send your first invoice",
    description: "Create an invoice and keep track of what customers owe you.",
    label: "Create an invoice",
    href: "/invoices?type=create",
    icon: Icons.Invoice,
  },
];

export function OverviewGetStarted() {
  return (
    <section aria-labelledby="getting-started-heading" className="space-y-8">
      <div className="border bg-card p-6 sm:p-8">
        <p className="mb-3 text-sm text-muted-foreground">Your business overview</p>
        <h2 id="getting-started-heading" className="font-serif text-2xl sm:text-3xl">
          Start with what you have.
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Add a payment, a receipt or an invoice. Your balances and activity will appear here as you
          add records.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/transactions?createTransaction=true">
              Add your first transaction <Icons.ArrowRightAlt className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/transactions?step=import&hide=true">Import a statement</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Prefer automatic imports?{" "}
          <Link
            href="/transactions?step=connect"
            className="underline underline-offset-4 text-foreground"
          >
            Connect a bank account
          </Link>
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        {steps.map((step) => (
          <div key={step.href} className="flex flex-col items-start border-t pt-5">
            <step.icon className="mb-4 size-5 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-sm font-medium">{step.title}</h3>
            <p className="mt-2 mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
            <Link
              href={step.href}
              className="flex items-center gap-2 text-sm underline-offset-4 hover:underline"
            >
              {step.label}
              <Icons.ArrowRightAlt className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
