if (!("HTMLElement" in globalThis)) {
  class HTMLElementShim {}

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    writable: true,
    value: HTMLElementShim,
  });
}

if (!("customElements" in globalThis)) {
  Object.defineProperty(globalThis, "customElements", {
    configurable: true,
    writable: true,
    value: {
      define() {},
      get() {
        return undefined;
      },
      whenDefined() {
        return Promise.resolve();
      },
      upgrade() {},
    },
  });
}
