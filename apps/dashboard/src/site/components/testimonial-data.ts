export interface Testimonial {
  name: string;
  title: string;
  company: string;
  country: string;
  content: string;
  fullContent: string;
  image?: string;
  video?: string;
  videoPoster?: string;
}

const isabelSa: Testimonial = {
  name: "Isabel Sá",
  title: "",
  company: "Character",
  country: "Portugal",
  content:
    "I find myself having a better sense of runway and financials than before. The auto-reconciliation of payments and receipts is a game changer.",
  fullContent:
    "Company\nCharacter is a software design studio.\n\nChallenge\nGetting the big picture across banks and currencies. We have both Portuguese and Belgian bank accounts, and reconciling these two was always difficult. There was no easy way to see everything in one place.\n\nImpact\nA much better sense of runway and financials than before. Both bigger picture things like tax breakdowns, and smaller things like keeping an eye on expenses and removing unused subscriptions. The accounting team just logs in to Tamias to grab what they need.\n\nFavorite features\nInbox and Transactions. The transactions tab was already a major upgrade from the previous workflow in Excel, but the auto-reconciliation of payments and receipts is a game changer. Drastically reduced time spent on it. We're also in the process of migrating invoicing to Tamias to get the full network effect.",
};

const ciaranHarris: Testimonial = {
  name: "Ciarán Harris",
  title: "",
  company: "CogniStream",
  country: "Ireland",
  image: "/stories/ciaran.jpeg",
  content:
    "Financial admin stopped being a source of friction. Tamias actually works the way you'd expect modern software to work.",
  fullContent:
    "Company\nCogniStream is an AI-moderated qualitative research platform. We have natural voice conversations with customers, analyse not just what they say but how they feel when they say it, and help businesses make confident decisions faster. I'm Ciarán Harris, CEO and Co-Founder, a two-time founder with over 25 years of research experience for global giants.\n\nChallenge\nI tried using Xero. It couldn't connect to my bank account reliably, the interface felt like it hadn't been updated in a decade, and just getting up and running was painful. It never worked out of the box. The real kicker? My accountant also used Xero, but he preferred I send him everything as a CSV anyway. That completely negated the point. As a founder, you need financial admin to just work so you can focus on building the business. It wasn't working.\n\nImpact\nFinancial admin stopped being a source of friction. Tamias actually works the way you'd expect modern software to work. I check in every few days to keep on top of things, and every few weeks I'll do a more involved session to get through receipt scanning and matching ahead of VAT returns. It removed the single biggest pain point from my week-to-week financial admin, and everything else it does is a genuinely useful bonus on top of that.\n\nFavorite features\nReceipt scanning and matching, without question. That's the feature that removes the most friction from running the business day to day. Before, receipts were scattered and matching them to transactions was tedious. Now it's handled. That one feature alone justified the switch. The AI assistant is a nice bonus too, being able to ask a natural language question about your finances and get detailed results is genuinely useful.",
};

const vitalieRosescu: Testimonial = {
  name: "Vitalie Rosescu",
  title: "",
  company: "Awwwocado",
  country: "Netherlands",
  image: "/stories/vitalie.jpg",
  content:
    "All in one platform for freelancers looking to create clear insights on income and expenses.",
  fullContent:
    "Company\nAwwwocado is a Webflow development business.\n\nChallenge\nWhat I lacked in other software is the overview of which invoices were paid and which were pending, and seeing my overall income. Existing tools didn't give a clear picture of finances.\n\nImpact\nHaving a clear overview of income, invoices, and expenses in one place made managing the business much easier.\n\nFavorite features\nInvoices, because it's a big time saver.\nA clean share link for customers is very nice.\nExpenses being taken from my inbox and being able to upload expenses is a huge one.\nThe invoice template is clean out of the box and very customizable.",
};

const pawelMichalski: Testimonial = {
  name: "Paweł Michalski",
  title: "",
  company: "VC Leaders",
  country: "Poland",
  image: "/stories/pawel.jpeg",
  content:
    "Invoice reconciliation used to take a full day each month and was always stressful. With Tamias, that work is mostly gone and we finally have a clear financial overview.",
  fullContent:
    "Company\nVC Leaders is an educational platform helping venture capitalists build better VC firms.\n\nChallenge\nMonthly invoice reconciliation was slow and painful. Missing invoices, manual checks, and no time left to properly categorize or analyze spending. The process regularly took more than a full day.\n\nImpact\nHMRC reduced invoice reconciliation time by 1–2 man-days per month and made financial visibility much clearer through dashboards.\n\nFavorite features\nClear financial overview, accounts payable tracking, invoice reconciliation, and a clean, intuitive interface.",
};

