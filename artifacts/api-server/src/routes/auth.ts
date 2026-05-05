import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { name, email, password, studioName } = req.body as Record<string, string>;

  if (!name || !email || !password) {
    res.status(400).json({ error: "Bad Request", message: "name, email, and password are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Bad Request", message: "Password must be at least 6 characters" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    res.status(409).json({ error: "Conflict", message: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    name,
    email: email.toLowerCase(),
    passwordHash,
    studioName: studioName ?? null,
  }).returning();

  const sess = req.session as Record<string, unknown>;
  sess["userId"] = user.id;

  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studioName: user.studioName,
      createdAt: user.createdAt,
    },
    message: "Account created successfully",
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as Record<string, string>;

  if (!email || !password) {
    res.status(401).json({ error: "Unauthorized", message: "Email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));

  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
    return;
  }

  const sess = req.session as Record<string, unknown>;
  sess["userId"] = user.id;

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studioName: user.studioName,
      createdAt: user.createdAt,
    },
    message: "Logged in successfully",
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
    studioName: user.studioName,
    createdAt: user.createdAt,
  });
});

export default router;
