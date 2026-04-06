"use client";

import { Progress } from "./progress";
import { Spinner } from "./spinner";
import { ToastAiIcon, ToastCheckIcon, ToastErrorIcon, ToastInfoIcon } from "./toast-icons";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast";
import { useToast } from "./use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, progress = 0, action, footer, ...props }) => {
        return (
          <Toast key={id} {...props} className="flex flex-col">
            <div className="flex w-full">
              <div className="space-y-2 w-full justify-center">
                <div className="flex space-x-2 justify-between">
                  <div className="flex space-x-2 items-center">
                    {props?.variant && (
                      <div className="w-[20px] h-[20px] flex items-center">
                        {props.variant === "ai" && <ToastAiIcon className="text-[#0064D9]" />}
                        {props?.variant === "success" && <ToastCheckIcon />}
                        {props?.variant === "error" && (
                          <ToastErrorIcon className="text-[#FF3638]" />
                        )}
                        {props?.variant === "info" && <ToastInfoIcon className="text-[#878787]" />}
                        {props?.variant === "progress" && (
                          <Spinner className="h-4 w-4 animate-spin" />
                        )}
                        {props?.variant === "spinner" && (
                          <Spinner className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                    )}
                    <div>{title && <ToastTitle>{title}</ToastTitle>}</div>
                  </div>

                  <div>
                    {props?.variant === "progress" && (
                      <span className="text-sm text-[#878787]">{progress}%</span>
                    )}
                  </div>
                </div>

                {props.variant === "progress" && (
                  <Progress value={progress} className="w-full rounded-none h-[3px] bg-border" />
                )}

                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
              {action}
              <ToastClose />
            </div>

            <div className="w-full flex justify-end">{footer}</div>
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
