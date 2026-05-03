import "server-only";
import type { Session } from "@/lib/auth/session";

export type FeedbackCategoryApi = "bug" | "wishlist";

const LABEL_FEEDBACK = "feedback";
const LABEL_BUG = "bug";
const LABEL_WISHLIST = "enhancement";

/** Allow only ASCII URL path shape (avoid odd control chars); max length ~ typical path. */
export function sanitizeFeedbackPagePath(
  raw: string | undefined,
): string | undefined {
  if (raw === undefined) return undefined;
  const s = raw.trim();
  if (s.length === 0 || s.length > 512) return undefined;
  if (!s.startsWith("/")) return undefined;
  if (!/^[-\w./%+?&=#]*$/i.test(s)) return undefined;
  return s;
}

function singleLineSnippet(text: string, maxLen: number): string {
  return text.trim().replace(/\s+/g, " ").slice(0, maxLen);
}

/** Indent as a Markdown code block (avoids user text breaking fenced ``` blocks). */
function indentedMarkdownCode(inner: string): string {
  return inner.replace(/\r\n/g, "\n").split("\n").map((l) => `    ${l}`).join("\n");
}

function githubIssueBody(input: {
  category: FeedbackCategoryApi;
  message: string;
  pagePath?: string;
  session: Session;
}): string {
  const display = singleLineSnippet(input.session.displayName, 120);
  const categoryLabel =
    input.category === "bug" ? "Bug / broken behavior" : "Feature wishlist";

  const lines = [
    "## Feedback from app",
    "",
    `**Category**: ${categoryLabel}`,
    "",
    "### Message",
    "",
    indentedMarkdownCode(input.message),
    "",
    "### Context (non-secret)",
    "",
    `- **Display name**: ${display}`,
  ];
  if (input.pagePath) {
    lines.push(`- **Page path**: \`${singleLineSnippet(input.pagePath, 260)}\``);
  }
  lines.push("", "_Submitted via Armor Set Checklist in-app feedback._");

  return lines.join("\n");
}

function githubIssueTitle(
  category: FeedbackCategoryApi,
  message: string,
): string {
  const prefix = category === "bug" ? "[Bug]" : "[Wishlist]";
  const snippet = singleLineSnippet(message, 96);
  return `${prefix} ${snippet}`.slice(0, 200);
}

function labelsForCategory(category: FeedbackCategoryApi): string[] {
  const kind = category === "bug" ? LABEL_BUG : LABEL_WISHLIST;
  return [LABEL_FEEDBACK, kind];
}

export class GithubFeedbackIssueError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "GithubFeedbackIssueError";
    this.status = status;
  }
}

/** Create a GitHub issue; token must belong to repo with Issues enabled. Repo must define labels matching {@link LABEL_FEEDBACK}, {@link LABEL_BUG}, and {@link LABEL_WISHLIST}. */
export async function createGithubFeedbackIssue(opts: {
  owner: string;
  repo: string;
  token: string;
  category: FeedbackCategoryApi;
  message: string;
  pagePath?: string;
  session: Session;
}): Promise<void> {
  const title = githubIssueTitle(opts.category, opts.message);
  const body = githubIssueBody({
    category: opts.category,
    message: opts.message,
    pagePath: opts.pagePath,
    session: opts.session,
  });

  const url = `https://api.github.com/repos/${encodeURIComponent(opts.owner)}/${encodeURIComponent(opts.repo)}/issues`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "armorset-checklist-feedback",
      Authorization: `Bearer ${opts.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      body,
      labels: labelsForCategory(opts.category),
    }),
    cache: "no-store",
  });

  if (res.ok) return;

  let detail = "";
  try {
    const j = (await res.json()) as { message?: string };
    if (typeof j.message === "string") detail = j.message;
  } catch {
    /* ignore */
  }

  console.error("[feedback] GitHub create issue failed", {
    status: res.status,
    detail: detail.slice(0, 500),
    owner: opts.owner,
    repo: opts.repo,
  });

  if (res.status === 422) {
    throw new GithubFeedbackIssueError(
      "GitHub rejected the issue (often missing repo labels feedback, bug, enhancement). Check server logs.",
      res.status,
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new GithubFeedbackIssueError("GitHub auth failed", res.status);
  }
  throw new GithubFeedbackIssueError(
    `GitHub request failed (${res.status})`,
    res.status,
  );
}
