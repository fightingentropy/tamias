"use client";

import { track } from "@/lib/telemetry/client";
import { LogEvents } from "@/lib/telemetry/events";
import { BUSINESS_STRUCTURES, BUSINESS_TYPES } from "@tamias/contracts/business-type";
import { uniqueCurrencies } from "@tamias/location/currencies";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@tamias/ui/form";
import { Input } from "@tamias/ui/input";
import { useToast } from "@tamias/ui/use-toast";
import { getDefaultFiscalYearStartMonth } from "@tamias/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { use, useEffect, useRef, useState } from "react";
import { z } from "zod/v3";
import { CountrySelector } from "@/components/country-selector";
import { SelectCompanyType } from "@/components/select-company-type";
import { SelectBusinessStructure, SelectCis } from "@/components/select-business-structure";
import { SelectCurrency } from "@/components/select-currency";
import { SelectFiscalMonth } from "@/components/select-fiscal-month";
import { SelectHeardAbout } from "@/components/select-heard-about";
import { useZodForm } from "@/hooks/use-zod-form";
import { useTRPC } from "@/trpc/client";

const formSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters."),
  countryCode: z.string(),
  baseCurrency: z.string(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).nullable().optional(),
  companyType: z.enum(BUSINESS_TYPES, {
    required_error: "Please select the option that best describes you.",
  }),
  businessStructure: z.enum(BUSINESS_STRUCTURES, {
    required_error: "Choose your business structure, or select Not sure yet.",
  }),
  usesCis: z.boolean().nullable(),
  heardAbout: z.enum(
    ["twitter", "youtube", "friend", "google", "blog", "podcast", "github", "other"],
    { required_error: "Please select an option." },
  ),
});

type FormValues = z.infer<typeof formSchema>;

type Props = {
  defaultCurrencyPromise: Promise<string>;
  defaultCountryCodePromise: Promise<string>;
  onComplete: () => void;
  onCountryChange?: (countryCode: string) => void;
  onLoadingChange?: (loading: boolean) => void;
};

export function CreateTeamStep({
  defaultCurrencyPromise,
  defaultCountryCodePromise,
  onComplete,
  onCountryChange,
  onLoadingChange,
}: Props) {
  const currency = use(defaultCurrencyPromise);
  const countryCode = use(defaultCountryCodePromise);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittedRef = useRef(false);

  const createTeamMutation = useMutation(
    trpc.team.create.mutationOptions({
      onSuccess: async () => {
        track({
          event: LogEvents.OnboardingTeamCreated.name,
          channel: LogEvents.OnboardingTeamCreated.channel,
          countryCode: form.getValues("countryCode"),
          currency: form.getValues("baseCurrency"),
          companyType: form.getValues("companyType"),
          heardAbout: form.getValues("heardAbout"),
        });
        await queryClient.invalidateQueries();
        onComplete();
      },
      onError: (error) => {
        setIsLoading(false);
        isSubmittedRef.current = false;

        toast({
          duration: 6000,
          title: "Unable to create team",
          variant: "info",
          description:
            error.data?.code === "FORBIDDEN"
              ? "All existing teams must be on a paid plan before creating another."
              : "Something went wrong. Please try again.",
        });
      },
    }),
  );

  const form = useZodForm(formSchema, {
    defaultValues: {
      name: "",
      baseCurrency: currency,
      countryCode: countryCode ?? "",
      fiscalYearStartMonth: getDefaultFiscalYearStartMonth(countryCode),
      usesCis: null,
    },
  });

  const selectedCountryCode = form.watch("countryCode");
  useEffect(() => {
    const defaultFiscalYear = getDefaultFiscalYearStartMonth(selectedCountryCode);
    if (defaultFiscalYear !== form.getValues("fiscalYearStartMonth")) {
      form.setValue("fiscalYearStartMonth", defaultFiscalYear);
    }

    if (selectedCountryCode) {
      onCountryChange?.(selectedCountryCode);
    }
  }, [selectedCountryCode, form, onCountryChange]);

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  const isFormLocked = isLoading || isSubmittedRef.current;

  async function onSubmit(values: FormValues) {
    if (isFormLocked) return;

    setIsLoading(true);
    isSubmittedRef.current = true;

    try {
      createTeamMutation.mutate({
        name: values.name,
        baseCurrency: values.baseCurrency,
        countryCode: values.countryCode,
        fiscalYearStartMonth: values.fiscalYearStartMonth,
        companyType: values.companyType,
        businessStructure: values.businessStructure,
        usesCis: values.usesCis,
        heardAbout: values.heardAbout,
        switchTeam: true,
      });
    } catch {
      setIsLoading(false);
      isSubmittedRef.current = false;
    }
  }

  return (
    <div className="space-y-4">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="text-lg lg:text-xl font-serif"
      >
        Business details
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="text-sm text-muted-foreground leading-relaxed"
      >
        Add your business details so amounts, currency, tax, and reporting periods line up correctly
        across insights, invoices and exports.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.3 }}
      >
        <Form {...form}>
          <form id="create-team-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-primary font-normal">Business name</FormLabel>
                  <FormControl>
                    <Input
                      autoFocus
                      placeholder="Your name or trading name"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck="false"
                      className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                      data-testid="onboarding-company-name"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-[11px] text-muted-foreground">
                    Sole traders can use their own name or a trading name.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="countryCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-primary font-normal">Country</FormLabel>
                  <FormControl className="w-full">
                    <CountrySelector
                      defaultValue={field.value ?? ""}
                      className="bg-secondary border-border text-foreground"
                      onSelect={(code) => {
                        field.onChange(code);
                        form.setValue("countryCode", code);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="baseCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-primary font-normal">
                        Base currency
                      </FormLabel>
                      <FormControl>
                        <SelectCurrency
                          currencies={uniqueCurrencies}
                          triggerClassName="bg-secondary border-border text-foreground"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fiscalYearStartMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-primary font-normal">
                        Fiscal year starts
                      </FormLabel>
                      <FormControl>
                        <SelectFiscalMonth
                          triggerClassName="bg-secondary border-border text-foreground"
                          popoverProps={{
                            side: "bottom",
                            avoidCollisions: false,
                          }}
                          listClassName="max-h-[150px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormDescription className="text-[11px] text-muted-foreground">
                Used for reports and default date ranges. You can change these later.
              </FormDescription>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <FormField
                control={form.control}
                name="companyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-primary font-normal">
                      What kind of work do you do?
                    </FormLabel>
                    <FormControl>
                      <SelectCompanyType
                        value={field.value}
                        onChange={field.onChange}
                        className="bg-secondary border-border text-foreground"
                        dataTestId="onboarding-company-type"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="heardAbout"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-primary font-normal">
                      How did you hear about us?
                    </FormLabel>
                    <FormControl>
                      <SelectHeardAbout
                        value={field.value}
                        onChange={field.onChange}
                        className="bg-secondary border-border text-foreground"
                        dataTestId="onboarding-heard-about"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
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
              {selectedCountryCode === "GB" && (
                <FormField
                  control={form.control}
                  name="usesCis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Do you work under CIS?</FormLabel>
                      <FormControl>
                        <SelectCis value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormDescription>
                        This is separate from your business structure.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            {form.watch("usesCis") === true && (
              <p className="text-sm text-muted-foreground">
                CIS tax deductions are not yet supported by direct filing in Tamias.
              </p>
            )}
          </form>
        </Form>
      </motion.div>
    </div>
  );
}
