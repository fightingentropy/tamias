"use client";

import { track } from "@/lib/telemetry/client";
import { LogEvents } from "@/lib/telemetry/events";
import { Avatar, AvatarFallback } from "@tamias/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@tamias/ui/form";
import { Icons } from "@tamias/ui/icons";
import { Skeleton } from "@tamias/ui/skeleton";
import { SubmitButton } from "@tamias/ui/submit-button";
import { Switch } from "@tamias/ui/switch";
import { Tabs, TabsContent } from "@tamias/ui/tabs";
import { useToast } from "@tamias/ui/use-toast";
import { getInitials } from "@tamias/utils/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import dynamic from "@/framework/dynamic";
import z from "zod/v3";
import { useConnectParams } from "@/hooks/use-connect-params";
import { useZodForm } from "@/hooks/use-zod-form";
import { useI18n } from "@/locales/client";
import { useTRPC } from "@/trpc/client";
import { FormatAmount } from "./format-amount";

function RowsSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index.toString()} className="flex justify-between">
          <div className="flex items-center space-x-4 mr-8 flex-1 min-w-0">
            <Skeleton className="size-[34px] rounded-full shrink-0" />
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-[120px] rounded-none" />
                <Skeleton className="h-3 w-[50px] rounded-none" />
              </div>
              <div className="flex items-center justify-between mt-1">
                <Skeleton className="h-3 w-[80px] rounded-none" />
                <Skeleton className="h-3.5 w-[70px] rounded-none" />
              </div>
            </div>
          </div>
          <Skeleton className="h-5 w-9 rounded-full shrink-0 self-center" />
        </div>
      ))}
    </div>
  );
}

function SelectBankAccountsTabFallback() {
  return <div className="min-h-[250px]" />;
}

const LoadingTransactionsEvent = dynamic(
  () =>
    import("./loading-transactions-event").then(
      (mod) => mod.LoadingTransactionsEvent,
    ),
  {
    ssr: false,
    loading: SelectBankAccountsTabFallback,
  },
);

const SelectBankAccountsSupportForm = dynamic(
  () =>
    import("./select-bank-accounts-support-form").then(
      (mod) => mod.SelectBankAccountsSupportForm,
    ),
  {
    ssr: false,
    loading: SelectBankAccountsTabFallback,
  },
);

const formSchema = z.object({
  referenceId: z.string().nullable().optional(),
  accessToken: z.string().nullable().optional(),
  enrollmentId: z.string().nullable().optional(),
  provider: z.enum(["gocardless", "plaid", "teller"]),
  accounts: z
    .array(
      z.object({
        accountId: z.string(),
        bankName: z.string(),
        balance: z.number().optional(),
        currency: z.string(),
        name: z.string(),
        institutionId: z.string(),
        accountReference: z.string().nullable().optional(),
        enabled: z.boolean(),
        logoUrl: z.string().nullable().optional(),
        expiresAt: z.string().nullable().optional(),
        type: z.enum([
          "credit",
          "depository",
          "other_asset",
          "loan",
          "other_liability",
        ]),
        iban: z.string().nullable().optional(),
        subtype: z.string().nullable().optional(),
        bic: z.string().nullable().optional(),
        routingNumber: z.string().nullable().optional(),
        wireRoutingNumber: z.string().nullable().optional(),
        accountNumber: z.string().nullable().optional(),
        sortCode: z.string().nullable().optional(),
        availableBalance: z.number().nullable().optional(),
        creditLimit: z.number().nullable().optional(),
      }),
    )
    .refine((accounts) => accounts.some((account) => account.enabled), {
      message: "At least one account must be selected.",
    }),
});

type SelectBankAccountsContentProps = {
  enabled: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onSyncStarted?: (data: { runId: string }) => void;
  stickySubmit?: boolean;
  accountsListClassName?: string;
  fadeGradientClass?: string;
};

