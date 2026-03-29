"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { DropdownMenuItem } from "@tamias/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOut() {
  const [isLoading, setLoading] = useState(false);
  const { signOut } = useAuthActions();
  const router = useRouter();

  const handleSignOut = async () => {
    setLoading(true);

    await signOut();

    router.push("/login");
  };

  return (
    <DropdownMenuItem className="text-xs" onClick={handleSignOut}>
      {isLoading ? "Loading..." : "Sign out"}
    </DropdownMenuItem>
  );
}
