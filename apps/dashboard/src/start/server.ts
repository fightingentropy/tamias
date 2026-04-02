import "@/start/html-element-shim";
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";

const fetch = createStartHandler(defaultStreamHandler);

export function createServerEntry(entry: { fetch: typeof fetch }) {
  return {
    async fetch(...args: Parameters<typeof fetch>) {
      return entry.fetch(...args);
    },
  };
}

export default createServerEntry({ fetch });
