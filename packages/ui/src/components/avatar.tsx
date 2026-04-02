"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as React from "react";
import { cn } from "../utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className,
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

type AvatarImageNextProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  src?: string | { src: string; width?: number; height?: number };
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  unoptimized?: boolean;
  onLoadingComplete?: (img: HTMLImageElement) => void;
};

export const AvatarImageNext = React.forwardRef<
  HTMLImageElement,
  AvatarImageNextProps
>(
  (
    {
      className,
      onError,
      onLoad,
      onLoadingComplete,
      src,
      fill: _fill,
      priority: _priority,
      quality: _quality,
      unoptimized: _unoptimized,
      ...props
    },
    ref,
  ) => {
  const [hasError, setHasError] = React.useState(false);
  const resolvedSrc = typeof src === "string" ? src : src?.src;

  if (hasError || !resolvedSrc) {
    return null;
  }

  return (
    <img
      ref={ref}
      className={cn("aspect-square h-full w-full absolute z-10", className)}
      src={resolvedSrc}
      onError={(e) => {
        setHasError(true);
        onError?.(e);
      }}
      onLoad={(e) => {
        onLoad?.(e);
        onLoadingComplete?.(e.currentTarget);
      }}
      {...props}
    />
  );
},
);

AvatarImageNext.displayName = "AvatarImageNext";

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-accent",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
