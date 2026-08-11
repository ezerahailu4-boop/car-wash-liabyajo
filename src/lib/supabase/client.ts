import { createBrowserClient } from "@supabase/ssr";

type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  gte: (...args: unknown[]) => QueryBuilder;
  lte: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  limit: (...args: unknown[]) => QueryBuilder;
  single: () => Promise<{ data: null; error: null }>;
  insert: (...args: unknown[]) => Promise<{ data: null; error: null }>;
  update: (...args: unknown[]) => QueryBuilder;
  upsert: (...args: unknown[]) => QueryBuilder;
  delete: (...args: unknown[]) => QueryBuilder;
  then: (resolve: (value: { data: unknown[] | null }) => void) => void;
};

function createFallbackQueryBuilder(data: unknown[] = []) {
  const builder: QueryBuilder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    order: () => builder,
    limit: () => builder,
    single: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }),
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    then: (resolve) => resolve({ data }),
  };

  return builder;
}

function createFallbackClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: { message: "Supabase is not configured (missing env vars)." },
      }),
    },
    from: () => createFallbackQueryBuilder(),
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: "Supabase is not configured (missing env vars)." } }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  };
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return createFallbackClient();
  }

  return createBrowserClient(url, anonKey);
}
