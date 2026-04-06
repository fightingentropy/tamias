import { serialize } from "cookie-es";

type SetClientCookieOptions = {
  expires?: Date;
};

export function setClientCookie(
  name: string,
  value: string,
  options: SetClientCookieOptions = {},
) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = serialize(name, value, {
    path: "/",
    sameSite: "lax",
    expires: options.expires,
  });
}

export function setJsonClientCookie(
  name: string,
  value: unknown,
  options: SetClientCookieOptions = {},
) {
  setClientCookie(name, JSON.stringify(value), options);
}
