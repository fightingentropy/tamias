"use client";

import { Button } from "@tamias/ui/button";
import { useAuthActions } from "@/framework/auth-client";
import { useRouter } from "@/framework/navigation";

export function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={() => {
        void signOut().then(() => {
          router.push("/login");
        });
      }}
    >
      Sign out
    </Button>
  );
}
