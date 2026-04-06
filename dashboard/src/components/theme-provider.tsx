"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ResolvedTheme = "light" | "dark";
type Theme = ResolvedTheme | "system";
type ThemeAttribute = "class" | `data-${string}`;

type ThemeProviderProps = {
  children: ReactNode;
  attribute?: ThemeAttribute | ThemeAttribute[];
  defaultTheme?: Theme;
  disableTransitionOnChange?: boolean;
  enableSystem?: boolean;
  forcedTheme?: Theme;
  storageKey?: string;
  themes?: ResolvedTheme[];
  value?: Partial<Record<ResolvedTheme, string>>;
};

type ThemeContextValue = {
  forcedTheme?: Theme;
  resolvedTheme?: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  systemTheme?: ResolvedTheme;
  theme?: Theme;
  themes: Theme[];
};

const THEME_STORAGE_KEY = "theme";
const DEFAULT_THEMES: ResolvedTheme[] = ["light", "dark"];
const DEFAULT_THEME: Theme = "system";
const SYSTEM_THEME_MEDIA = "(prefers-color-scheme: dark)";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(SYSTEM_THEME_MEDIA).matches ? "dark" : "light";
}

function sanitizeTheme(
  theme: string | null | undefined,
  fallbackTheme: Theme,
  enableSystem: boolean,
  themes: ResolvedTheme[],
): Theme {
  if (theme === "system" && enableSystem) {
    return theme;
  }

  if (theme && themes.includes(theme as ResolvedTheme)) {
    return theme as ResolvedTheme;
  }

  return fallbackTheme;
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode("*,*::before,*::after{transition:none!important}"),
  );
  document.head.appendChild(style);

  return () => {
    window.getComputedStyle(document.body);
    setTimeout(() => {
      document.head.removeChild(style);
    }, 1);
  };
}

function applyTheme({
  attribute,
  disableTransitionOnChange,
  resolvedTheme,
  themes,
  value,
}: {
  attribute: ThemeAttribute | ThemeAttribute[];
  disableTransitionOnChange: boolean;
  resolvedTheme: ResolvedTheme;
  themes: ResolvedTheme[];
  value?: Partial<Record<ResolvedTheme, string>>;
}) {
  const root = document.documentElement;
  const attributes = Array.isArray(attribute) ? attribute : [attribute];
  const cleanup = disableTransitionOnChange
    ? disableTransitionsTemporarily()
    : undefined;
  const themedValues = themes.map((theme) => value?.[theme] ?? theme);
  const nextValue = value?.[resolvedTheme] ?? resolvedTheme;

  for (const currentAttribute of attributes) {
    if (currentAttribute === "class") {
      root.classList.remove(...themedValues);
      root.classList.add(nextValue);
      continue;
    }

    root.setAttribute(currentAttribute, nextValue);
  }

  root.style.colorScheme = resolvedTheme;
  cleanup?.();
}

export function ThemeProvider({
  attribute = "class",
  children,
  defaultTheme = DEFAULT_THEME,
  disableTransitionOnChange = false,
  enableSystem = false,
  forcedTheme,
  storageKey = THEME_STORAGE_KEY,
  themes = DEFAULT_THEMES,
  value,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const media = window.matchMedia(SYSTEM_THEME_MEDIA);
    const updateSystemTheme = () => {
      setSystemTheme(getSystemTheme());
    };

    updateSystemTheme();

    const nextTheme = sanitizeTheme(
      window.localStorage.getItem(storageKey),
      defaultTheme,
      enableSystem,
      themes,
    );
    setThemeState(nextTheme);

    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [defaultTheme, enableSystem, storageKey, themes]);

  useEffect(() => {
    const syncTheme = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return;
      }

      setThemeState(
        sanitizeTheme(event.newValue, defaultTheme, enableSystem, themes),
      );
    };

    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, [defaultTheme, enableSystem, storageKey, themes]);

  const resolvedTheme =
    forcedTheme && forcedTheme !== "system"
      ? forcedTheme
      : theme === "system" && enableSystem
        ? systemTheme
        : theme === "dark"
          ? "dark"
          : "light";

  useEffect(() => {
    applyTheme({
      attribute,
      disableTransitionOnChange,
      resolvedTheme,
      themes,
      value,
    });
  }, [attribute, disableTransitionOnChange, resolvedTheme, themes, value]);

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      setThemeState(nextTheme);
      window.localStorage.setItem(storageKey, nextTheme);
    },
    [storageKey],
  );

  const context = useMemo<ThemeContextValue>(
    () => ({
      forcedTheme,
      resolvedTheme,
      setTheme,
      systemTheme,
      theme,
      themes: enableSystem ? [...themes, "system"] : [...themes],
    }),
    [
      enableSystem,
      forcedTheme,
      resolvedTheme,
      setTheme,
      systemTheme,
      theme,
      themes,
    ],
  );

  return (
    <ThemeContext.Provider value={context}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return (
    useContext(ThemeContext) ?? {
      setTheme: () => {},
      themes: [...DEFAULT_THEMES, "system"] satisfies Theme[],
    }
  );
}
