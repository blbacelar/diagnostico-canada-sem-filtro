import type { NextConfig } from "next";

// `VITE_*` was used by the original client implementation, but Next.js only
// exposes variables prefixed with `NEXT_PUBLIC_` to browser bundles. Keep the
// existing Vercel variable names for compatibility and explicitly inline the
// public Supabase configuration during the build.
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  },
};

export default nextConfig;
