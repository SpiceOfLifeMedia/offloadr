import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { db, usersTable, organizationsTable, organizationMembershipsTable } from "@workspace/db";
import { asc, desc, eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { loginRateLimiter, loginIpRateLimiter, registerRateLimiter } from "../lib/rateLimit";

const router: IRouter = Router();

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "school";
}

const registerSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  email: z.string().trim().email("email must be a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().trim().min(1, "email is required"),
  password: z.string().min(1, "password is required"),
});

router.post("/auth/register", registerRateLimiter, async (req, res): Promise<void> => {
  const body = parseBody(req, res, registerSchema);
  if (!body) return;
  const { name, email, password } = body;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    // Logged at info level (not warn): expected occurrence, used for abuse-pattern review.
    req.log.info({ event: "auth_register_conflict", email: email.toLowerCase() }, "Registration attempt with existing email");
    res.status(409).json({ error: "Conflict", message: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await db.transaction(async (tx) => {
    const [createdUser] = await tx.insert(usersTable).values({
      name,
      email: email.toLowerCase(),
      passwordHash,
    }).returning();

    const baseSlug = slugify(name);
    const slugCandidate = `${baseSlug}-${createdUser.id}`;
    const [createdOrg] = await tx.insert(organizationsTable).values({
      name: `${name}'s School`,
      slug: slugCandidate,
    }).returning();

    // Creator becomes the org's admin AND its owner (V1 collapses the old
    // owner role into admin + is_owner flag).
    await tx.insert(organizationMembershipsTable).values({
      userId: createdUser.id,
      organizationId: createdOrg.id,
      role: "admin",
      isOwner: true,
    });

    return { user: createdUser, organizationId: createdOrg.id };
  });

  const { user, organizationId } = result;
  req.session.userId = user.id;
  req.session.organizationId = organizationId;

  // Force the session row to be committed to Postgres BEFORE we hand
  // the cookie back to the browser. With connect-pg-simple the INSERT
  // is async; if we respond before it completes, the client's very next
  // request (typically GET /auth/me right after the redirect) arrives
  // at the server before the row exists in PG, requireAuth fails, the
  // app bounces back to /login, and the user sees "login does nothing".
  // The old in-memory store wrote synchronously so this never showed up.
  req.session.save((saveErr) => {
    if (saveErr) {
      const saveErrMessage = saveErr instanceof Error ? saveErr.message : String(saveErr);
      const saveErrCode = (saveErr as { code?: string } | null)?.code ?? null;
      req.log.error({ err: saveErr, event: "auth_register_session_save_failed", userId: user.id, pgCode: saveErrCode }, "Failed to persist session after registration");
      res.status(500).json({
        error: "Internal Server Error",
        message: `Session could not be saved: ${saveErrMessage}`,
        pgCode: saveErrCode,
      });
      return;
    }
    req.log.info({ event: "auth_register_ok", userId: user.id, organizationId }, "User registered");
    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      message: "Account created successfully",
    });
  });
});

router.post("/auth/login", loginIpRateLimiter, loginRateLimiter, async (req, res): Promise<void> => {
  const body = parseBody(req, res, loginSchema);
  if (!body) return;
  const { email, password } = body;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));

  if (!user) {
    req.log.info({ event: "auth_login_failed", reason: "no_such_user", email: email.toLowerCase() }, "Login failed");
    res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    req.log.info({ event: "auth_login_failed", reason: "bad_password", userId: user.id }, "Login failed");
    res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
    return;
  }

  // Prefer the org the user owns; deterministically tiebreak by oldest
  // membership so login always lands in the same org for a given user.
  const memberships = await db
    .select({
      organizationId: organizationMembershipsTable.organizationId,
      isOwner: organizationMembershipsTable.isOwner,
    })
    .from(organizationMembershipsTable)
    .where(eq(organizationMembershipsTable.userId, user.id))
    .orderBy(
      desc(organizationMembershipsTable.isOwner),
      asc(organizationMembershipsTable.createdAt),
      asc(organizationMembershipsTable.id),
    );
  const fallback = memberships[0];

  req.session.userId = user.id;
  if (fallback) {
    req.session.organizationId = fallback.organizationId;
  }

  // See the matching comment in /auth/register — connect-pg-simple writes
  // sessions asynchronously, so we must wait for the INSERT to complete
  // before sending the Set-Cookie back to the client. Without this, the
  // browser's immediate follow-up GET /auth/me arrives before the row is
  // in PG, fails auth, the SPA bounces back to /login, and the user sees
  // "login button does nothing" even though the POST returned 200.
  req.session.save((saveErr) => {
    if (saveErr) {
      // Surface the underlying connect-pg-simple / pg error message back
      // to the client to speed up diagnosis. This is internal store
      // plumbing (relation missing, permission denied, schema wrong) and
      // contains no user data, so it's safe to expose temporarily while
      // we stabilise the production session store.
      const saveErrMessage = saveErr instanceof Error ? saveErr.message : String(saveErr);
      const saveErrCode = (saveErr as { code?: string } | null)?.code ?? null;
      req.log.error({ err: saveErr, event: "auth_login_session_save_failed", userId: user.id, pgCode: saveErrCode }, "Failed to persist session after login");
      res.status(500).json({
        error: "Internal Server Error",
        message: `Session could not be saved: ${saveErrMessage}`,
        pgCode: saveErrCode,
      });
      return;
    }
    req.log.info({ event: "auth_login_ok", userId: user.id, organizationId: fallback?.organizationId ?? null }, "Login succeeded");
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      message: "Logged in successfully",
    });
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  });
});

export default router;
