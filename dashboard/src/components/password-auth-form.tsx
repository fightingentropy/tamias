"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@tamias/ui/cn";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@tamias/ui/form";
import { Input } from "@tamias/ui/input";
import { Spinner } from "@tamias/ui/spinner";
import { SubmitButton } from "@tamias/ui/submit-button";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v3";
import { useAuthActions } from "@/framework/auth-client";
import { useSearchParams } from "@/framework/navigation";
import { getPasswordAuthErrorMessage } from "@/utils/password-auth-errors";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type PasswordAuthFormProps = {
  className?: string;
};

export function PasswordAuthForm({ className }: PasswordAuthFormProps) {
  const searchParams = useSearchParams();
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = useMemo(() => {
    const returnTo = searchParams.get("return_to");

    return returnTo ? `/${returnTo.replace(/^\/+/, "")}` : "/";
  }, [searchParams]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("password", {
        ...values,
        flow: mode,
      });

      if (result?.signingIn) {
        window.location.replace(redirectTo);
      }
    } catch (authError) {
      setError(getPasswordAuthErrorMessage(authError, mode));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
        <div className={cn("flex flex-col space-y-4", className)}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    placeholder="you@company.com"
                    spellCheck="false"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                    placeholder="At least 8 characters"
                    type="password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <SubmitButton
            type="submit"
            className="bg-primary px-6 py-4 text-secondary font-medium flex space-x-2 h-[40px] w-full"
            isSubmitting={isSubmitting}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-current" />
                <span>{mode === "signIn" ? "Signing in" : "Creating account"}</span>
              </span>
            ) : mode === "signIn" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </SubmitButton>

          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              setError(null);
              setMode((current) => (current === "signIn" ? "signUp" : "signIn"));
            }}
          >
            {mode === "signIn" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </form>
    </Form>
  );
}
