import { createIsomorphicFn } from "@tanstack/react-start";

type CookieValue = {
  name: string;
  value: string;
};

type CookieSetValue = CookieValue & {
  expires?: Date | number;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
};

type CookieStore = {
  get: (name: string) => CookieValue | undefined;
  getAll: (name?: string) => CookieValue[];
  has: (name: string) => boolean;
  set: (...args: [CookieSetValue] | [string, string, Partial<CookieSetValue>?]) => void;
};

type ServerCookieApi = {
  cookieValues: Record<string, string>;
  setCookie: (
    name: string,
    value: string,
    options?: {
      expires?: Date;
      httpOnly?: boolean;
      maxAge?: number;
      path?: string;
      sameSite?: "lax" | "strict" | "none";
      secure?: boolean;
    },
  ) => void;
};

const getRuntimeHeaders = createIsomorphicFn()
  .client(async () => new Headers())
  .server(async () => {
    const [{ getRequestHeaders }, { getStartContext }] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("@tanstack/start-storage-context"),
    ]);
    const startContext = getStartContext({ throwIfNotFound: false });

    return (startContext?.request.headers ?? getRequestHeaders()) as Headers;
  });

const getServerCookieApi = createIsomorphicFn()
  .client(
    async (): Promise<ServerCookieApi> => ({
      cookieValues: {},
      setCookie: () => undefined,
    }),
  )
  .server(async (): Promise<ServerCookieApi> => {
    const { getCookies, setCookie } = await import("@tanstack/react-start/server");

    return {
      cookieValues: getCookies(),
      setCookie,
    };
  });

function normalizeCookieArgs(args: [CookieSetValue] | [string, string, Partial<CookieSetValue>?]) {
  if (typeof args[0] === "object") {
    return args[0];
  }

  return {
    name: args[0],
    value: args[1] ?? "",
    ...(args[2] ?? {}),
  };
}

export async function headers() {
  return getRuntimeHeaders();
}

export async function cookies(): Promise<CookieStore> {
  const cookieApi = await getServerCookieApi();
  const cookieMap = new Map<string, string>(Object.entries(cookieApi.cookieValues));

  return {
    get(name) {
      const value = cookieMap.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll(name) {
      const values = Array.from(cookieMap.entries()).map(([key, value]) => ({
        name: key,
        value,
      }));

      if (!name) {
        return values;
      }

      return values.filter((entry) => entry.name === name);
    },
    has(name) {
      return cookieMap.has(name);
    },
    set(...args) {
      const cookie = normalizeCookieArgs(args);

      cookieMap.set(cookie.name, cookie.value);

      cookieApi.setCookie(cookie.name, cookie.value, {
        expires: typeof cookie.expires === "number" ? new Date(cookie.expires) : cookie.expires,
        httpOnly: cookie.httpOnly,
        maxAge: cookie.maxAge,
        path: cookie.path,
        sameSite: cookie.sameSite,
        secure: cookie.secure,
      });
    },
  };
}

export async function revalidatePath(_path: string, _type?: "layout" | "page") {
  return;
}
