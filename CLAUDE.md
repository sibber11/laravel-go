# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`laravelgo` — a VS Code extension (publisher `blinkerboy`) that adds Laravel navigation: model-related-file lookup, Inertia controller ↔ Vue page jumping. Plain `tsc` build to `out/`, no bundler.

## Commands

```bash
npm run compile      # tsc -p ./ → out/   (mandatory on fresh clone; out/ is gitignored)
npm run watch        # tsc -watch, also the default build task used by F5
npm run lint         # eslint src
npm test             # vscode-test: compiles + lints (pretest), then runs out/test/**/*.test.js
```

There is no per-test filter script. To run one test, narrow `files` in [.vscode-test.mjs](.vscode-test.mjs) or add `.only` to a Mocha `suite`/`test`. Tests boot a real VS Code instance, so they need a display / `xvfb` in headless environments.

Press **F5** to launch an Extension Development Host with the extension loaded.

## Architecture

Everything is wired in [src/extension.ts](src/extension.ts) `activate()`. Activation events: `onLanguage:php`, `onLanguage:vue`. Three independent features share two parsing strategies.

### One parsing strategy — tree-sitter, everywhere

All PHP is read with `web-tree-sitter` through [src/phpParserUtil.ts](src/phpParserUtil.ts). The grammar is the checked-in `tree-sitter-php_only.wasm` at repo root, resolved from `context.extensionUri` — `configureParser()` must run first in `activate()`. **Never reach for a regex over PHP source.** `modelParser.ts` was regex-based and was migrated; the failure modes were commented-out `$table` values winning over real ones, `class` inside comments and strings producing phantom lenses, and `new class extends Model {}` yielding a class named `extends`.

`getParser()` is the single shared instance for the whole extension — do not construct another. `getQuery(language, source)` caches compiled queries by source string.

Cost is not a reason to avoid it: 0.25 ms/file average, ~1 ms worst case, 9 ms one-time grammar load.

**Attributing a member to its class:** walk up to the first class-like node (`class_declaration`, `anonymous_class`, `interface_declaration`, `trait_declaration`, `enum_declaration`) and accept only `class_declaration` — `enclosingClass()` does this. Stopping only at `class_declaration` leaks a `$table` out of a nested `new class extends Model {}` into the model around it.

`extractComponentsFromPhp()` runs a single tree-sitter query that only matches this exact shape:

```
class_declaration > method_declaration > compound_statement > return_statement
  > scoped_call_expression  scope="Inertia"  name="render"  arguments > string
```

So it captures class + method name for free (that is what powers the reverse index), but it does **not** match the `inertia('...')` helper, assignments (`$x = Inertia::render(...)`), or renders nested inside `if`/`try`. Widening Inertia support means editing that query, not adding a regex fallback.

### Feature 1 — Model related files

[codeLensProvider.ts](src/codeLensProvider.ts) → [modelParser.ts](src/modelParser.ts) → [fileLocator.ts](src/fileLocator.ts).

A literal `protected $table` wins over `classToTableName()`, which reimplements Laravel's snake_case + pluralize locally (naive rules: `y`→`ies`, `s/x/z/ch/sh`→`es`, else `+s`). A computed `$table` (`self::PREFIX . 'x'`) cannot be resolved, so `tableSource` reports `dynamic` and the derived name is used with a lens tooltip saying why. `buildPatterns()` in `fileLocator.ts` is the single source of truth for the glob patterns — add new related-file kinds there, and mirror the table in [README.md](README.md).

`analyzeDocument()` parses once per document version and caches; `forgetDocument()` evicts on close.

**Modules** — [src/moduleResolver.ts](src/moduleResolver.ts) finds nwidart modules by globbing `<modules.path>/*/module.json`, and probes `<module>/app` to tell the modern layout from the legacy one. A model in `Modules\HRM\Models` searches **only** inside `Modules/HRM/`, via `RelativePattern` against the module root — strictly scoped, no fallback to the app root, by decision. Inertia is deliberately *not* module-aware: the reference project is Livewire-only, so there was no evidence for how module Inertia paths are named.

