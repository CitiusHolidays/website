# Vercel CI and Production release gating

**Research ticket:** [Determine supported Vercel gating mechanisms and current project capability](https://github.com/CitiusHolidays/website/issues/242)

**Evidence date:** 2026-08-19

**Repository revision:** `8bb7d680c713b9af6c7ee6f853490bc3905bc966`

## Answer in brief

The current system has no enforced relationship between Hosted Quality and Vercel. Vercel's Git integration starts a Production build on `main` immediately and assigns Production domains after that build succeeds, even when the GitHub Action for the same revision is red.

There are two materially different ways to change that behavior:

1. **Build now, promote only after green:** keep Vercel's Git build, then configure Deployment Checks so the built deployment is not assigned to Production domains until the selected check passes. Vercel documents this as a promotion gate, not a build gate.
2. **Do not build until green:** disable Vercel's automatic Git deployment for `main` and make a successful GitHub Actions job run `vercel build` and `vercel deploy --prebuilt`. A staged variant can deploy with `--prod --skip-domain` and promote later. This moves deployment authority and project/environment access into GitHub Actions.

A practical hybrid is available: preserve automatic Preview deployments for non-`main` branches, disable only `main` automatic deployment, and let a green Production workflow build/deploy. The final choice needs the grilling ticket because these options trade earlier feedback and Vercel build cache behavior against stronger sequencing and broader CI secrets.

## Current project evidence

Read-only first-party evidence shows:

- GitHub Actions run [32224772201](https://github.com/CitiusHolidays/website/actions/runs/32224772201) concluded **failure** for `Target-neutral quality` at the exact revision above.
- GitHub's commit-status API records Vercel **success** for the same revision and links deployment `dpl_FywqqXnHCbKbQDFcEmDQqw1yj8et`.
- GitHub's branch-protection endpoint returns `404` for `main`, and the repository rulesets endpoint returns an empty array. No required check currently prevents a red revision from reaching `main`.
- The authenticated Vercel API reports project `website` under `divyanshu-sharmas-projects-b01e6dc2` is on the **Hobby** plan, has `gitProviderOptions.createDeployments = "enabled"`, and has `autoAssignCustomDomains = true`.
- Vercel reports the deployment for this revision as `target = "production"`, `readyState = "READY"`, and `readySubstate = "PROMOTED"`; its aliases include `citiusholidays.com` and `www.citiusholidays.com`.
- The Vercel project-checks endpoint returns zero checks. The deployment-checks endpoint and deployment check-runs endpoint also return empty lists for the same Production deployment.
- The repository's [`vercel.json`](../../vercel.json) defines no `git.deploymentEnabled` policy. Its build command is `bunx convex deploy --cmd 'bun run build'`, so moving the Vercel build into GitHub Actions would also move use of the target-scoped Convex deploy key into that workflow.
- The sole hosted workflow, [`.github/workflows/hosted-quality.yml`](../../.github/workflows/hosted-quality.yml), contains no Vercel command, deployment job, environment, or deployment dependency.

No Vercel setting, GitHub rule, secret, deployment, alias, or Production state was changed during this research.

## Build versus promotion

Vercel's [Deployment Checks documentation](https://vercel.com/docs/deployment-checks) explicitly separates a Production build from release to the Production domains. With checks configured, a push still creates the Production deployment; Vercel withholds automatic domain assignment until every selected check passes. `Force Promote` is the documented bypass.

The [Checks API](https://vercel.com/docs/checks) is the deployment-native mechanism used by integrations after a deployment is created. A check configured as blocking can prevent domain assignment; a non-blocking check cannot. The [check anatomy](https://vercel.com/docs/checks/creating-checks) documents reruns, skipping, deployment association, and the fact that only the automatic deployment URL is available while checks run.

Neither mechanism prevents the build itself. Preventing the build requires changing who is allowed to initiate the deployment.

## Mechanism matrix

| Mechanism | Red Hosted Quality | Production effect | Preview effect | Required authority and configuration | Bypass / rollback | Cost, latency, and race notes |
| --- | --- | --- | --- | --- | --- | --- |
| GitHub-backed Deployment Checks | Does **not** stop the Vercel build. If this exact Action/job is selected, red or missing status holds promotion. | Build exists at its automatic URL; Production aliases wait for green. | Existing automatic Preview builds can continue. Deployment Checks govern the Production deployment lifecycle described by Vercel. | Vercel for GitHub connection, automatic Production aliasing, a uniquely named GitHub check, and authenticated project permission to select it. `repository_dispatch` flows require Vercel's status action to bind status to the triggering commit. | `Force Promote` bypasses checks. Ordinary Vercel rollback remains a separate operator action. | Consumes Vercel build time before CI resolves, but permits build and CI to overlap. Vercel warns that duplicate job/check names collide across workflows and can race with GitHub branch protection and Vercel checks. |
| Native Vercel Checks API / integration | Does **not** stop the build; a blocking failed check stops successful domain assignment after deployment creation. | Blocking checks gate aliases; non-blocking checks only report. | Runs against the deployment it is registered to; scope must be chosen by the integration. | An integration with deployment-check read/write scope, deployment webhooks, and a service that creates/updates the check. This is more infrastructure than selecting an existing GitHub Action. | Rerequestable checks can rerun; completed checks can be skipped under Vercel's documented rules. Promotion/rollback permissions remain separate. | Adds a post-build validation service and its runtime. Avoid creating a second result for the same logical check unless identities are deliberately distinct. |
| `git.deploymentEnabled` for `main` + GitHub Actions `vercel build` / `vercel deploy --prebuilt` | A failed upstream job prevents the deploy job from running, so no Vercel build/deployment is initiated by that workflow. | Production deployment starts only after green. `--prod --skip-domain` can stage it; `vercel promote` can be a distinct gate. | Non-`main` branches can remain enabled for automatic Preview deployments; Vercel's Git configuration supports branch-specific values. | Versioned [`git.deploymentEnabled`](https://vercel.com/docs/project-configuration/git-configuration) configuration; GitHub environment protection as desired; `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; `vercel pull`; and all build-time Production inputs, including the correctly scoped Convex deploy key for this repository. Vercel's [GitHub Actions guide](https://vercel.com/docs/git/vercel-for-github) supplies the supported build/prebuilt flow. | GitHub rerun or an explicitly authorized manual deployment is the operational bypass. A staged deployment can be promoted or discarded; Vercel rollback remains available after promotion. | Serial CI-then-build raises wall-clock release latency but avoids paying for a doomed Vercel build. Prebuilt deployments lack Vercel System Environment Variables at build time unless supplied another way, per the [`vercel deploy` reference](https://vercel.com/docs/cli/deploy). Moving the build changes cache, audit, and secret boundaries. |
| Keep current automatic Git deployment | Red Action has no effect. | Successful Vercel build is automatically promoted and aliased. | Automatic Preview behavior remains unchanged. | No change. | Existing Vercel rollback only. | Lowest setup and fastest release; does not satisfy the stated safety destination. This is the behavior observed at the evidence revision. |

## GitHub required checks are a separate gate

Vercel promotion policy does not protect `main` from a red merge or direct push. GitHub's [protected-branch contract](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) requires selected checks to be successful, skipped, or neutral before a protected branch can be updated. GitHub also allows a required check to be pinned to its expected GitHub App source.

The design should therefore use two explicit gates:

1. a GitHub rule that controls entry to `main`; and
2. a Vercel sequencing/promotion rule that controls what reaches Production.

Use a stable, unique required job name. Vercel and GitHub both warn that identical job names across workflows can produce ambiguous or colliding status results.

## Recommendation for the grilling ticket

Compare these two finalists:

- **Lower operational change:** require Hosted Quality in GitHub and add the same uniquely identified check as a Vercel Deployment Check. This keeps Vercel/Convex build credentials where they are, provides a built deployment URL for inspection, and holds Production aliases. It does not prevent the build or its cost.
- **Stronger sequencing:** keep automatic Preview deployments, disable automatic `main` deployments, and run a target-explicit Production deploy job only after the canonical quality job succeeds. Consider `--skip-domain` plus a separate promotion step if authenticated browser checks must run against the exact built artifact. This prevents a red candidate from building through Vercel but moves high-impact Vercel and Convex authority into GitHub Actions.

Do not combine both without assigning one canonical check identity and one bypass path. A hybrid with duplicated statuses can create the exact name/race problem Vercel documents.

## Remaining capability question

The plan is verified as Hobby, the Git deployment is verified as enabled, and all current project/deployment check collections are verified empty. The read-only API does not prove that this Hobby project's authenticated **Settings → Deployment Checks → Add Checks** UI currently exposes the GitHub-backed selector or which exact Action identity it offers. That dashboard entitlement/selector check is the remaining blocker before selecting the lower-change option. It can be resolved read-only by an authorized project member; no check needs to be created to answer it.

The CI-built/prebuilt option does not depend on that selector, but its secret and environment migration must be designed and rehearsed in non-Production before any Production authority changes.
