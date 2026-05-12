import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * True when Supabase env vars are present. Use to gate realtime subscriptions
 * or surface a "demo mode" banner. When false, dbAdmin/dbAnon/dbBrowser still
 * return a working client — but it's a stub that resolves every query to empty
 * data, so the UI renders without crashing.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// ─── Stub client (dev escape hatch when env vars are missing) ───────
//
// The real Supabase client is chainable: `.from(t).select().eq().order()...`
// where the final step is awaited. We mirror that with a Proxy that returns
// itself for any property access and resolves to `{ data: [], error: null }`
// when awaited. `maybeSingle()` and `single()` resolve to `{ data: null }`.
//
// Channel subscriptions become no-ops with an unsubscribe() that does nothing.

function makeStubBuilder(): unknown {
  const handler: ProxyHandler<() => void> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: { data: unknown[]; error: null }) => void) =>
          resolve({ data: [], error: null });
      }
      if (prop === "maybeSingle" || prop === "single") {
        return () => Promise.resolve({ data: null, error: null });
      }
      // Any other property is a chainable builder method.
      return () => makeStubBuilder();
    },
    apply() {
      return makeStubBuilder();
    },
  };
  // The target needs to be callable for `apply` to trigger on `proxy()`.
  return new Proxy(function () {}, handler);
}

function makeStubChannel() {
  const ch = {
    on() {
      return ch;
    },
    subscribe() {
      return ch;
    },
    unsubscribe() {
      return Promise.resolve("ok" as const);
    },
  };
  return ch;
}

function makeStubClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    console.warn(
      "[tradefish] Supabase env vars missing — using in-memory stub. " +
        "Realtime + queries will return empty data. Set NEXT_PUBLIC_SUPABASE_URL " +
        "and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to connect to a real instance.",
    );
  }
  const stub = {
    from: () => makeStubBuilder(),
    rpc: () => makeStubBuilder(),
    channel: () => makeStubChannel(),
    removeChannel: () => Promise.resolve("ok" as const),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
    },
  };
  return stub as unknown as SupabaseClient;
}

// ─── Real clients ──────────────────────────────────────────────────

let _admin: SupabaseClient | null = null;

/**
 * Server-side admin client. Bypasses RLS — use only in route handlers and
 * server actions. Never import this from client components.
 *
 * Returns a stub when env vars are absent (dev mode), so server pages render
 * empty rather than 500ing.
 */
export function dbAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    _admin = makeStubClient();
    return _admin;
  }
  _admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

/**
 * Browser-safe anon client. Subject to RLS.
 */
export function dbAnon(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return makeStubClient();
  return createClient(url, anon);
}

let _browser: SupabaseClient | null = null;

/**
 * Browser-safe singleton. Use from client components only.
 * Lazy init keeps tsc/build happy if envs are absent at module-load.
 *
 * Returns a stub when env vars are absent (dev mode), so realtime hooks
 * render an empty arena instead of crashing.
 */
export function dbBrowser(): SupabaseClient {
  if (_browser) return _browser;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    _browser = makeStubClient();
    return _browser;
  }
  _browser = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return _browser;
}
