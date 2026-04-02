"use client";

import { ChatGPTMcpLogo } from "@tamias/app-store/logos";
import { Icons } from "@tamias/ui/icons";
import { Input } from "@tamias/ui/input";
import Link from "@/framework/link";
import { useMemo, useState } from "react";
import { highlight } from "sugar-high";

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const codeHTML = highlight(code);

  return (
    <div className="relative group">
      <div className="bg-[#fafafa] dark:bg-[#0c0c0c] border border-border rounded-none overflow-hidden">
        <pre className="overflow-x-auto p-4 text-sm font-mono">
          <code dangerouslySetInnerHTML={{ __html: codeHTML }} />
        </pre>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 bg-background/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground hover:bg-background transition-colors opacity-0 group-hover:opacity-100 rounded-none"
        aria-label="Copy code"
      >
        {copied ? (
          <Icons.Check size={14} className="text-foreground" />
        ) : (
          <Icons.Copy size={14} />
        )}
      </button>
    </div>
  );
}

export function MCPChatGPT() {
  const [apiKey, setApiKey] = useState("");

  const developerConfig = useMemo(() => {
    const key = apiKey || "YOUR_API_KEY";
    return JSON.stringify(
      {
        mcpServers: {
          tamias: {
            command: "npx",
            args: [
              "-y",
              "mcp-remote@latest",
              "https://api.tamias.xyz/mcp",
              "--header",
              // biome-ignore lint/suspicious/noTemplateCurlyInString: Intentional shell variable reference in MCP config
              "Authorization:${AUTH_HEADER}",
            ],
            env: {
              AUTH_HEADER: `Bearer ${key}`,
            },
          },
        },
      },
      null,
      2,
    );
  }, [apiKey]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-background">
        <div className="pt-32 pb-16 sm:pt-40 sm:pb-20 md:pt-48 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto">
            {/* Back Link */}
            <Link
              href="/mcp"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 font-sans text-sm"
            >
              <Icons.ChevronLeft size={16} />
              All clients
            </Link>

            {/* Logo and Title */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 [&>img]:w-full [&>img]:h-full">
                <ChatGPTMcpLogo />
              </div>
              <div>
                <p className="font-sans text-xs text-muted-foreground uppercase tracking-wider">
                  MCP Server
                </p>
                <h1 className="font-serif text-3xl sm:text-4xl text-foreground">
                  ChatGPT
                </h1>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-4 mb-8">
              <h2 className="font-serif text-xl sm:text-2xl text-foreground">
                Financial data in ChatGPT
              </h2>
              <p className="font-sans text-base text-muted-foreground leading-relaxed">
                ChatGPT supports MCP servers in developer mode. Connect
                Tamias to query your transactions, invoices, and reports
                directly in ChatGPT conversations.
              </p>
            </div>

            {/* Requirements */}
            <div className="bg-secondary border border-border p-4 mb-8">
              <p className="font-sans text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  Requirements:
                </span>{" "}
                ChatGPT Pro, Plus, Business, Enterprise, or Education account.
                Enable developer mode in{" "}
                <span className="font-medium">
                  Settings → Apps → Advanced settings
                </span>
                .
              </p>
            </div>

            {/* API Key Input */}
            <div className="space-y-4 mb-8">
              <div className="space-y-2">
                <label
                  htmlFor="api-key"
                  className="font-sans text-sm text-foreground"
                >
                  Your API key
                </label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="mid_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="font-sans text-xs text-muted-foreground">
                  Don't have an API key?{" "}
                  <Link
                    href="https://tamias.xyz/settings/developer"
                    className="underline hover:text-foreground"
                  >
                    Create one in Settings → Developer
                  </Link>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="font-sans text-sm text-muted-foreground">
                Create an MCP app in ChatGPT with this configuration:
              </p>
              <CodeBlock code={developerConfig} />
              <p className="font-sans text-xs text-muted-foreground">
                Uses{" "}
                <a
                  href="https://www.npmjs.com/package/mcp-remote"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  mcp-remote
                </a>{" "}
                to bridge bearer token authentication (installed automatically
                via `npx`).
              </p>
            </div>

            {/* Steps */}
            <div className="mt-12 space-y-4">
              <h3 className="font-sans text-sm font-medium text-foreground">
                Setup steps
              </h3>
              <ol className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-secondary border border-border flex items-center justify-center font-mono text-xs text-muted-foreground">
                    1
                  </span>
                  <span className="font-sans text-sm text-muted-foreground pt-0.5">
                    Get an API key from{" "}
                    <Link
                      href="https://tamias.xyz/settings/developer"
                      className="underline hover:text-foreground"
                    >
                      Settings → Developer
                    </Link>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-secondary border border-border flex items-center justify-center font-mono text-xs text-muted-foreground">
                    2
                  </span>
                  <span className="font-sans text-sm text-muted-foreground pt-0.5">
                    Enable developer mode in Settings → Apps → Advanced settings
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-secondary border border-border flex items-center justify-center font-mono text-xs text-muted-foreground">
                    3
                  </span>
                  <span className="font-sans text-sm text-muted-foreground pt-0.5">
                    Create a new MCP app with the config above
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
