import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabasePublicEnv } from "./env";

function supabaseServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
}

export async function createClient() {
  const { url, key } = requireSupabasePublicEnv();

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — middleware handles refresh.
        }
      },
    },
  });
}

export async function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = supabaseServiceKey();
  if (!url || !key) {
    throw new Error("Supabase service env missing in .env");
  }
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key);
}