The lens counts files by actually running all eight `findFiles()` globs per model class, on every lens refresh. A `FileSystemWatcher` over those Laravel directories fires `onDidChangeCodeLenses`.

### Feature 2 — Inertia PHP → Vue

Three providers share [inertiaUtil.ts](src/inertiaUtil.ts):

- [inertiaDefinitionProvider.ts](src/inertiaDefinitionProvider.ts) — Ctrl+Click. Segment-aware: `segmentAt()` maps the cursor column to a path segment; the **last** segment opens the `.vue` file (offering **Create File** with a `<script setup lang="ts">` stub if missing), earlier segments instead `revealInExplorer` the corresponding directory and return the current position so the editor does not move.
- [inertiaDiagnosticProvider.ts](src/inertiaDiagnosticProvider.ts) — 500 ms debounced per-document; stats each component file and reports missing ones. Re-validates all open PHP docs when any `resources/js/**/*.vue` is created or deleted.
- [inertiaDocumentLinkProvider.ts](src/inertiaDocumentLinkProvider.ts) — plain document links, no existence check.

**Path convention** (used in both directions, keep the two ends in sync): the `Pages` segment is implicit. `Module/A/B` ⇄ `resources/js/Module/Pages/A/B.vue`. Components with fewer than 2 segments are filtered out by `extractInertiaComponents()`.

`getComponentRange()` locates the string by `lineContent.indexOf(componentName)` rather than tree-sitter node columns — it will pick the wrong span if the same substring appears earlier on the line.

### Feature 3 — Vue → controller (reverse direction)

[controllerIndexer.ts](src/controllerIndexer.ts) holds `Map<componentPath, ControllerRef[]>`, built lazily on first `ensureIndexed()` (memoized in `indexPromise`) by parsing every `**/app/Http/Controllers/**/*.php`. A watcher reindexes single files on change/create/delete and fires `onDidUpdate`, which [vueLensProvider.ts](src/vueLensProvider.ts) forwards to `onDidChangeCodeLenses`. `extractComponentPath()` there parses the Vue path back into a component string with `/^resources\/js\/(\w+)\/Pages\/(.+)\.vue$/` — the inverse of `resolveComponentFileUri()`.

Note `indexPromise` is never invalidated, so a full rebuild only happens once per session; incremental updates rely entirely on the watcher.

## Known inconsistencies (verified, unfixed)

- **Duplicated path resolution.** `resolveComponentFileUri()` in [inertiaUtil.ts](src/inertiaUtil.ts) and the private `resolveFileUri()` in [inertiaDefinitionProvider.ts](src/inertiaDefinitionProvider.ts) are the same logic.
- **Declared but unread settings.** `modelRelatedFiles.buttonPosition`, `.searchDirectories`, and `.filePatterns` exist in [package.json](package.json) and the README table but nothing in `src/` reads them. Only `openInSplit` is honoured.
- **README overstates Inertia support.** It documents the `inertia('...')` helper; the tree-sitter query only matches `Inertia::render`.
- **`parseModels()` still returns every named class** in a file with a models namespace, not just the model. Comments, strings and anonymous classes no longer produce false hits, but a file with two real classes yields two lenses.

## Conventions

- 4-space indent in `src/`, tabs in the JSON/config files. ESLint enforces `curly`, `eqeqeq`, `semi`, `no-throw-literal` (all `warn`).
- Providers that own watchers, emitters, or timers implement `vscode.Disposable` and are pushed into `context.subscriptions`.
- Parse failures are swallowed (`catch { return [] }`) so a broken PHP file degrades to no lenses rather than an error toast. User-facing errors go through the `LaravelGo` output channel created in `activate()`.
- CodeLens titles use VS Code codicons (`$(files)`, `$(server)`, `$(database)`).
- Bumping the extension `version` in [package.json](package.json) is required before repackaging a `.vsix`, or VS Code serves the cached build.
