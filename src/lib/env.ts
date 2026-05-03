import { z } from "zod";

/** Optional nonempty string env (after trim); empty/absent becomes undefined */
const optionalGithubFeedbackString = z.preprocess((v: unknown) => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}, z.string().min(1).optional());

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
  /** In-app feedback → GitHub Issues (all required at submit time via {@link githubFeedbackIssueConfig}). */
  GITHUB_FEEDBACK_OWNER: optionalGithubFeedbackString,
  GITHUB_FEEDBACK_REPO: optionalGithubFeedbackString,
  GITHUB_FEEDBACK_TOKEN: optionalGithubFeedbackString,
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseProjectUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

let cachedServer: z.infer<typeof serverSchema> | null = null;
let cachedClient: z.infer<typeof clientSchema> | null = null;

const ENV_TRIM_KEYS = [
  "BUNGIE_API_KEY",
  "BUNGIE_CLIENT_ID",
  "BUNGIE_CLIENT_SECRET",
  "APP_SESSION_SECRET",
  "APP_TOKEN_ENCRYPTION_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
  "GITHUB_FEEDBACK_OWNER",
  "GITHUB_FEEDBACK_REPO",
  "GITHUB_FEEDBACK_TOKEN",
] as const;

function envWithTrimmedSecrets(): NodeJS.ProcessEnv {
  const out = { ...process.env };
  for (const key of ENV_TRIM_KEYS) {
    const v = out[key];
    if (typeof v === "string") out[key] = v.trim();
  }
  return out;
}

export function serverEnv() {
  if (cachedServer) return cachedServer;
  const parsed = serverSchema.safeParse(envWithTrimmedSecrets());
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
  const raw = envWithTrimmedSecrets();
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: raw.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: raw.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: raw.NEXT_PUBLIC_APP_URL,
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

/** GitHub target for `POST …/repos/…/issues` — undefined if integration is unset. */
export function githubFeedbackIssueConfig():
  | { owner: string; repo: string; token: string }
  | undefined {
  const e = serverEnv();
  if (
    !e.GITHUB_FEEDBACK_OWNER ||
    !e.GITHUB_FEEDBACK_REPO ||
    !e.GITHUB_FEEDBACK_TOKEN
  ) {
    return undefined;
  }
  return {
    owner: e.GITHUB_FEEDBACK_OWNER,
    repo: e.GITHUB_FEEDBACK_REPO,
    token: e.GITHUB_FEEDBACK_TOKEN,
  };
}
