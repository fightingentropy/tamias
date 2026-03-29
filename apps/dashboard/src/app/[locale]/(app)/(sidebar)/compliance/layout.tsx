import { SecondaryMenu } from "@/components/secondary-menu";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[960px]">
      <SecondaryMenu
        items={[
          { path: "/compliance", label: "Overview" },
          { path: "/compliance/vat", label: "VAT" },
          { path: "/compliance/settings", label: "Settings" },
          { path: "/compliance/year-end", label: "Year-end" },
          { path: "/compliance/payroll", label: "Payroll" },
        ]}
      />

      <main className="mt-8">{children}</main>
    </div>
  );
}
