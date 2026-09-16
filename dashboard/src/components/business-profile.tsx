"use client";

import { BUSINESS_STRUCTURES, getBusinessProfile } from "@tamias/contracts/business-type";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@tamias/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@tamias/ui/form";
import { SubmitButton } from "@tamias/ui/submit-button";
import { useToast } from "@tamias/ui/use-toast";
import { z } from "zod/v3";
import { useTeamMutation, useTeamQuery } from "@/hooks/use-team";
import { useZodForm } from "@/hooks/use-zod-form";
import { SelectBusinessStructure, SelectCis } from "./select-business-structure";

const schema = z.object({
  businessStructure: z.enum(BUSINESS_STRUCTURES).nullable(),
  usesCis: z.boolean().nullable(),
});

export function BusinessProfile() {
  const { data: team } = useTeamQuery();
  const profile = getBusinessProfile(team);
  const mutation = useTeamMutation();
  const { toast } = useToast();
  const form = useZodForm(schema, {
    defaultValues: { businessStructure: profile.structure, usesCis: profile.usesCis },
  });

  return (
    <Form {...form}>
      <form
        id="business-profile"
        className="scroll-mt-8"
        onSubmit={form.handleSubmit((values) =>
          mutation.mutate(values, {
            onSuccess: () => {
              form.reset(values);
              toast({ title: "Business details saved" });
            },
            onError: () =>
              toast({
                title: "Unable to save business details",
                description: "Your previous details are unchanged. Please try again.",
                variant: "destructive",
              }),
          }),
        )}
      >
        <Card>
          <CardHeader>
            <CardTitle>Business structure &amp; tax scheme</CardTitle>
            <CardDescription>
              A sole trader or limited company can also work under CIS. Set these separately so
              Tamias can show the relevant tax information.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="businessStructure"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business structure</FormLabel>
                  <FormControl>
                    <SelectBusinessStructure value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="usesCis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Do you work under CIS?</FormLabel>
                  <FormControl>
                    <SelectCis value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormDescription>The UK Construction Industry Scheme.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.watch("usesCis") === true && (
              <p className="sm:col-span-2 text-sm text-muted-foreground">
                CIS tax deductions are not yet supported by direct filing in Tamias.
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-between gap-4">
            <p>These details do not change your HMRC registration.</p>
            <SubmitButton
              isSubmitting={mutation.isPending}
              disabled={mutation.isPending || !form.formState.isDirty}
            >
              Save
            </SubmitButton>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
