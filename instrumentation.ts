export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Node.js has a broken localStorage global (--localstorage-file with invalid path).
    // Patch it with an in-memory implementation so Convex doesn't crash during SSR.
    if (typeof localStorage !== "undefined" && typeof localStorage.getItem !== "function") {
      const store: Record<string, string> = {};
      Object.defineProperty(global, "localStorage", {
        value: {
          getItem: (key: string) => store[key] ?? null,
          setItem: (key: string, value: string) => { store[key] = String(value); },
          removeItem: (key: string) => { delete store[key]; },
          clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
          key: (index: number) => Object.keys(store)[index] ?? null,
          get length() { return Object.keys(store).length; },
        } as Storage,
        writable: true,
        configurable: true,
      });
    }
  }
}
