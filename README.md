# LaravelGo

VS Code extension for navigating Laravel projects. Browse model-related files and jump between Inertia controllers and Vue pages.

## Features

### Model Related Files

Opens a quick-pick menu listing all files related to an Eloquent model — migrations, factories, seeders, resources, policies, controllers, observers, and form requests.

Activates on any PHP file in the `App\Models` or `Modules\{Module}\Models` namespace. A CodeLens appears above each model class declaration showing the count of related files found.

```
$(files) 4 related files         ← click to open menu
class User extends Model
```

Click the lens to choose a file. The selected file opens in a split editor to the right.

**Command:** `Model: Show Related Files` — also available via right-click context menu on any PHP file.

**Supported file types:**

| Label | Path |
|-------|------|
| Migration | `database/migrations/**/*{table}*.php` |
| Factory | `database/factories/{Model}Factory.php` |
| Seeder | `database/seeders/{Model}Seeder.php` |
| Resource | `app/Http/Resources/**/*{Model}Resource.php` |
| Policy | `app/Policies/{Model}Policy.php` |
| Controller | `app/Http/Controllers/**/*{Model}Controller.php` |
| Observer | `app/Observers/{Model}Observer.php` |
| Request | `app/Http/Requests/**/{Model}/*Request.php` |
| Livewire | `app/Livewire/**/{Model}/*.php` |
| Service | `app/Services/{Model}/*.php`, `app/Services/**/{Model}Service.php` |
| Enum | `app/Enums/{Model}/*.php` |
| Export | `app/Exports/{Model}/*.php`, `app/Exports/**/{Model}Export.php` |
| Import | `app/Imports/**/{Model}Import.php` |
| Job | `app/Jobs/**/*{Model}*Job.php` |

**Table name resolution** — an explicit `protected $table = '...'` on the model wins over the name derived from the class. This matters for modules, which routinely prefix tables (`Attendance` -> `hrm_attendances`) and for singular pivot tables (`DealUser` -> `crm_deal_user`) that a class-derived name never matches.

Models are read with the bundled tree-sitter PHP grammar, not by regex, so commented-out code, docblocks and string literals never register as classes or table names, and a `$table` declared inside a nested anonymous class is not credited to the model around it.

If `$table` is computed rather than a plain literal (`self::PREFIX . 'notes'`), the class-derived name is used instead and the lens tooltip says so.

---

### Modules

