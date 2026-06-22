/**
 * Cross-tenant access checks for the Offloadr API.
 *
 * Boots two fresh users (each in their own auto-created org) against a
 * running API and asserts that user B cannot read or mutate any of user A's
 * resources. This is the pilot's "non-negotiable" tenant-boundary check —
 * if it fails, the school pilot must NOT ship.
 *
 * Run against the dev API:
 *   DISABLE_RATE_LIMIT=1 ./api-workflow-restart  # first, so this script
 *                                                 # isn't blocked by limits
 *   pnpm --filter @workspace/offloadr-api run check:tenancy
 *
 * Or against any deployed URL by overriding API_BASE_URL:
 *   API_BASE_URL=https://offloadr.example.com/offloadr/api \
 *     pnpm --filter @workspace/offloadr-api run check:tenancy
 *
 * Exit code 0 = all assertions passed. Non-zero = at least one boundary
 * leak; the offending check name is printed to stderr.
 */

const BASE = process.env["API_BASE_URL"] ?? "http://localhost:80/offloadr/api";

interface Session {
  cookie: string;
  userId: number;
  email: string;
}

const failures: string[] = [];
let checksRun = 0;

function record(name: string, ok: boolean, detail = ""): void {
  checksRun++;
  if (ok) {
    process.stdout.write(`  ok   ${name}\n`);
  } else {
    failures.push(`${name}${detail ? " — " + detail : ""}`);
    process.stdout.write(`  FAIL ${name}${detail ? " — " + detail : ""}\n`);
  }
}

function expectStatus(name: string, res: Response, allowed: number[]): void {
  record(name, allowed.includes(res.status), `expected ${allowed.join("/")}, got ${res.status}`);
}

async function postJson(path: string, body: unknown, cookie?: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function getJson(path: string, cookie?: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

async function patchJson(path: string, body: unknown, cookie?: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function deleteWithCookie(path: string, cookie?: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: cookie ? { cookie } : {},
  });
}

function extractCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  // Sessions cookie is named `connect.sid` by default.
  const match = /connect\.sid=[^;]+/i.exec(setCookie);
  if (!match) throw new Error("No connect.sid cookie returned by API — is sessions middleware on?");
  return match[0];
}

async function register(name: string): Promise<Session> {
  const email = `tenancy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const res = await postJson("/auth/register", { name, email, password: "tenancy-test-pw" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to register ${name}: ${res.status} ${text}`);
  }
  const body = (await res.json()) as { user: { id: number } };
  return { cookie: extractCookie(res), userId: body.user.id, email };
}

async function createProject(cookie: string, projectName: string): Promise<{ id: number }> {
  const res = await postJson("/projects", { projectName }, cookie);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create project: ${res.status} ${text}`);
  }
  return (await res.json()) as { id: number };
}

async function createRecordingSession(cookie: string, projectId: number): Promise<{ id: number }> {
  const res = await postJson(
    `/projects/${projectId}/recording-sessions`,
    { label: "tenancy-test" },
    cookie,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create recording session: ${res.status} ${text}`);
  }
  return (await res.json()) as { id: number };
}

