"use client";

import type { AIProvider } from "@tamias/domain/identity";
import { Button } from "@tamias/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tamias/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tamias/ui/select";
import Link from "@/framework/link";
import { useUserMutation, useUserQuery } from "@/hooks/use-user";

const providerOptions: Array<{
  value: AIProvider;
  label: string;
  description: string;
}> = [
  {
    value: "openai",
    label: "OpenAI",
    description: "Default assistant provider for chat and report analysis.",
  },
  {
    value: "kimi",
    label: "Kimi",
    description:
      "Moonshot/Kimi via its OpenAI-compatible API. Requires KIMI_API_KEY on the API service.",
  },
];

export function AssistantProviderSettings() {
  const { data: user } = useUserQuery();
  const updateUserMutation = useUserMutation();
  const selectedProvider =
    providerOptions.find((option) => option.value === user.aiProvider) ??
    providerOptions[0]!;

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <CardHeader>
          <CardTitle>Assistant Provider</CardTitle>
          <CardDescription>
            Choose which model provider powers new chat requests.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-2 lg:self-center">
          <Select
            value={selectedProvider.value}
            onValueChange={(value) => {
              updateUserMutation.mutate({ aiProvider: value as AIProvider });
            }}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {providerOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="max-w-[320px] text-xs text-muted-foreground">
            {selectedProvider.description}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation Integrations</CardTitle>
          <CardDescription>
            Launch the existing OpenCode and Make MCP integrations from
            settings.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/apps?app=opencode-mcp">OpenCode</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/apps?app=make-mcp">Make</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
