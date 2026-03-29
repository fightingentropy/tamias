"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@tamias/ui/button";

export function SignOutButton() {
  const { signOut } = useAuthActions();

  return (
    <Button variant="outline" className="w-full" onClick={() => void signOut()}>
      Sign out
    </Button>
  );
}
