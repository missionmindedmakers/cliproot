# Packaging Tradeoff: Source Paths vs `dist` Consumption

This note compares two ways for apps in the monorepo to consume ClipRoot packages:

1. Source-relative resolution
2. Package-style resolution through built `dist/` outputs

The question matters because these packages may later be published to npm, and apps like the playground may eventually move into their own repository.

## The Two Approaches

### 1. Source-relative resolution

The app resolves imports like `@cliproot/core` or `@cliproot/protocol` to local source files such as `../../packages/core/src/index.ts`.

This is what the playground now does in local development via Vite aliases and TypeScript `paths`.

### 2. `dist`-based package resolution

The app resolves packages the same way an external consumer would: through `package.json` `exports`, which point at built artifacts under `dist/`.

This is how the workspace was behaving before. It is also the shape we would have after publishing to npm.

## Benefits of Source-relative Resolution

- Better monorepo developer experience. `pnpm --filter @cliproot/playground dev` can work without first rebuilding every dependency.
- Fewer stale artifact problems. We avoid the class of failure where source code changed but `dist/` still contains old JS or old `.d.ts`.
- Faster iteration across package boundaries. Editing `packages/core` or `packages/tiptap` is reflected immediately in the app.
- Easier debugging. Stack traces and source maps line up more directly with the files we are editing.
- Better for active refactors. When package APIs are moving quickly, source consumption reduces friction.

## Costs of Source-relative Resolution

- It is less faithful to the published-consumer experience. The app may work locally even if the package's `exports`, `files`, or build output are broken.
- It can mask packaging bugs. Missing subpath exports, missing generated files, and incorrect declaration output may go unnoticed.
- It couples the app to monorepo structure. Paths like `../../packages/protocol/src/index.ts` are convenient locally but meaningless once the app moves to another repository.
- Tooling becomes app-specific. Vite aliases and TypeScript `paths` must be kept in sync, and each app needs its own configuration.

## Benefits of `dist`-based Resolution

- It matches the npm consumer contract. The app uses the same entrypoints that outside projects will use.
- It validates packaging boundaries continuously. If `exports`, generated declarations, or publishable files are wrong, the app fails early.
- It is structurally compatible with a future repo split. A standalone playground repo should consume published packages, not sibling source trees.
- It encourages package discipline. Build output becomes a first-class artifact rather than a side effect.

## Costs of `dist`-based Resolution

- Worse local ergonomics in a fast-moving monorepo. Developers often need to rebuild dependent packages before the app runs.
- Stale `dist/` output is easy to hit. That was the source of the recent mismatch: the app picked up outdated package artifacts.
- More confusing failures. The error often appears in the app even though the real issue is an older dependency build.
- Slower edit-test loop. Multi-package changes require more explicit build orchestration.

## How This Interacts with a Future npm Split

If the playground moves into its own repository, the final state should almost certainly be package-style consumption:

- install published `@cliproot/*` packages
- consume only exported entrypoints
- avoid direct source-path knowledge of the monorepo

That argues in favor of keeping the package contract healthy even if we use source aliases locally today.

In other words:

- source-relative resolution is good for monorepo development
- `dist`-based resolution is the right model for release validation and external adoption

These are not mutually exclusive goals.

## Recommended Position

Use a hybrid approach:

- Keep app-local source aliases for monorepo development convenience.
- Keep package `exports` pointing at `dist/`, because that is still the public contract.
- Keep package builds healthy and explicit, using TypeScript project references where needed to avoid stale-type issues between packages.
- Add validation that exercises the package boundary, so local source aliasing does not hide publish-time breakage.

This gives us good local DX without pretending that the monorepo path layout is the real package API.

## Practical Guardrails

If we continue with the current source-relative setup for in-repo apps, we should add or preserve checks like:

- package builds for every published package
- package typechecks that run against build outputs where relevant
- a CI step that installs or consumes packed tarballs (`pnpm pack`) for at least one downstream smoke test
- tests that verify exported subpaths such as `@cliproot/protocol/hash` and `@cliproot/protocol/types`

That way:

- developers get the fast local path
- CI still catches broken publish boundaries

## Recommendation for ClipRoot Right Now

Given the current state of the repo, source-relative resolution is the better default for app development inside this monorepo.

Reason:

- package APIs are still evolving
- stale `dist/` artifacts have already caused confusing breakage
- there are multiple internal apps now (`playground`, `registry`), so fast cross-package iteration matters

But this should be treated as a development convenience, not as the long-term package consumption model.

When the playground is prepared to move into its own repository, the migration path should be:

1. Remove app-local source aliases.
2. Consume published or packed `@cliproot/*` packages only.
3. Fix any issues exposed by real package-boundary usage.
4. Keep the monorepo apps on source aliases only if we still want that faster local workflow.

## Bottom Line

If the priority is local velocity, source-relative resolution is better.

If the priority is validating the exact experience external consumers will have, `dist`-based resolution is better.

For ClipRoot, the best tradeoff is:

- source-relative resolution for in-repo app development
- `dist`/published-package validation in CI and release workflows

That keeps local development pleasant without losing sight of the future npm and multi-repo story.
