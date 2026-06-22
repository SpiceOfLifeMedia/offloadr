/**
 * Seed a deterministic demo organization for Offloadr local dev.
 *
 * Idempotent: re-running is safe. Creates "Demo School" if missing,
 * three users (admin/producer/student) with bcrypt-hashed `demo1234`
 * if missing, three memberships, and 2 demo projects owned by the
 * producer if missing.
 *
 * Run with: pnpm --filter @workspace/offloadr-api run seed:demo
 */
import bcrypt from "bcrypt";
import {
  db,
  usersTable,
  organizationsTable,
  organizationMembershipsTable,
  projectsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";

const ORG_SLUG = "demo-school";
const PASSWORD = "demo1234";

interface SeedUser {
  email: string;
  name: string;
  role: "admin" | "producer" | "student";
  isOwner: boolean;
}

const SEED_USERS: SeedUser[] = [
  { email: "admin@demo.test", name: "Demo Admin", role: "admin", isOwner: true },
  { email: "producer@demo.test", name: "Demo Producer", role: "producer", isOwner: false },
  { email: "student@demo.test", name: "Demo Student", role: "student", isOwner: false },
];

const SEED_PROJECTS = [
  {
    projectName: "Episode 12 — Pilot Recording",
    episodeTitle: "Pilot Recording",
    clientName: "Demo School Newsroom",
    description: "Two-camera pilot for the school broadcast program.",
    expectedCameraCount: 2,
    expectedAudioSetup: "Two lavalier mics + room mic",
  },
  {
    projectName: "Documentary Project — Local History",
    episodeTitle: "Local History",
    clientName: "Demo School History Class",
    description: "Field recordings + interviews for the local history doc.",
    expectedCameraCount: 1,
    expectedAudioSetup: "Single shotgun mic",
  },
];

async function main(): Promise<void> {
  console.log("[seed] starting Offloadr demo org seed");

  // 1. Org
  let [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, ORG_SLUG));
  if (!org) {
    [org] = await db
      .insert(organizationsTable)
      .values({ name: "Demo School", slug: ORG_SLUG, displayName: "Demo School" })
      .returning();
    console.log(`[seed] created organization "${org.name}" (id=${org.id})`);
  } else {
    console.log(`[seed] organization "${org.name}" already exists (id=${org.id})`);
  }

  // 2. Users + memberships
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const userByEmail: Record<string, number> = {};

  for (const u of SEED_USERS) {
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, u.email));
    if (!user) {
      [user] = await db
        .insert(usersTable)
        .values({ email: u.email, name: u.name, passwordHash })
        .returning();
      console.log(`[seed] created user ${u.email} (id=${user.id})`);
    } else {
      console.log(`[seed] user ${u.email} already exists (id=${user.id})`);
    }
    userByEmail[u.email] = user.id;

    const [existingMembership] = await db
      .select()
      .from(organizationMembershipsTable)
      .where(
        and(
          eq(organizationMembershipsTable.userId, user.id),
          eq(organizationMembershipsTable.organizationId, org.id),
        ),
      )
      .limit(1);
    if (!existingMembership) {
      await db.insert(organizationMembershipsTable).values({
        userId: user.id,
        organizationId: org.id,
        role: u.role,
        isOwner: u.isOwner,
      });
      console.log(`[seed]   → membership ${u.role}${u.isOwner ? " (owner)" : ""} added`);
    } else {
      console.log(`[seed]   → membership already exists (${existingMembership.role})`);
    }
  }

  // 3. Demo projects (owned by producer)
  const producerId = userByEmail["producer@demo.test"]!;
  const existingProjects = await db
    .select({ projectName: projectsTable.projectName })
    .from(projectsTable)
    .where(eq(projectsTable.organizationId, org.id));
  const existingNames = new Set(existingProjects.map((p) => p.projectName));

  for (const p of SEED_PROJECTS) {
    if (existingNames.has(p.projectName)) {
      console.log(`[seed] project "${p.projectName}" already exists`);
      continue;
    }
    await db.insert(projectsTable).values({
      userId: producerId,
      organizationId: org.id,
      projectName: p.projectName,
      episodeTitle: p.episodeTitle,
      clientName: p.clientName,
      description: p.description,
      expectedCameraCount: p.expectedCameraCount,
      expectedAudioSetup: p.expectedAudioSetup,
      status: "draft",
    });
    console.log(`[seed] created project "${p.projectName}"`);
  }

  console.log("\n[seed] done.");
  console.log("        Login with any of:");
  for (const u of SEED_USERS) console.log(`          ${u.email}  (password: ${PASSWORD})  role=${u.role}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] FAILED:", err);
    process.exit(1);
  });
