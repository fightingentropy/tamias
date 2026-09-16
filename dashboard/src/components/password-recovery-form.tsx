"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Input } from "@tamias/ui/input";
import { Label } from "@tamias/ui/label";
import { SubmitButton } from "@tamias/ui/submit-button";
import Link from "@/framework/link";

export function PasswordRecoveryForm() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    setToken(params.get("token"));
    // Reset credentials stay out of requests, referrers, and browser history.
    if (window.location.hash) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
    setReady(true);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setError(null);
    if (token && fields.get("password") !== fields.get("confirmPassword")) {
      setError("Your passwords don't match.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          token
            ? { intent: "complete", token, password: fields.get("password") }
            : { intent: "request", email: fields.get("email") },
        ),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(
          body?.error ??
            (response.status === 429
              ? "Too many attempts. Try again in 15 minutes."
              : "Please try again."),
        );
      }
      form.reset();
      setComplete(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to connect. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2" aria-live="polite">
        <h1 className="font-serif text-3xl">
          {complete
            ? token
              ? "Password updated"
              : "Check your email"
            : token
              ? "Choose a new password"
              : "Forgot your password?"}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {complete
            ? token
              ? "Your existing sessions have been signed out. You can now sign in with your new password."
              : "If an account exists for that email, a reset link will arrive shortly. Check your spam folder too. The link expires in 30 minutes."
            : token
              ? "Use at least 8 characters. Changing your password will sign you out on other devices."
              : "Enter the email you use for Tamias and we'll send you a link to reset your password."}
        </p>
      </div>
      {!complete ? (
        <form method="post" onSubmit={onSubmit} className="space-y-5">
          {token ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                maxLength={254}
                placeholder="you@example.com"
                required
              />
            </div>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <SubmitButton
            type="submit"
            className="h-11 w-full"
            disabled={!ready}
            isSubmitting={isSubmitting}
          >
            {isSubmitting ? "Please wait…" : token ? "Update password" : "Send reset link"}
          </SubmitButton>
          {token && error ? (
            <a
              href="/reset-password"
              className="block text-center text-sm underline underline-offset-4"
            >
              Request a new reset link
            </a>
          ) : null}
        </form>
      ) : null}
      <Link
        href="/login"
        className="block text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
      >
        Back to sign in
      </Link>
    </div>
  );
}
