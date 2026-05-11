import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../lib/auth";
import { parseBody } from "../lib/validate";

const router: IRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  email: z.string().trim().email("email must be a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  studioName: z.string().trim().min(1).optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().trim().min(1, "email is required"),
  password: z.string().min(1, "password is required"),
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const body = parseBody(req, res, registerSchema);
  if (!body) return;
  const { name, email, password, studioName } = body;

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

  req.session.userId = user.id;

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
  const body = parseBody(req, res, loginSchema);
  if (!body) return;
  const { email, password } = body;

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

  req.session.userId = user.id;

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
