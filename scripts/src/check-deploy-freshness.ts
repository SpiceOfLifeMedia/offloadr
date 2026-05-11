import { execSync } from "node:child_process";

type Risk = {
  label: string;
  matcher: (path: string) => boolean;
  matches: string[];
};

const DEFAULT_THRESHOLD = 10;

function parseThreshold(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_THRESHOLD;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    console.warn(
      `Ignoring invalid DEPLOY_FRESHNESS_MAX_COMMITS=${JSON.stringify(raw)}; expected a non-negative integer. Using default ${DEFAULT_THRESHOLD}.`,
    );
    return DEFAULT_THRESHOLD;
  }
  return parsed;
}

const COMMIT_THRESHOLD = parseThreshold(process.env.DEPLOY_FRESHNESS_MAX_COMMITS);

function git(args: string[]): string {
  return execSync(`git --no-optional-locks ${args.join(" ")}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function findLastPublishSha(): string | null {
  try {
    const sha = git([
      "log",
      "--grep",
      `'^Published your App$'`,
      "-1",
      "--format=%H",
    ]);
    return sha || null;
  } catch {
    return null;
  }
}

function listChangedFiles(fromSha: string, toSha: string): string[] {
  const out = git(["diff", "--name-only", `${fromSha}..${toSha}`]);
  if (!out) return [];
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

function listChangedArtifactDirs(fromSha: string, toSha: string): {
  added: string[];
  removed: string[];
} {
  const status = git([
    "diff",
    "--name-status",
    "--diff-filter=AD",
    `${fromSha}..${toSha}`,
    "--",
    "artifacts/",
  ]);
  const added = new Set<string>();
  const removed = new Set<string>();
  if (status) {
    for (const line of status.split("\n")) {
      const [tag, ...rest] = line.split("\t");
      const path = rest.join("\t");
      const match = path.match(/^artifacts\/([^/]+)\//);
      if (!match) continue;
      const dir = `artifacts/${match[1]}`;
      if (tag === "A") added.add(dir);
      else if (tag === "D") removed.add(dir);
    }
  }
  // Only report as add/remove of an entire artifact when the artifact.toml moved.
  const filterByToml = (set: Set<string>, tag: "A" | "D"): string[] => {
    const result: string[] = [];
    for (const dir of set) {
      try {
        const tomlStatus = git([
          "diff",
          "--name-status",
          `${fromSha}..${toSha}`,
          "--",
          `${dir}/.replit-artifact/artifact.toml`,
        ]);
        if (tomlStatus.startsWith(tag)) result.push(dir);
      } catch {
        // ignore
      }
    }
    return result.sort();
  };
  return {
    added: filterByToml(added, "A"),
    removed: filterByToml(removed, "D"),
  };
}

function commitsAhead(fromSha: string, toSha: string): number {
  const out = git(["rev-list", "--count", `${fromSha}..${toSha}`]);
  const n = Number(out);
  return Number.isFinite(n) ? n : 0;
}

function shortSha(sha: string): string {
  return sha.slice(0, 8);
}

function publishCommitDate(sha: string): string {
  try {
    return git(["show", "-s", "--format=%ci", sha]);
  } catch {
    return "unknown";
  }
}

function main(): void {
  const head = git(["rev-parse", "HEAD"]);
  const lastPublish = findLastPublishSha();

  console.log("Deploy freshness check");
  console.log("======================");
  console.log(`HEAD:           ${shortSha(head)}`);

  if (!lastPublish) {
    console.log(
      "No 'Published your App' commit found in history. Nothing to compare against.",
    );
    console.log(
      "If this repo has never been published, click Publish in the Replit workspace.",
    );
    process.exit(0);
  }

  console.log(`Last publish:   ${shortSha(lastPublish)}  (${publishCommitDate(lastPublish)})`);

  if (head === lastPublish) {
    console.log("Live deploy is up to date with HEAD. ✓");
    process.exit(0);
  }

  const ahead = commitsAhead(lastPublish, head);
  console.log(`Commits ahead:  ${ahead}`);

  const changed = listChangedFiles(lastPublish, head);

  const risks: Risk[] = [
    {
      label: "Backend route handlers (artifacts/api-server/src/routes/**)",
      matcher: (p) => p.startsWith("artifacts/api-server/src/routes/"),
      matches: [],
    },
    {
      label: "API server source (artifacts/api-server/src/**)",
      matcher: (p) =>
        p.startsWith("artifacts/api-server/src/") &&
        !p.startsWith("artifacts/api-server/src/routes/"),
      matches: [],
    },
    {
      label: "OpenAPI spec / shared API contract (lib/api-spec/**)",
      matcher: (p) => p.startsWith("lib/api-spec/"),
      matches: [],
    },
    {
      label: "Database schema / migrations (lib/db/**)",
      matcher: (p) => p.startsWith("lib/db/"),
      matches: [],
    },
    {
      label: "Replit deployment config (.replit)",
      matcher: (p) => p === ".replit",
      matches: [],
    },
  ];

  for (const file of changed) {
    for (const risk of risks) {
      if (risk.matcher(file)) risk.matches.push(file);
    }
  }

  const { added, removed } = listChangedArtifactDirs(lastPublish, head);

  const triggered = risks.filter((r) => r.matches.length > 0);
  const overThreshold = ahead > COMMIT_THRESHOLD;
  const artifactSetChanged = added.length > 0 || removed.length > 0;

  if (triggered.length === 0 && !artifactSetChanged && !overThreshold) {
    console.log("");
    console.log(
      `${ahead} commit(s) ahead of the live deploy, but nothing in the deploy-sensitive paths changed. ✓`,
    );
    process.exit(0);
  }

  console.log("");
  console.log("⚠  Live deploy may be stale. Differences since the last publish:");
  console.log("");

  if (overThreshold) {
    console.log(
      `• ${ahead} commits ahead (threshold is ${COMMIT_THRESHOLD}). Consider re-publishing.`,
    );
  }

  if (added.length > 0) {
    console.log(`• Artifacts added since last publish: ${added.join(", ")}`);
  }
  if (removed.length > 0) {
    console.log(`• Artifacts removed since last publish: ${removed.join(", ")}`);
  }

  for (const risk of triggered) {
    console.log("");
    console.log(`• ${risk.label} — ${risk.matches.length} file(s):`);
    for (const file of risk.matches.slice(0, 20)) {
      console.log(`    - ${file}`);
    }
    if (risk.matches.length > 20) {
      console.log(`    ... and ${risk.matches.length - 20} more`);
    }
  }

  console.log("");
  console.log("Action: open the Replit workspace and click Publish to roll out HEAD.");
  console.log(
    "(Run with DEPLOY_FRESHNESS_MAX_COMMITS=<n> to change the commit threshold.)",
  );
  process.exit(1);
}

main();
