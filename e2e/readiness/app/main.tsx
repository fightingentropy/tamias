import { createRoot } from "react-dom/client";
import { useState } from "react";
import { PrivacyPage } from "../../../dashboard/src/components/public/privacy-page";
import { TermsPage } from "../../../dashboard/src/components/public/terms-page";
import { SupportPage } from "../../../dashboard/src/components/public/support-page";
import { collectHmrcBrowserTelemetry } from "../../../dashboard/src/utils/hmrc-fraud-telemetry";
import { Editor } from "../../../packages/ui/src/components/editor";
import "@tamias/ui/globals.css";

function EditorProbe() {
  const [value, setValue] = useState("");
  const [telemetry, setTelemetry] = useState("");
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <h1 className="font-serif text-3xl">Local security checks</h1>
      <p>Synthetic editor and browser telemetry preview. No live account or API connection.</p>
      <Editor
        initialContent="<p>Example invoice description</p>"
        onUpdate={(editor) => setValue(JSON.stringify(editor.getJSON()))}
      />
      <output aria-label="Editor content">{value}</output>
      <button
        onClick={() =>
          setTelemetry(decodeURIComponent(collectHmrcBrowserTelemetry() ?? "unavailable"))
        }
      >
        Collect browser data
      </button>
      <pre className="whitespace-pre-wrap break-all" aria-label="Collected browser data">
        {telemetry}
      </pre>
    </main>
  );
}
const page = location.pathname;
createRoot(document.getElementById("root")!).render(
  page === "/terms" ? (
    <TermsPage />
  ) : page === "/support" ? (
    <SupportPage />
  ) : page === "/checks" ? (
    <EditorProbe />
  ) : (
    <PrivacyPage />
  ),
);
