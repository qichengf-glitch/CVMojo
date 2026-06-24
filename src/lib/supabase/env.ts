export const SUPABASE_ENV_ERROR =
  "Supabase env missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.";

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return { url, key };
}

export function hasSupabasePublicEnv() {
  const { url, key } = getSupabasePublicEnv();
  return Boolean(url && key);
}

export function requireSupabasePublicEnv() {
  const { url, key } = getSupabasePublicEnv();

  if (!url || !key) {
    throw new Error(SUPABASE_ENV_ERROR);
  }

  return { url, key };
}
