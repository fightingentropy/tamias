"use client";

import { createLazyFileRoute } from "@tanstack/react-router";
import Link from "@/framework/link";
import { LogoSmallIcon } from "@/start/components/app-shell-icons";
import { useEffect, useRef, useState } from "react";

export const Route = createLazyFileRoute("/")({
  component: LandingPageGuard,
});

function LandingPageGuard() {
  const data = Route.useLoaderData();

  // If the loader redirected (authenticated user), data won't have our expected shape.
  // Return nothing to prevent the landing page from flashing during the redirect.
  if (!data || (data as { authenticated?: boolean }).authenticated !== false) {
    return null;
  }

  return <LandingPage />;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const features = [
  {
    title: "All your transactions, unified",
    subtitle:
      "Every payment in and out of the business is automatically synced from your connected accounts.",
    mobileSubtitle: "Every payment in and out is pulled in automatically.",
  },
  {
    title: "Invoices get paid",
    subtitle:
      "Customers can pay invoices online, with payments tracked automatically.",
    mobileSubtitle:
      "Customers can pay invoices online with payments tracked automatically.",
  },
  {
    title: "Automatic reconciliation",
    subtitle:
      "Payments, receipts, and transactions are automatically matched so records stay accurate.",
    mobileSubtitle:
      "Transactions are categorized and reconciled automatically.",
  },
];

const featureGridItems = [
  { title: "Invoicing", subtitle: "Invoice management", icon: "description" },
  { title: "Transactions", subtitle: "Money movement", icon: "list_alt" },
  { title: "Inbox", subtitle: "Receipt matching", icon: "inbox" },
  { title: "Time tracking", subtitle: "Project hours", icon: "timer" },
  {
    title: "Customers",
    subtitle: "Customer performance",
    icon: "scatter_plot",
  },
  { title: "Files", subtitle: "Document storage", icon: "folder_zip" },
  { title: "Exports", subtitle: "Accounting ready", icon: "arrow_outward" },
  { title: "Apps", subtitle: "Connect your tools", icon: "widgets" },
];

const painPoints = [
  {
    label: "Chasing receipts",
    time: "45 minutes per week",
    description: "Receipts arrive late, get lost, or need follow-ups.",
  },
  {
    label: "Cleaning transactions",
    time: "1 hour per week",
    description:
      "Categorizing, fixing duplicates, and making numbers line up.",
  },
  {
    label: "Preparing invoices",
    time: "1–2 hours per week",
    description:
      "Creating invoices, checking payments, and answering questions.",
  },
  {
    label: "Explaining the numbers",
    time: "1 hour per week",
    description:
      "Pulling data together and explaining what changed and why.",
  },
];

const accountingChecklist = [
  {
    full: "Transactions from 25,000+ banks are categorized and reconciled automatically",
    short: "Transactions from 25,000+ banks",
  },
  {
    full: "Receipts and invoices are pulled from email and payments, then matched to transactions",
    short: "Receipts pulled from email and uploads",
  },
  {
    full: "Clean records across all connected accounts",
    short: "Clean records across all connected accounts",
  },
  {
    full: "Taxes are tracked per transaction",
    short: "Taxes tracked per transaction",
  },
  {
    full: "Export-ready for your accounting system",
    short: "Ready to export to your accounting system",
  },
];

const testimonials = [
  {
    name: "Paweł Michalski",
    company: "VC Leaders",
    country: "Poland",
    image: "https://midday.ai/stories/pawel.jpeg",
    content:
      "Invoice reconciliation used to take a full day each month and was always stressful. With Tamias, that work is mostly gone and we finally have a clear financial overview.",
  },
  {
    name: "Facu Montanaro",
    company: "Kundo Studio",
    country: "Argentina",
    image: "https://midday.ai/stories/facu.jpeg",
    content:
      "Managing invoicing, projects, and finances across tools slowed my daily work. Tamias brought everything into one place and made my workflow much simpler.",
  },
  {
    name: "Richard Poelderl",
    company: "Conduct",
    country: "Germany",
    image: "https://midday.ai/stories/richard.jpeg",
    content:
      "My previous accounting setup was fragmented and didn't support my bank. Tamias made invoicing easier and sharing clean data with my tax advisor straightforward.",
  },
  {
    name: "Guy Solan",
    company: "Thetis Medical",
    country: "United Kingdom",
    image: "https://midday.ai/stories/guy.jpeg",
    content:
      "Without Tamias, I had no real visibility into our cash and relied entirely on my accountant. It gave me clarity without having to learn complex accounting tools.",
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <HeroSection />
      <HowItWorksSection />
      <Divider />
      <FeaturesGridSection />
      <Divider />
      <TimeSavingsSection />
      <Divider />
      <PreAccountingSection />
      <Divider />
      <TestimonialsSection />
      <Divider />
      <IntegrationsSection />
      <Footer />
    </div>
  );
}

function Divider() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="h-px w-full border-t border-border" />
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between h-14">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <LogoSmallIcon className="w-6 h-6 text-foreground" />
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="font-sans text-sm text-foreground font-medium hover:opacity-80 transition-opacity"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Hero Section ────────────────────────────────────────────────────────────

function HeroSection() {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPosterLoaded, setIsPosterLoaded] = useState(false);
  const [isDashboardLoaded, setIsDashboardLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoad = () => setIsVideoLoaded(true);
    if (video.readyState >= 3) setIsVideoLoaded(true);
    video.addEventListener("canplay", handleLoad);
    video.addEventListener("loadeddata", handleLoad);
    return () => {
      video.removeEventListener("canplay", handleLoad);
      video.removeEventListener("loadeddata", handleLoad);
    };
  }, []);

  return (
    <div className="bg-background relative min-h-screen overflow-visible lg:overflow-hidden">
      <div className="flex flex-col min-h-screen relative pt-32 pb-12 sm:py-32 md:pt-24 lg:pt-0 overflow-hidden">
        {/* Header content */}
        <div className="flex-1 lg:flex-none flex flex-col justify-center md:justify-start md:pt-16 lg:pt-48 items-center space-y-8 lg:space-y-0 z-20 px-3 sm:px-4 lg:px-0 lg:max-w-[1400px] lg:mx-auto lg:w-full lg:mb-12 xl:mb-12 2xl:mb-12">
          <div className="flex flex-col items-center w-full text-center space-y-6 lg:space-y-8">
            <div className="space-y-5 lg:space-y-6 max-w-3xl mx-auto px-2 lg:px-0">
              <h1 className="font-serif text-3xl sm:text-3xl md:text-4xl lg:text-6xl xl:text-7xl 2xl:text-7xl leading-[1.1] tracking-tight text-foreground">
                The business stack for{" "}
                <em className="not-italic text-muted-foreground/80">
                  modern
                </em>{" "}
                founders
              </h1>

              <p className="text-muted-foreground text-base lg:text-lg leading-relaxed font-sans max-w-xl mx-auto">
                Send invoices, automatic reconciliation, track billable hours,
                get financial insights, and export clean books to your
                accountant.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center h-11 px-6 border border-border bg-primary text-primary-foreground text-sm font-sans hover:opacity-90 transition-colors"
              >
                Start your trial
              </Link>

              <p className="text-muted-foreground text-xs font-sans">
                14-day free trial &middot; Cancel anytime
              </p>
            </div>
          </div>
        </div>

        {/* Video + Dashboard preview section */}
        <div className="mt-8 mb-8 md:mt-12 lg:mt-0 lg:mb-4 overflow-visible lg:w-full">
          <div className="relative overflow-hidden">
            {/* Poster image with fade */}
            <div
              className={`absolute inset-0 w-full h-full transition-all duration-1000 ease-in-out z-[1] ${
                isVideoLoaded
                  ? "opacity-0 pointer-events-none"
                  : "opacity-100"
              }`}
              style={{
                filter: isVideoLoaded ? "blur(0px)" : "blur(1px)",
              }}
            >
              <img
                src="https://cdn.midday.ai/video-poster-v2.jpg"
                alt="Dashboard preview"
                className="w-full h-full object-cover transition-all duration-1000 ease-in-out"
                style={{
                  filter: isPosterLoaded ? "blur(0px)" : "blur(12px)",
                  transform: isPosterLoaded ? "scale(1)" : "scale(1.05)",
                }}
                onLoad={() => setIsPosterLoaded(true)}
              />
            </div>

            {/* Background Video */}
            <video
              ref={videoRef}
              className={`w-full h-[420px] sm:h-[520px] md:h-[600px] lg:h-[800px] xl:h-[900px] object-cover transition-opacity duration-1000 ease-in-out ${
                isVideoLoaded ? "opacity-100" : "opacity-0"
              }`}
              autoPlay
              loop
              muted
              playsInline
              preload="none"
            >
              <source
                src="https://cdn.midday.ai/videos/login-video.mp4"
                type="video/mp4"
              />
            </video>

            {/* Dashboard overlay */}
            <div className="absolute inset-0 flex items-center justify-center p-0 lg:p-4 z-[2]">
              <div className="relative lg:static scale-[0.95] md:scale-100 lg:scale-100 lg:h-full lg:flex lg:flex-col lg:items-center lg:justify-center">
                <img
                  src="https://midday.ai/images/dashboard-dark.svg"
                  alt="Dashboard illustration"
                  className="w-full h-auto lg:object-contain lg:max-w-[85%] 2xl:max-w-[75%] hidden dark:block transition-all duration-700 ease-out"
                  style={{
                    filter: isDashboardLoaded
                      ? "blur(0px) drop-shadow(0 30px 60px rgba(0,0,0,0.6))"
                      : "blur(20px)",
                    transform: isDashboardLoaded
                      ? "rotate(-2deg) skewY(1deg) scale(1)"
                      : "rotate(-2deg) skewY(1deg) scale(1.02)",
                  }}
                  onLoad={() => setIsDashboardLoaded(true)}
                />
                <img
                  src="https://midday.ai/images/dashboard-light.svg"
                  alt="Dashboard illustration"
                  className="w-full h-auto lg:object-contain lg:max-w-[85%] 2xl:max-w-[75%] dark:hidden transition-all duration-700 ease-out"
                  style={{
                    filter: isDashboardLoaded
                      ? "blur(0px) drop-shadow(0 30px 60px rgba(0,0,0,0.6))"
                      : "blur(20px)",
                    transform: isDashboardLoaded
                      ? "rotate(-2deg) skewY(1deg) scale(1)"
                      : "rotate(-2deg) skewY(1deg) scale(1.02)",
                  }}
                  onLoad={() => setIsDashboardLoaded(true)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────

function HowItWorksSection() {
  const [activeFeature, setActiveFeature] = useState(0);

  return (
    <section className="bg-background pt-12 sm:pt-2 lg:pt-6 xl:pt-8 2xl:pt-12 pb-20 lg:pb-24">
      <div className="max-w-[1400px] mx-auto">
        {/* Mobile: Stacked features */}
        <div className="grid grid-cols-1 gap-12 sm:gap-16 lg:hidden px-4">
          {features.map((feature, index) => (
            <div key={index} className="space-y-6 sm:space-y-8">
              <div className="space-y-2 text-center">
                <h2 className="font-serif text-2xl sm:text-2xl text-foreground max-w-md mx-auto">
                  {feature.title}
                </h2>
                <p className="font-sans text-base text-muted-foreground leading-normal max-w-md mx-auto">
                  <span className="sm:hidden">
                    {feature.mobileSubtitle || feature.subtitle}
                  </span>
                  <span className="hidden sm:inline">{feature.subtitle}</span>
                </p>
              </div>
              <div className="w-full border border-border overflow-hidden p-1 sm:p-3 relative">
                <div className="w-full h-[520px] sm:h-[620px] relative overflow-hidden flex items-center justify-center z-10">
                  <div className="w-full h-full origin-center scale-[0.85] sm:scale-[0.90] lg:scale-[0.95]">
                    <FeatureIllustration index={index} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: Two-column interactive */}
        <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 lg:h-[740px] px-4">
          <div className="flex gap-6">
            {/* Timeline */}
            <div className="flex flex-col justify-center items-center flex-shrink-0 relative">
              <div className="flex flex-col justify-center space-y-5 lg:space-y-6 mt-2 lg:mt-3">
                <div
                  className="flex items-center justify-center relative mb-4 lg:mb-6"
                  style={{ minHeight: "3rem" }}
                />
                {features.map((feature, index) => (
                  <div
                    key={feature.title}
                    className="flex items-start justify-center relative"
                    style={{ minHeight: "3.5rem" }}
                  >
                    <button
                      onClick={() => setActiveFeature(index)}
                      className="cursor-pointer relative z-10"
                      style={{ marginTop: "0.125rem" }}
                      type="button"
                      aria-label={`Go to feature: ${feature.title}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-none transition-all duration-200 ease-out ${
                          activeFeature === index
                            ? "bg-primary scale-[1.2]"
                            : "bg-border hover:bg-muted-foreground scale-100"
                        }`}
                      />
                    </button>
                    {index < features.length - 1 && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 w-px border-l border-border"
                        style={{
                          height: "calc(3.5rem + 1.25rem - 0.25rem)",
                          top: "0.375rem",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Text */}
            <div className="flex flex-col justify-center space-y-5 lg:space-y-6 flex-1">
              <div
                className="flex items-center mb-4 lg:mb-6"
                style={{ minHeight: "3rem" }}
              >
                <h2 className="font-serif text-2xl text-foreground">
                  How it works
                </h2>
              </div>
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`cursor-pointer transition-all duration-300 flex items-start ${
                    activeFeature === index
                      ? "opacity-100"
                      : "opacity-60 hover:opacity-80"
                  }`}
                  onClick={() => setActiveFeature(index)}
                  style={{ minHeight: "3rem" }}
                >
                  {activeFeature === index ? (
                    <div className="overflow-hidden animate-fade-blur-in">
                      <h2 className="font-sans text-lg lg:text-xl text-primary transition-colors duration-300 max-w-md">
                        {feature.title}
                      </h2>
                      <p className="font-sans text-sm text-primary leading-relaxed max-w-md mt-1">
                        {feature.subtitle}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <h2 className="font-sans text-lg lg:text-xl text-muted-foreground transition-colors duration-300 max-w-md">
                        {feature.title}
                      </h2>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Illustration panel */}
          <div className="flex items-center justify-center p-6 lg:p-8 border border-border h-full overflow-hidden relative bg-background">
            <div
              key={activeFeature}
              className="w-[600px] h-[700px] relative overflow-hidden z-10 flex items-center justify-center animate-fade-blur-in"
              style={{ transformOrigin: "center" }}
            >
              <div className="w-full h-full origin-center scale-[0.85] sm:scale-[0.90] lg:scale-[0.95]">
                <FeatureIllustration index={activeFeature} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Feature Illustrations ───────────────────────────────────────────────────

function FeatureIllustration({ index }: { index: number }) {
  const txData = [
    { name: "Office Supplies Co.", amount: "-45,20 kr", cat: "Office Supplies" },
    { name: "Cloud Services Inc.", amount: "-89,00 kr", cat: "Software" },
    { name: "Freelance Payment", amount: "+1 200,00 kr", cat: "Income" },
    { name: "Marketing Agency", amount: "-350,00 kr", cat: "Marketing" },
    { name: "Software Subscription", amount: "-29,99 kr", cat: "Software" },
    { name: "AWS", amount: "-54,30 kr", cat: "Infrastructure" },
    { name: "Stripe Payment", amount: "+850,00 kr", cat: "Income" },
    { name: "Figma", amount: "-24,00 kr", cat: "Software" },
    { name: "GitHub", amount: "-9,00 kr", cat: "Software" },
    { name: "Client Invoice", amount: "+8 500,00 kr", cat: "Income" },
  ];

  const invData = [
    { customer: "Acme Corp", amount: "$4,500.00", no: "#INV-001", status: "Paid" },
    { customer: "TechFlow Inc", amount: "$8,200.00", no: "#INV-002", status: "Scheduled" },
    { customer: "Design Studio", amount: "$3,100.00", no: "#INV-003", status: "Overdue" },
    { customer: "Cloud Services", amount: "$12,000.00", no: "#INV-004", status: "Paid" },
    { customer: "Data Systems", amount: "$6,750.00", no: "#INV-005", status: "Recurring" },
    { customer: "Media Works", amount: "$2,300.00", no: "#INV-006", status: "Paid" },
    { customer: "Creative Labs", amount: "$5,400.00", no: "#INV-007", status: "Paid" },
    { customer: "Digital Solutions", amount: "$9,100.00", no: "#INV-008", status: "Overdue" },
  ];

  const inboxData = [
    { name: "AWS-receipt.pdf", amount: "$54.30" },
    { name: "Figma-receipt.pdf", amount: "$24.00" },
    { name: "GitHub-receipt.pdf", amount: "$9.00" },
    { name: "Notion-receipt.pdf", amount: "$16.00" },
    { name: "Slack-receipt.pdf", amount: "$8.50" },
  ];

  if (index === 0) {
    return (
      <div className="w-full h-full flex flex-col bg-background border border-border overflow-hidden">
        <div className="flex gap-2 p-4 pb-2">
          {["All accounts", "Business", "Personal", "Savings"].map((tab, i) => (
            <div
              key={tab}
              className={`px-3 py-1.5 text-xs border border-border ${i === 0 ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
            >
              {tab}
            </div>
          ))}
        </div>
        <div className="flex-1 px-4 pb-4 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-[10px] text-muted-foreground border-b border-border py-2">
            <span>Description</span>
            <span>Amount</span>
            <span>Category</span>
          </div>
          {txData.map((tx, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center py-2.5 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-secondary border border-border flex-shrink-0" />
                <span className="text-xs text-foreground truncate">{tx.name}</span>
              </div>
              <span className={`text-xs ${tx.amount.startsWith("+") ? "text-foreground" : "text-muted-foreground"}`}>
                {tx.amount}
              </span>
              <span className="text-[10px] text-muted-foreground px-2 py-0.5 bg-secondary border border-border">
                {tx.cat}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="w-full h-full flex flex-col bg-background border border-border overflow-hidden">
        <div className="grid grid-cols-3 gap-3 p-4">
          <div className="border border-border p-3">
            <p className="text-[10px] text-muted-foreground">Open</p>
            <p className="text-lg font-sans text-foreground mt-1">$36,500<span className="text-xs text-muted-foreground">.75</span></p>
            <p className="text-[10px] text-muted-foreground">6 invoices</p>
          </div>
          <div className="border border-border p-3">
            <p className="text-[10px] text-muted-foreground">Overdue</p>
            <p className="text-lg font-sans text-foreground mt-1">$12,500<span className="text-xs text-muted-foreground">.50</span></p>
            <p className="text-[10px] text-muted-foreground">14 invoices</p>
          </div>
          <div className="border border-border p-3">
            <p className="text-[10px] text-muted-foreground">Paid</p>
            <p className="text-lg font-sans text-foreground mt-1">$152,825<span className="text-xs text-muted-foreground">.00</span></p>
            <p className="text-[10px] text-muted-foreground">21 invoices</p>
          </div>
        </div>
        <div className="px-4 flex items-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground">Payment score:</span>
          <span className="text-xs text-foreground font-medium">Good</span>
          <span className="text-[10px] text-muted-foreground">— Right on schedule</span>
        </div>
        <div className="flex-1 px-4 pb-4 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-[10px] text-muted-foreground border-b border-border py-2">
            <span>Customer</span>
            <span>Amount</span>
            <span>Invoice no.</span>
            <span>Status</span>
          </div>
          {invData.map((inv, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center py-2.5 border-b border-border last:border-0"
            >
              <span className="text-xs text-foreground">{inv.customer}</span>
              <span className="text-xs text-muted-foreground">{inv.amount}</span>
              <span className="text-[10px] text-muted-foreground">{inv.no}</span>
              <span className={`text-[10px] px-2 py-0.5 border border-border ${inv.status === "Overdue" ? "text-foreground" : "text-muted-foreground"}`}>
                {inv.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // index === 2: inbox
  return (
    <div className="w-full h-full flex flex-col bg-background border border-border overflow-hidden">
      <div className="p-4 pb-2">
        <div className="flex items-center gap-2 border border-border px-3 py-2">
          <span className="material-symbols-outlined text-muted-foreground" style={{ fontSize: 16 }}>search</span>
          <span className="text-xs text-muted-foreground">Search inbox...</span>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 px-4 pb-4">
          {inboxData.map((r, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
              <span className="text-xs text-foreground">{r.name}</span>
              <span className="text-xs text-muted-foreground">{r.amount}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2.5 bg-secondary -mx-4 px-4 border-b border-border">
            <span className="text-xs text-foreground">Stripe-receipt.pdf</span>
            <span className="text-xs text-foreground">$89.00</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-2">from: receipts@stripe.com</div>
        </div>
        <div className="w-[180px] border-l border-border p-3 flex flex-col gap-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Suggested match
          </p>
          <div className="border border-border p-2 bg-secondary">
            <p className="text-[10px] text-muted-foreground">Transaction</p>
            <p className="text-xs text-foreground mt-1">Stripe</p>
            <p className="text-xs text-muted-foreground">$89.00 · Sep 10</p>
          </div>
          <button
            type="button"
            className="w-full py-1.5 text-xs border border-border bg-primary text-primary-foreground hover:opacity-90 transition-colors"
          >
            Review
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Features Grid ───────────────────────────────────────────────────────────

function FeaturesGridSection() {
  return (
    <section className="bg-background py-12 sm:py-16 lg:py-24">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="text-center space-y-4 mb-10 sm:mb-12">
          <h2 className="font-serif text-2xl sm:text-2xl text-foreground">
            Everything you need to run your business
          </h2>
          <p className="hidden sm:block font-sans text-base text-muted-foreground leading-normal max-w-2xl mx-auto">
            Invoicing, transactions, time tracking, customers, and files — all
            connected in one system.
          </p>
        </div>

        <div className="flex flex-col gap-8 sm:gap-10 max-w-sm sm:max-w-none mx-auto">
          {[featureGridItems.slice(0, 4), featureGridItems.slice(4)].map(
            (row, rowIdx) => (
              <div
                key={rowIdx}
                className="grid grid-cols-2 gap-6 sm:flex sm:justify-center sm:gap-20"
              >
                {row.map((item) => (
                  <div
                    key={item.title}
                    className="flex flex-col items-center w-full sm:w-[150px]"
                  >
                    <div className="bg-secondary border border-border w-[60px] h-[60px] flex items-center justify-center rounded-none mb-4 hover:border-muted-foreground transition-all duration-200">
                      <span
                        className="material-symbols-outlined text-muted-foreground"
                        style={{
                          fontSize: 24,
                          fontVariationSettings:
                            "'FILL' 0, 'wght' 300",
                        }}
                      >
                        {item.icon}
                      </span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <h3 className="font-sans text-sm text-foreground leading-[21px]">
                        {item.title}
                      </h3>
                      <p className="font-sans text-sm text-muted-foreground leading-[21px]">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Time Savings ────────────────────────────────────────────────────────────

function TimeSavingsSection() {
  return (
    <section className="bg-background py-12 sm:py-16 lg:py-24">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="font-serif text-2xl sm:text-2xl text-foreground">
            Less admin. More focus.
          </h2>
          <p className="hidden sm:block font-sans text-base text-muted-foreground leading-normal max-w-2xl mx-auto">
            Tamias removes manual work so you can spend time on what actually
            matters.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {painPoints.slice(0, 3).map((point, i) => (
              <article
                key={point.label}
                className={`group relative overflow-hidden bg-background border border-border p-4 sm:p-5 hover:bg-secondary hover:border-muted-foreground transition-all duration-200 cursor-pointer ${i === 2 ? "hidden xl:block" : ""}`}
              >
                <div className="min-w-0">
                  <p className="hidden sm:block text-xs tracking-wide text-muted-foreground">
                    {point.label}
                  </p>
                  <h3 className="mt-1 text-base sm:text-lg text-foreground">
                    {point.time}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {point.description}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-10 gap-3 sm:gap-4">
            <article className="group relative overflow-hidden bg-background border border-border p-4 sm:p-5 hover:bg-secondary hover:border-muted-foreground transition-all duration-200 xl:col-span-3">
              <div className="min-w-0">
                <p className="hidden sm:block text-xs tracking-wide text-muted-foreground">
                  {painPoints[3]!.label}
                </p>
                <h3 className="mt-1 text-base sm:text-lg text-foreground">
                  {painPoints[3]!.time}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {painPoints[3]!.description}
                </p>
              </div>
            </article>

            <article className="group relative overflow-hidden bg-background border border-border p-4 sm:p-5 hover:bg-secondary hover:border-muted-foreground transition-all duration-200 cursor-pointer xl:hidden">
              <div className="min-w-0">
                <p className="hidden sm:block text-xs tracking-wide text-muted-foreground">
                  {painPoints[2]!.label}
                </p>
                <h3 className="mt-1 text-base sm:text-lg text-foreground">
                  {painPoints[2]!.time}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {painPoints[2]!.description}
                </p>
              </div>
            </article>

            <Link
              href="/login"
              className="relative overflow-hidden bg-secondary border border-border p-4 sm:p-5 md:p-5 lg:p-6 transition-all duration-200 group hidden xl:block xl:col-span-7 hover:border-muted-foreground"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <p className="hidden sm:block text-xs tracking-wide text-muted-foreground">
                    <span className="group-hover:hidden">As things add up</span>
                    <span className="hidden group-hover:inline">What changes</span>
                  </p>
                  <p className="mt-1 text-base sm:text-lg text-foreground">
                    <span className="group-hover:hidden">What disappears over time</span>
                    <span className="hidden group-hover:inline">Get your time back</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="group-hover:hidden">Manual work caused by disconnected tools.</span>
                    <span className="hidden group-hover:inline">Tamias handles the busywork so you can focus on running the business.</span>
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-4xl sm:text-5xl text-foreground">4–6 hours</div>
                </div>
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:hidden">
            <Link
              href="/login"
              className="relative overflow-hidden bg-secondary border border-border p-4 sm:p-5 md:p-5 lg:p-6 transition-all duration-200 hover:border-muted-foreground"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <p className="hidden sm:block text-xs tracking-wide text-muted-foreground">As things add up</p>
                  <p className="mt-1 text-base sm:text-lg text-foreground">What disappears over time</p>
                  <p className="mt-1 text-sm text-muted-foreground">Manual work caused by disconnected tools.</p>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-4xl sm:text-5xl text-foreground">4–6 hours</div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Pre-accounting ──────────────────────────────────────────────────────────

function PreAccountingSection() {
  return (
    <section className="bg-background py-12 sm:py-16 lg:py-24">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <div className="h-[100px] w-28 mx-auto mb-8 relative">
            <img
              src="https://midday.ai/images/accounting-dark.png"
              alt="Accounting"
              className="w-full h-full object-contain hidden dark:block"
            />
            <img
              src="https://midday.ai/images/accounting-light.png"
              alt="Accounting"
              className="w-full h-full object-contain dark:hidden"
            />
          </div>
          <h2 className="font-serif text-2xl sm:text-2xl text-foreground">
            Ready for accounting, without extra work
          </h2>
          <p className="hidden sm:block font-sans text-base text-muted-foreground leading-normal max-w-2xl mx-auto">
            Receipts, invoices, and transactions stay organized automatically so
            your books are always ready when you need them.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-secondary border border-border p-6 relative">
            <div className="space-y-6">
              {accountingChecklist.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-foreground" style={{ fontSize: 14, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>check</span>
                  </div>
                  <span className="font-sans text-sm text-foreground">
                    <span className="sm:hidden">{item.short}</span>
                    <span className="hidden sm:inline">{item.full}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ────────────────────────────────────────────────────────────

function TestimonialsSection() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section className="bg-background">
      <div className="max-w-[1400px] mx-auto py-12 sm:py-16 lg:py-24 px-4">
        <div className="flex flex-col gap-4 items-center">
          <div className="flex flex-col gap-4 items-center text-center max-w-3xl">
            <h2 className="font-serif text-2xl sm:text-2xl text-foreground">
              Built alongside our users
            </h2>
            <p className="hidden sm:block font-sans text-base text-muted-foreground leading-normal">
              Every feature is shaped by the people who use it every day.
            </p>
          </div>

          <div className="flex items-center justify-center mb-6 sm:mb-10">
            <div className="flex gap-1">
              {[...Array(4)].map((_, i) => (
                <span key={i} className="material-symbols-outlined text-muted-foreground" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>star</span>
              ))}
              <span className="material-symbols-outlined text-muted-foreground" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>star_half</span>
            </div>
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden lg:flex gap-3 w-full max-w-5xl mx-auto justify-center">
          {testimonials.map((t, index) => {
            const rotations = [-1, 1, 2, -2];
            const rotation = rotations[index] ?? 0;
            return (
              <div
                key={t.name}
                className="flex-shrink-0 group"
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                <div className="bg-background border border-border p-6 w-64 flex flex-col gap-4 transition-all duration-200 hover:border-muted-foreground">
                  <div className="flex flex-col gap-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider text-left">
                      {t.country}
                    </p>
                    <div className="flex gap-2 items-center">
                      <img
                        src={t.image}
                        alt={t.name}
                        className="w-4 h-4 rounded-full object-cover"
                        style={{ filter: "grayscale(100%)" }}
                      />
                      <span className="font-sans text-sm text-foreground">
                        {t.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-left">
                    <span className="font-sans text-sm text-muted-foreground">
                      {t.company}
                    </span>
                    <div className="font-sans text-sm text-muted-foreground leading-relaxed">
                      &quot;{t.content}&quot;
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Carousel */}
        <div className="lg:hidden w-screen -mx-4 pl-4">
          <div
            ref={scrollRef}
            className="overflow-x-auto scroll-smooth snap-x snap-mandatory py-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="flex gap-4 pl-4 pr-4" style={{ width: "max-content" }}>
              {testimonials.map((t, index) => {
                const rotations = [-1, 0, 1, -2];
                const rotation = rotations[index] ?? 0;
                return (
                  <div key={t.name} className="w-[280px] flex-shrink-0 snap-start">
                    <div
                      className="bg-background border border-border p-8 sm:p-6 flex flex-col gap-4 select-none hover:border-muted-foreground transition-all duration-200 min-h-[240px] sm:min-h-0"
                      style={{ transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined }}
                    >
                      <div className="flex flex-col gap-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider text-left">
                          {t.country}
                        </p>
                        <div className="flex gap-2 items-center">
                          <img
                            src={t.image}
                            alt={t.name}
                            className="w-4 h-4 rounded-full object-cover"
                            style={{ filter: "grayscale(100%)" }}
                          />
                          <span className="font-sans text-sm text-foreground">{t.name}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 text-left">
                        <span className="font-sans text-sm text-muted-foreground">{t.company}</span>
                        <div className="font-sans text-sm text-muted-foreground leading-relaxed">
                          &quot;{t.content}&quot;
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Integrations Marquee ────────────────────────────────────────────────────

const integrationRow1 = [
  "Gmail", "Outlook", "Slack", "Telegram", "QuickBooks", "Xero",
  "Fortnox", "Stripe", "Linear", "Jira", "Asana", "HubSpot",
  "Notion", "GitHub", "Google Drive", "Figma", "Shopify",
];
const integrationRow2 = [
  "Salesforce", "Pipedrive", "Calendly", "Zoom", "Intercom",
  "Zendesk", "Dropbox", "Trello", "Monday.com", "ClickUp",
  "Google Analytics", "Mailchimp", "Webflow", "Airtable",
  "FreshBooks", "Square", "DocuSign",
];

function IntegrationsSection() {
  return (
    <section className="bg-background py-12 sm:py-16 lg:py-24">
      <div className="max-w-[1400px] mx-auto">
        <div className="text-center space-y-4 mb-10 px-4">
          <h2 className="font-serif text-2xl sm:text-2xl text-foreground">
            Works with the tools you already use
          </h2>
          <p className="hidden sm:block font-sans text-base text-muted-foreground leading-normal">
            Connect your banks, email, payments and accounting software in
            minutes.
          </p>
        </div>

        {/* Animated pill rows */}
        <div className="relative overflow-hidden group/integrations">
          {/* Gradient masks */}
          <div
            className="absolute inset-y-0 left-0 w-24 sm:w-32 z-10 pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, hsl(var(--background)) 0%, hsl(var(--background)) 30%, hsla(var(--background), 0.8) 50%, hsla(var(--background), 0.4) 70%, transparent 100%)",
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-24 sm:w-32 z-10 pointer-events-none"
            style={{
              background:
                "linear-gradient(to left, hsl(var(--background)) 0%, hsl(var(--background)) 30%, hsla(var(--background), 0.8) 50%, hsla(var(--background), 0.4) 70%, transparent 100%)",
            }}
          />

          <div className="space-y-3">
            {/* Row 1 - moves left */}
            <div className="flex animate-marquee-left group-hover/integrations:[animation-play-state:paused] will-change-transform">
              {[0, 1].map((dup) => (
                <div key={dup} className="flex gap-2 shrink-0 pr-2" aria-hidden={dup === 1 ? "true" : undefined}>
                  {integrationRow1.map((name) => (
                    <div
                      key={`${dup}-${name}`}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background whitespace-nowrap hover:border-foreground/20 transition-colors"
                    >
                      <div className="w-4 h-4 bg-secondary border border-border rounded-full flex-shrink-0" />
                      <span className="font-sans text-sm text-foreground">{name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Row 2 - moves right */}
            <div className="flex animate-marquee-right group-hover/integrations:[animation-play-state:paused] will-change-transform">
              {[0, 1].map((dup) => (
                <div key={dup} className="flex gap-2 shrink-0 pr-2" aria-hidden={dup === 1 ? "true" : undefined}>
                  {integrationRow2.map((name) => (
                    <div
                      key={`${dup}-${name}`}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background whitespace-nowrap hover:border-foreground/20 transition-colors"
                    >
                      <div className="w-4 h-4 bg-secondary border border-border rounded-full flex-shrink-0" />
                      <span className="font-sans text-sm text-foreground">{name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-background relative overflow-hidden">
      <div className="h-px w-full border-t border-border" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-16 sm:pb-80">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-16">
          {/* Links */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 md:grid-cols-4 sm:gap-x-8 sm:gap-y-12 lg:col-span-1">
            <div className="space-y-3">
              <h3 className="font-sans text-sm text-foreground mb-4">Features</h3>
              <div className="space-y-2.5">
                {["Invoicing", "Transactions", "Inbox", "Time tracking", "Customers", "Files", "Exports"].map((item) => (
                  <span key={item} className="font-sans text-sm text-muted-foreground block">{item}</span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-sans text-sm text-foreground mb-4">Product</h3>
              <div className="space-y-2.5">
                {["Pricing", "Download", "Pre-accounting", "Integrations", "Customer Stories"].map((item) => (
                  <span key={item} className="font-sans text-sm text-muted-foreground block">{item}</span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-sans text-sm text-foreground mb-4">Company</h3>
              <div className="space-y-2.5">
                {["Story", "Updates"].map((item) => (
                  <span key={item} className="font-sans text-sm text-muted-foreground block">{item}</span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-sans text-sm text-foreground mb-4">Resources</h3>
              <div className="space-y-2.5">
                {["Support", "Privacy Policy", "Terms of Service"].map((item) => (
                  <span key={item} className="font-sans text-sm text-muted-foreground block">{item}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex flex-col items-start lg:items-end gap-6 lg:gap-10">
            <p className="font-sans text-base sm:text-xl text-foreground text-left lg:text-right">
              Run your company. Not the admin.
            </p>
          </div>
        </div>

        <div className="my-16">
          <div className="h-px w-full border-t border-border" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoSmallIcon className="w-5 h-5 text-muted-foreground" />
            <span className="font-sans text-sm text-muted-foreground">Tamias</span>
          </div>
          <p className="font-sans text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Tamias. All rights reserved.
          </p>
        </div>
      </div>

      {/* Large Wordmark */}
      <div className="absolute bottom-0 left-0 sm:left-1/2 sm:transform sm:-translate-x-1/2 translate-y-[25%] sm:translate-y-[40%] bg-background overflow-hidden">
        <h1
          className="font-sans text-[200px] sm:text-[508px] leading-none select-none text-secondary"
          style={{
            WebkitTextStroke: "1px hsl(var(--muted-foreground))",
            color: "hsl(var(--secondary))",
          }}
        >
          tamias
        </h1>
      </div>
    </footer>
  );
}