[nwidart/laravel-modules](https://github.com/nWidart/laravel-modules) packages are detected automatically by scanning for `Modules/*/module.json`.

A model in `Modules/HRM/app/Models/Attendance.php` searches **only inside `Modules/HRM/`**. The paths in the table above are resolved relative to the module root, with the `app/` ones relative to the module's PHP source folder:

```
Modules/HRM/database/migrations/**/*hrm_attendances*.php
Modules/HRM/app/Http/Resources/**/*AttendanceResource.php
Modules/HRM/app/Livewire/**/Attendance/*.php
```

The search never crosses out of the module — a module model will not surface another module's files or the host application's.

Both nwidart layouts work: the modern one with PHP under `Modules/{Module}/app/`, and the legacy one with `Http/`, `Models/` etc. directly in the module root. The layout is detected by probing for the `app/` directory.

Models outside a module keep searching the workspace root exactly as before.

> **Not covered:** Inertia go-to-definition, the missing-component diagnostic, and the Vue page CodeLens still resolve against the root `resources/js/{Module}/Pages/`. Modules are not consulted for Inertia component paths.

---

### Inertia Go-to-Definition

Ctrl+Click (or F12) on any Inertia component string in a PHP controller to jump directly to the Vue file.

```php
return inertia('AdminPanel/BlogSetup/BlogList');
//              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//              Ctrl+Click to open the Vue file
```

**Segment navigation** — clicking a middle segment reveals the corresponding directory in the Explorer instead of opening a file:

| Cursor on | Action |
|-----------|--------|
| `AdminPanel` | Reveals `resources/js/AdminPanel/` in Explorer |
| `BlogSetup` | Reveals `resources/js/AdminPanel/Pages/BlogSetup/` in Explorer |
| `BlogList` | Opens `resources/js/AdminPanel/Pages/BlogSetup/BlogList.vue` |

Supports both `inertia('...')` and `Inertia::render('...')`, including multiline form:

```php
return Inertia::render(
    'AdminPanel/BlogSetup/BlogList',
    ['blogs' => $blogs]
);
```

**Missing component error** — if the Vue file does not exist, an error diagnostic (red squiggly) appears under the component string. Ctrl+Clicking it shows an error notification with a **Create File** button that scaffolds the Vue file and opens it.

---

### Vue Page → Controller CodeLens

When opening a Vue page that is rendered via Inertia, a CodeLens at the top of the file links back to the controller method that renders it.

```
$(server) BlogController@index     ← click to jump to that line
```

Supports multiple controllers rendering the same component.

The controller index is built lazily on first use and updated automatically when PHP files change.

---

## Path Convention

Component strings omit the `Pages` directory segment. LaravelGo inserts it automatically:

```
'AdminPanel/Dashboard'
 └─ resources/js/AdminPanel/Pages/Dashboard.vue

'VendorPanel/Products/Index'
 └─ resources/js/VendorPanel/Pages/Products/Index.vue
```

---

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `modelRelatedFiles.openInSplit` | boolean | `true` | Open related files in a split editor |
| `modelRelatedFiles.buttonPosition` | string | `"after-class"` | Position of the Related Files button |
| `modelRelatedFiles.searchDirectories` | string[] | `[".", "./components", ".."]` | Extra directories to search |
| `modelRelatedFiles.filePatterns` | object | `{}` | Custom file pattern mappings |
| `modelRelatedFiles.modules.enabled` | boolean | `true` | Detect modules and scope a module model's search to its own module |
| `modelRelatedFiles.modules.path` | string | `"Modules"` | Directory holding the modules, matching `paths.modules` in `config/modules.php` |

> `searchDirectories`, `filePatterns` and `buttonPosition` are declared in `package.json` but not read by any code yet.

---

## Installation

The extension is not on the Marketplace yet. Pick one of the three ways below.

Common prerequisites for all three:

```bash
git clone <repo-url> laravel-go
cd laravel-go
npm install
npm run compile     # builds out/ — the extension will not load without it
```

> `out/` is gitignored, so `npm run compile` is mandatory on a fresh clone.

---

### A — Extension Development Host (try it, no install)

Open the repo folder in VS Code and press **F5**.

A second VS Code window ("Extension Development Host") launches with LaravelGo loaded. Open a Laravel project in that window to test.

- Fastest way to poke at it.
- Nothing is installed — the extension exists only while that window is open.
- Reload the dev host with `Cmd+R` / `Ctrl+R` after recompiling.

---

### B — Package and install a `.vsix` (real install)

```bash
npx @vscode/vsce package
# → laravelgo-0.0.1.vsix

code --install-extension laravelgo-0.0.1.vsix
```

Then reload the window.

No `code` on your `PATH`? Either run **Shell Command: Install 'code' command in PATH** from the Command Palette, or install through the UI: **Extensions** panel → `...` menu → **Install from VSIX...**

- `vsce` may warn about a missing `LICENSE` or `repository` field — answer `y` to continue, or add them.
- Bump `version` in [package.json](package.json) before repackaging, otherwise VS Code may keep the cached build.
- Every code change needs a repackage and reinstall.

---

### C — Symlink into the extensions folder (recommended for development)

```bash
# macOS / Linux
ln -s "$(pwd)" ~/.vscode/extensions/blinkerboy.laravelgo

# Windows (PowerShell, as Administrator)
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.vscode\extensions\blinkerboy.laravelgo" -Target (Get-Location)
```

Reload the window (**Developer: Reload Window**) and the extension is active.

The folder name does not matter. [src/phpParserUtil.ts](src/phpParserUtil.ts) resolves the bundled `tree-sitter-php_only.wasm` from `context.extensionUri`, so any folder name works.

> Earlier builds looked the extension up by id and broke silently under any other folder name.

Development loop:

```bash
npm run watch       # recompiles on save
```

then **Developer: Reload Window** to pick up the new build. No repackaging, no version bumps.

**Uninstall:** `rm ~/.vscode/extensions/blinkerboy.laravelgo` — that removes the symlink only, not the repository.

If the extension never shows up in the Extensions list, your VS Code build is skipping symlinked folders; use way B instead.

---

### Which one

| Way | Installs | Repackage per change | Best for |
|-----|----------|----------------------|----------|
| A — F5 dev host | No | No (reload dev host) | Quick trial, debugging with breakpoints |
| B — `.vsix` | Yes | Yes | Using it day to day, sharing the build |
| C — symlink | Yes | No (reload window) | Ongoing development |

---

## Requirements

- PHP files must use the `App\Models` or `Modules\{Module}\Models` namespace for model lenses to activate.
- Inertia navigation requires a Laravel project with Vue pages under `resources/js/{Module}/Pages/`.

---

## Release Notes

### 0.0.1

Initial release — model related files, Inertia go-to-definition, Vue page back-navigation.