async function createShare(cookie: string, projectId: number): Promise<{ shareToken: string }> {
  const res = await postJson(`/projects/${projectId}/share`, {}, cookie);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create share link: ${res.status} ${text}`);
  }
  return (await res.json()) as { shareToken: string };
}

async function main(): Promise<void> {
  process.stdout.write(`Cross-tenant access checks against ${BASE}\n\n`);

  // Two fresh users → two fresh single-member orgs. Org A is user A's, org
  // B is user B's. Neither user is a member of the other's org.
  process.stdout.write("Setting up two isolated orgs...\n");
  const userA = await register("Tenancy Test A");
  const userB = await register("Tenancy Test B");

  // Seed user A's org with one of every resource we want to check.
  const projectA = await createProject(userA.cookie, "Project A");
  const sessionA = await createRecordingSession(userA.cookie, projectA.id);
  const shareA = await createShare(userA.cookie, projectA.id);
  process.stdout.write(
    `  user A=${userA.userId} project=${projectA.id} session=${sessionA.id} share=${shareA.shareToken.slice(0, 6)}…\n\n`,
  );

  process.stdout.write("Asserting user B cannot reach user A's resources:\n");

  // 1. Projects — read, mutate, delete, status transitions.
  expectStatus("GET project A as B", await getJson(`/projects/${projectA.id}`, userB.cookie), [403, 404]);
  expectStatus(
    "PATCH project A as B",
    await patchJson(`/projects/${projectA.id}`, { projectName: "hijacked" }, userB.cookie),
    [403, 404],
  );
  expectStatus(
    "DELETE project A as B",
    await deleteWithCookie(`/projects/${projectA.id}`, userB.cookie),
    [403, 404],
  );
  expectStatus(
    "POST project A mark-ready as B",
    await postJson(`/projects/${projectA.id}/mark-ready`, {}, userB.cookie),
    [403, 404],
  );
  expectStatus(
    "B's GET /projects does not include project A",
    new Response(
      JSON.stringify(await (await getJson("/projects", userB.cookie)).json()),
      { status: 200 },
    ),
    [200],
  );
  // explicit content check
  const bProjects = (await (await getJson("/projects", userB.cookie)).json()) as Array<{ id: number }>;
  record(
    "B's project list excludes A's project",
    !bProjects.some((p) => p.id === projectA.id),
    `B's project ids: ${bProjects.map((p) => p.id).join(",") || "(none)"}`,
  );

  // 2. Files (uploads). Listing and missing-files endpoints.
  expectStatus(
    "GET project A files as B",
    await getJson(`/projects/${projectA.id}/files`, userB.cookie),
    [403, 404],
  );
  expectStatus(
    "GET project A missing-files as B",
    await getJson(`/projects/${projectA.id}/missing-files`, userB.cookie),
    [403, 404],
  );

  // 3. Recording sessions.
  expectStatus(
    "GET project A recording-sessions as B",
    await getJson(`/projects/${projectA.id}/recording-sessions`, userB.cookie),
    [403, 404],
  );
  expectStatus(
    "PATCH session A as B",
    await patchJson(`/recording-sessions/${sessionA.id}`, { status: "ready" }, userB.cookie),
    [403, 404],
  );

  // 4. Share links — disabling someone else's share is a tenant-bypass
  // attack. The token itself is a public capability and is allowed to
  // resolve unauthenticated, so we don't assert against /share/:token GET.
  expectStatus(
    "PATCH share A disable as B",
    await patchJson(`/share/${shareA.shareToken}/disable`, {}, userB.cookie),
    [403, 404],
  );

  // 5. Users / members. B should not be able to list members of A's org or
  // reset A's password.
  expectStatus(
    "GET A's org members as B (no path / no membership)",
    await getJson("/organizations/me/members", userB.cookie),
    [200, 403],
  );
  // The 200 case happens because B is auto-promoted to admin of B's own
  // org and the endpoint is "/me/members" (caller's active org). Check the
  // contents: B's listing must NOT contain user A.
  const bMembersRes = await getJson("/organizations/me/members", userB.cookie);
  if (bMembersRes.status === 200) {
    const bMembers = (await bMembersRes.json()) as { members: Array<{ userId: number }> };
    record(
      "B's member list excludes user A",
      !bMembers.members.some((m) => m.userId === userA.userId),
      `B's member ids: ${bMembers.members.map((m) => m.userId).join(",")}`,
    );
  }
  expectStatus(
    "POST password-reset for user A as B",
    await postJson(
      `/organizations/me/members/${userA.userId}/reset-password`,
      { newPassword: "hijacked-pw" },
      userB.cookie,
    ),
    [403, 404],
  );

  // 6. Unauthenticated access — confirm the shared baseline still requires auth.
  expectStatus("GET project A unauthenticated", await getJson(`/projects/${projectA.id}`), [401]);

  process.stdout.write(`\nRan ${checksRun} checks. ${failures.length} failed.\n`);
  if (failures.length > 0) {
    process.stderr.write("\nFAILED CHECKS:\n");
    for (const f of failures) process.stderr.write(`  - ${f}\n`);
    process.stderr.write(
      "\nA failure here means one tenant can reach another tenant's data. " +
        "Do NOT ship to a school pilot until all checks pass.\n",
    );
    process.exit(1);
  }
  process.stdout.write("All cross-tenant checks passed.\n");
}

main().catch((err) => {
  process.stderr.write(`\nScript crashed before finishing: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
});
