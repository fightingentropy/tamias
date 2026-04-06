import { Avatar, AvatarFallback, AvatarImage } from "@tamias/ui/avatar";
import { cn } from "@tamias/ui/cn";
import { Icons } from "@tamias/ui/icons";
import { useState } from "react";

/** Mirror host for synced institution logos; keep in sync with `INSTITUTION_LOGO_CDN_HOST` in `@tamias/banking` */
const INSTITUTION_LOGO_CDN_HOST = "cdn-engine.tamias.xyz";

type Props = {
  src: string | null;
  alt: string;
  size?: number;
};

function loadableInstitutionLogo(src: string | null): string | null {
  if (!src) {
    return null;
  }

  if (src.startsWith("data:")) {
    return src;
  }

  try {
    const host = new URL(src).hostname;
    if (host === INSTITUTION_LOGO_CDN_HOST) {
      return null;
    }
    return src;
  } catch {
    return null;
  }
}

export function BankLogo({ src, alt, size = 34 }: Props) {
  const [hasError, setHasError] = useState(false);
  const resolved = loadableInstitutionLogo(src);
  const showingFallback = !resolved || hasError;

  return (
    <Avatar
      style={{ width: size, height: size }}
      className={cn(!showingFallback && "border border-border")}
    >
      {resolved && !hasError ? (
        <AvatarImage
          src={resolved}
          alt={alt}
          className="object-contain bg-white"
          onError={() => setHasError(true)}
        />
      ) : null}
      <AvatarFallback>
        <Icons.Accounts className="size-[55%] text-muted-foreground" aria-hidden />
      </AvatarFallback>
    </Avatar>
  );
}
