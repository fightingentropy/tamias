"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@tamias/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@tamias/ui/form";
import { Textarea } from "@tamias/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import z from "zod/v3";
import { LogEvents } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/client";
import { useTRPC } from "@/trpc/client";

export function SelectBankAccountsSupportForm() {
  const trpc = useTRPC();
  const form = useForm({
    resolver: zodResolver(z.object({ message: z.string() })),
    defaultValues: {
      message: "",
    },
  });

  const sendSupport = useMutation(
    trpc.support.sendTicket.mutationOptions({
      onMutate: () => {
        track({
          event: LogEvents.SupportTicket.name,
          channel: LogEvents.SupportTicket.channel,
        });
      },
      onSuccess: () => {
        form.reset();
      },
    }),
  );

  const handleOnSubmit = form.handleSubmit((values) => {
    sendSupport.mutate({
      message: values.message,
      type: "bank-connection",
      priority: "normal",
      subject: "Select bank accounts",
      url: document.URL,
    });
  });

  if (sendSupport.isSuccess) {
    return (
      <div className="h-[250px] flex items-center justify-center flex-col space-y-1">
        <p className="font-medium text-sm">Thank you!</p>
        <p className="text-sm text-[#4C4C4C]">
          We will be back with you as soon as possible.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={handleOnSubmit}>
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the issue you're facing, along with any relevant information. Please be as detailed and specific as possible."
                  className="resize-none min-h-[150px]"
                  autoFocus
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={
              sendSupport.isPending || !form.formState.isValid
            }
            className="mt-4"
          >
            {sendSupport.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
