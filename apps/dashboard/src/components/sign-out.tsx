"use client";

import { DropdownMenuItem } from "@tamias/ui/dropdown-menu";
import { useAuthActions } from "@/framework/auth-client";
import { useRouter } from "@/framework/navigation";
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
