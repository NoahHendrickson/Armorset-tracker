import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";
import { requireSessionFromRequest } from "@/lib/auth/session";
import { githubFeedbackIssueConfig } from "@/lib/env";
import {
  createGithubFeedbackIssue,
  GithubFeedbackIssueError,
  sanitizeFeedbackPagePath,
} from "@/lib/github/create-feedback-issue";

const postSchema = z.object({
  category: z.enum(["bug", "wishlist"]),
  message: z.string().trim().min(1).max(8000),
  pagePath: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const blocked = crossSiteOriginBlockResponse(req);
  if (blocked) return blocked;

  let session;
  try {
    session = await requireSessionFromRequest(req);
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const gh = githubFeedbackIssueConfig();
  if (!gh) {
    return NextResponse.json({ error: "Feedback is unavailable." }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const pagePath = sanitizeFeedbackPagePath(parsed.data.pagePath);

  try {
    await createGithubFeedbackIssue({
      owner: gh.owner,
      repo: gh.repo,
      token: gh.token,
      category: parsed.data.category,
      message: parsed.data.message,
      pagePath,
      session,
    });
  } catch (err) {
    if (err instanceof GithubFeedbackIssueError) {
      return NextResponse.json(
        { error: "Could not submit feedback. Try again later." },
        { status: 502 },
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
