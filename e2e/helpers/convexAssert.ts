import { execFileSync } from "node:child_process";

function inlineTravellerQuery(args: { fullName: string; jobCardId?: string }) {
  const fullName = JSON.stringify(args.fullName);
  if (args.jobCardId) {
    const jobCardId = JSON.stringify(args.jobCardId);
    return `const rows = await ctx.db.query("travellers").withIndex("by_jobCardId", (q) => q.eq("jobCardId", ${jobCardId})).collect(); return rows.some((row) => row.fullName === ${fullName});`;
  }
  return `const rows = await ctx.db.query("travellers").withSearchIndex("search_list", (q) => q.search("listSearchText", ${fullName})).take(20); return rows.some((row) => row.fullName === ${fullName});`;
}

export function convexTravellerExists(args: { fullName: string; jobCardId?: string }) {
  const output = execFileSync(
    "bunx",
    ["convex", "run", "--inline-query", inlineTravellerQuery(args)],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  return JSON.parse(output.trim()) as boolean;
}