const facuMontanaro: Testimonial = {
  name: "Facu Montanaro",
  title: "",
  company: "Kundo Studio",
  country: "Argentina",
  image: "/stories/facu.jpeg",
  content:
    "Managing invoicing, projects, and finances across tools slowed my daily work. Tamias brought everything into one place and made my workflow much simpler.",
  fullContent:
    "Company\nKundo Studio helps startups and founders with fundraising, product launches, and growth through design and meaningful experiences.\n\nChallenge\nManaging invoicing, projects, and finances across multiple tools made daily work slower and more complex. Existing tools felt fragmented and hard to use.\n\nImpact\nHMRC centralized invoicing, time tracking, and project information into one place, significantly simplifying day-to-day operations.\n\nFavorite features\nInvoicing and time tracking. Both became core parts of Facu's daily workflow and replaced multiple separate tools.",
};

const nickSpeer: Testimonial = {
  name: "Nick Speer",
  title: "",
  company: "Speer Technologies",
  country: "United States",
  image: "/stories/speer.jpeg",
  content:
    "Tamias is bookkeeping software without the fluff. It's a ledger with modern tooling and integrations.",
  fullContent:
    "Company\nSpeer Technologies is an AI consulting firm in the US. We accelerate our clients' AI initiatives from problem discovery to production across industries including Finance, Healthcare, and Defense.\n\nChallenge\nI was spending too much time on weekends cleaning up my books, juggling invoices, and clicking around clunky software. It felt like another job, and the other solutions didn't work the way I wanted.\n\nImpact\nAfter switching from QuickBooks to Tamias, it felt like I was in control of my books. I could see every transaction and expense as it came in and manage it without feeling overwhelmed.\n\nFavorite features\nAuto-categorization is far better than other programs, which saves time from manually organizing books. From there, I can export data and get insights into exact spending categories.",
};

const richardPoelderl: Testimonial = {
  name: "Richard Poelderl",
  title: "",
  company: "Conduct",
  country: "Germany",
  image: "/stories/richard.jpeg",
  content:
    "My previous accounting setup was fragmented and didn't support my bank. Tamias made invoicing easier and sharing clean data with my tax advisor straightforward.",
  fullContent:
    "Company\nRichard works with companies that want to focus product development on building great products while outsourcing growth and marketing execution.\n\nChallenge\nHis accounting tool didn't support his bank, required manual formatting of exports, and forced him to juggle multiple financial tools.\n\nImpact\nHMRC replaced bank invoicing and made it easier to work with his tax advisor by exporting clean CSV files that integrate with accounting software. This significantly reduced friction while keeping control in one system.\n\nFavorite features\nInvoicing, CSV exports for tax advisors, and bank sync to track subscriptions and expenses.",
};

const ivoDukov: Testimonial = {
  name: "Ivo Dukov",
  title: "",
  company: "Smarch",
  country: "Bulgaria",
  content:
    "Everything lives in one place now — customers, invoices, documents, and financial analytics.",
  fullContent:
    "Company\nSmarch is a software development agency specializing in e-commerce, web applications, and custom backend systems.\n\nChallenge\nBefore Tamias, I was manually creating PDF invoices, piecing together bank reports to understand how the company was doing, and collecting financial documents every time accounting needed something. It was scattered and tedious.\n\nImpact\nEverything lives in one place now. I set up invoice templates once, have all clients organized, get real analytics on company performance, and keep documents in a proper vault. What used to take hours of admin work is now streamlined and mostly automatic.\n\nFavorite features\nInvoice templates. They eliminate repetitive work when billing multiple clients.",
};

const guySolan: Testimonial = {
  name: "Guy Solan",
  title: "",
  company: "Thetis Medical",
  country: "United Kingdom",
  image: "/stories/guy.jpeg",
  content:
    "Without Tamias, I had no real visibility into our cash and relied entirely on my accountant. It gave me clarity without having to learn complex accounting tools.",
  fullContent:
    "Company\nThetis Medical is a medical device company.\n\nChallenge\nWithout Tamias, I had no real visibility into our cash and relied entirely on my accountant.\n\nImpact\nHMRC gave me clarity without having to learn complex accounting tools.\n\nFavorite features\nFinancial visibility and cash flow tracking.",
  video:
    "https://customer-oh6t55xltlgrfayh.cloudflarestream.com/5b86803383964d52ee6834fd289f4f4e/manifest/video.m3u8",
  videoPoster: "https://cdn.tamias.xyz/guy-cover.png",
};

export const defaultTestimonials: Testimonial[] = [
  pawelMichalski,
  facuMontanaro,
  richardPoelderl,
  guySolan,
];

export const allTestimonials: Testimonial[] = [
  isabelSa,
  ciaranHarris,
  vitalieRosescu,
  pawelMichalski,
  facuMontanaro,
  nickSpeer,
  richardPoelderl,
  ivoDukov,
  guySolan,
];
