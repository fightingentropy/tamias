"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tamias/ui/card";

type Props = {
  title: string;
  description: string;
  bullets: string[];
};

export function ComplianceComingSoon({ title, description, bullets }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-[#606060]">
          {bullets.map((bullet) => (
            <li key={bullet} className="rounded-lg border px-4 py-3">
              {bullet}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
