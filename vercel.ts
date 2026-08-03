import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "npm run build",
  functions: {
    "app/api/**/*.ts": { maxDuration: 300, memory: 2048 },
  },
  headers: [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    },
    {
      source: "/api/(.*)",
      headers: [{ key: "Cache-Control", value: "no-store" }],
    },
  ],
};
