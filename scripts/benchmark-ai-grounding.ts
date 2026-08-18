import { runCanonicalGroundingBenchmark } from "../src/lib/ai/groundingBenchmark";

const report = runCanonicalGroundingBenchmark();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.score < report.rubric.threshold) {
  process.exitCode = 1;
}
