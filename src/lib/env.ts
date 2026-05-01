import { z } from "zod";

const supabaseProjectUrl = z
  .string()
  .url("NEXT_PUBLIC_SUPABASE_URL must be a URL")
  .refine(
    (raw) => {
      try {
        const u = new URL(raw);
        const hasPath = u.pathname && u.pathname !== "/";
        return !hasPath && !u.search && !u.hash;
      } catch {
        return false;
      }
    },
    {
      message:
        "NEXT_PUBLIC_SUPABASE_URL should be just your project URL (e.g. https://abcd.supabase.co) with no path. Don't paste the /rest/v1/ URL.",
    },
  );

const serverSchema = z.object({
  BUNGIE_API_KEY: z.string().min(1, "BUNGIE_API_KEY is required"),
  BUNGIE_CLIENT_ID: z.string().min(1, "BUNGIE_CLIENT_ID is required"),
  BUNGIE_CLIENT_SECRET: z.string().optional().default(""),
  APP_SESSION_SECRET: z
    .string()
    .min(32, "APP_SESSION_SECRET must be at least 32 chars"),
  APP_TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, "APP_TOKEN_ENCRYPTION_KEY must be at least 32 chars"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  NEXT_PUBLIC_SUPABASE_URL: supabaseProjectUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a URL")
    .default("http://localhost:3000"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseProjectUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

let cachedServer: z.infer<typeof serverSchema> | null = null;
let cachedClient: z.infer<typeof clientSchema> | null = null;

export function serverEnv() {
  if (cachedServer) return cachedServer;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server environment variables:\n${issues}`);
  }
  cachedServer = parsed.data;
  return cachedServer;
}

export function clientEnv() {
  if (cachedClient) return cachedClient;
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid client environment variables:\n${issues}`);
  }
  cachedClient = parsed.data;
  return cachedClient;
}
