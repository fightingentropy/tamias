"use client";

import { Button } from "@tamias/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@tamias/ui/popover";
import { Textarea } from "@tamias/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { LogEvents } from "@/lib/telemetry/events";
import { track } from "@/lib/telemetry/client";
import { useTRPC } from "@/trpc/client";

export function FeedbackForm() {
  const trpc = useTRPC();
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const sendFeedback = useMutation(
    trpc.support.sendFeedback.mutationOptions({
      onMutate: () => {
        track({
          event: LogEvents.SendFeedback.name,
          channel: LogEvents.SendFeedback.channel,
        });
      },
      onSuccess: () => {
        setValue("");
        setSubmitted(true);

        setTimeout(() => {
          setSubmitted(false);
        }, 3000);
      },
    }),
  );

  return (
    <Popover>
      <PopoverTrigger asChild className="hidden md:block">
        <Button
          variant="outline"
          className="rounded-full font-normal h-[32px] p-0 px-3 text-xs text-[#878787]"
        >
          Feedback
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] h-[200px]"
        sideOffset={10}
        align="end"
      >
        {submitted ? (
          <div className="flex items-center justify-center flex-col space-y-1 mt-10 text-center">
            <p className="font-medium text-sm">Thank you for your feedback!</p>
            <p className="text-sm text-[#4C4C4C]">
              We will be back with you as soon as possible
            </p>
          </div>
        ) : (
          <form className="space-y-4">
            <Textarea
              name="feedback"
              value={value}
              required
              autoFocus
              placeholder="Ideas to improve this page or issues you are experiencing."
              className="resize-none h-[120px]"
              onChange={(evt) => setValue(evt.target.value)}
            />

            <div className="mt-1 flex items-center justify-end">
              <Button
                type="button"
                onClick={() => sendFeedback.mutate({ feedback: value })}
                disabled={value.length === 0 || sendFeedback.isPending}
              >
                {sendFeedback.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send"
                )}
              </Button>
            </div>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