export function SelectBankAccountsContent({
  enabled,
  onClose,
  onComplete,
  onSyncStarted,
  stickySubmit = true,
  accountsListClassName,
  fadeGradientClass,
}: SelectBankAccountsContentProps) {
  const { toast } = useToast();
  const trpc = useTRPC();
  const t = useI18n();

  const [runId, setRunId] = useState<string>();
  const [activeTab, setActiveTab] = useState<
    "select-accounts" | "loading" | "support"
  >("select-accounts");

  const {
    error,
    setParams,
    provider,
    ref,
    institution_id,
    token,
    enrollment_id,
  } = useConnectParams();

  const {
    data: accountsData,
    isLoading,
    isError,
  } = useQuery(
    trpc.banking.getProviderAccounts.queryOptions(
      {
        id: ref ?? undefined,
        accessToken: token ?? undefined,
        institutionId: institution_id ?? undefined,
        provider: provider as
          | "gocardless"
          | "plaid"
          | "teller",
      },
      {
        enabled: enabled && !!provider,
        retry: false,
      },
    ),
  );

  const connectBankConnectionMutation = useMutation(
    trpc.bankConnections.create.mutationOptions({
      onError: () => {
        toast({
          duration: 3500,
          variant: "error",
          title: "Something went wrong please try again.",
        });
      },
      onSuccess: (data) => {
        if (data?.runId) {
          track({
            event: LogEvents.ConnectBankCompleted.name,
            channel: LogEvents.ConnectBankCompleted.channel,
            provider: provider ?? "unknown",
          });

          if (onSyncStarted && onComplete) {
            onSyncStarted({
              runId: data.runId,
            });
            setParams(null);
            onComplete();
          } else {
            setRunId(data.runId);
            setActiveTab("loading");
          }
        }
      },
    }),
  );

  useEffect(() => {
    if (error || isError) {
      toast({
        duration: 5000,
        variant: "error",
        title: "Could not connect your bank. Please try again.",
      });

      setParams({
        step: null,
        error: null,
        details: null,
        provider: null,
        ref: null,
      });
      onClose();
    }
  }, [error, isError, setParams, onClose]);

  const form = useZodForm(formSchema, {
    defaultValues: {
      accessToken: token ?? undefined,
      enrollmentId: enrollment_id ?? undefined,
      referenceId: ref ?? undefined,
      provider: provider as "gocardless" | "plaid" | "teller",
      accounts: [],
    },
  });

  useEffect(() => {
    form.reset({
      provider: provider as "gocardless" | "plaid" | "teller",
      accessToken: token ?? undefined,
      enrollmentId: enrollment_id ?? undefined,
      referenceId: ref ?? undefined,
      accounts: accountsData?.data?.map((account) => ({
        name: account.name,
        institutionId: account.institution.id,
        logoUrl: account.institution?.logo,
        accountId: account.id,
        accountReference: account.resource_id,
        bankName: account.institution.name,
        currency: account.currency ?? account.balance.currency,
        balance: account.balance.amount,
        enabled: true,
        type: account.type,
        expiresAt: account.expires_at,
        iban: account.iban,
        subtype: account.subtype,
        bic: account.bic,
        routingNumber: account.routing_number,
        wireRoutingNumber: account.wire_routing_number,
        accountNumber: account.account_number,
        sortCode: account.sort_code,
        availableBalance: account.available_balance ?? null,
        creditLimit: account.credit_limit ?? null,
      })),
    });
  }, [accountsData, ref]);

  const handleClose = () => {
    setParams(null);
    onClose();
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    connectBankConnectionMutation.mutate(values);
  }

  return (
    <Tabs defaultValue="select-accounts" value={activeTab}>
      <TabsContent value="select-accounts">
        <div className="mb-8">
          <h2 className="text-lg font-serif">Select Accounts</h2>
          <p className="text-sm text-[#878787] mt-1">
            Select the accounts to receive transactions. You can enable or
            disable them later in settings if needed. Note: Initial loading may
            take some time.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="relative">
              <div
                className={`space-y-6 overflow-auto scrollbar-hide ${accountsListClassName ?? ""}`}
              >
                {isLoading && <RowsSkeleton />}

                {accountsData?.data?.map((account) => {
                  const accountIdentifier = account.iban?.slice(-4);

                  return (
                    <FormField
                      key={account.id}
                      control={form.control}
                      name="accounts"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={account.id}
                            className="flex justify-between"
                          >
                            <FormLabel className="flex items-center space-x-4 w-full mr-8">
                              <Avatar className="size-[34px]">
                                <AvatarFallback className="text-[11px]">
                                  {getInitials(account.name)}
                                </AvatarFallback>
                              </Avatar>

                              <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium leading-none text-sm truncate">
                                    {account.name}
                                  </p>
                                  {accountIdentifier && (
                                    <span className="text-xs text-[#878787] font-normal shrink-0">
                                      ····{accountIdentifier}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-[#878787] font-normal">
                                    {account.type
                                      ? t(`account_type.${account.type}`)
                                      : t("account_type.depository")}
                                  </span>
                                  <span className="text-sm font-medium">
                                    <FormatAmount
                                      amount={
                                        Number.isFinite(account.balance?.amount)
                                          ? account.balance.amount
                                          : 0
                                      }
                                      currency={
                                        account.balance?.currency ?? "USD"
                                      }
                                    />
                                  </span>
                                </div>
                              </div>
                            </FormLabel>

                            <div>
                              <FormControl>
                                <Switch
                                  checked={
                                    field.value?.find(
                                      (value) => value.accountId === account.id,
                                    )?.enabled
                                  }
                                  onCheckedChange={(checked) => {
                                    return field.onChange(
                                      field.value.map((value) => {
                                        if (value.accountId === account.id) {
                                          return {
                                            ...value,
                                            enabled: checked,
                                          };
                                        }

                                        return value;
                                      }),
                                    );
                                  }}
                                />
                              </FormControl>
                            </div>
                          </FormItem>
                        );
                      }}
                    />
                  );
                })}
              </div>
              {fadeGradientClass && (
                <div
                  className={`pointer-events-none absolute bottom-0 left-0 right-0 h-16 ${fadeGradientClass}`}
                />
              )}
            </div>

            <div
              className={
                stickySubmit
                  ? "fixed bottom-0 left-0 right-0 z-10 bg-background pt-4 px-6 pb-6"
                  : "pt-4"
              }
            >
              <SubmitButton
                className="w-full"
                type="submit"
                isSubmitting={connectBankConnectionMutation.isPending}
                disabled={
                  connectBankConnectionMutation.isPending ||
                  !form.formState.isValid
                }
              >
                Save
              </SubmitButton>

              <div className="flex justify-center mt-4">
                <button
                  type="button"
                  className="text-xs text-[#878787]"
                  onClick={() => setActiveTab("support")}
                >
                  Need support
                </button>
              </div>
            </div>
          </form>
        </Form>
      </TabsContent>

      <TabsContent value="loading">
        <LoadingTransactionsEvent
          runId={runId}
          setRunId={setRunId}
          onClose={onComplete ?? handleClose}
          setActiveTab={setActiveTab}
        />
      </TabsContent>

      <TabsContent value="support">
        <div className="flex items-center space-x-3 mb-6">
          <button
            type="button"
            className="items-center border bg-accent p-1"
            onClick={() => setActiveTab("select-accounts")}
          >
            <Icons.ArrowBack />
          </button>
          <h2>Support</h2>
        </div>
        <SelectBankAccountsSupportForm />
      </TabsContent>
    </Tabs>
  );
}
