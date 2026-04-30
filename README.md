# LaravelGo

VS Code extension for navigating Laravel projects. Browse model-related files and jump between Inertia controllers and Vue pages.

## Features

### Model Related Files

Opens a quick-pick menu listing all files related to an Eloquent model — migrations, factories, seeders, resources, policies, controllers, observers, and form requests.

Activates on any PHP file in the `App\Models` namespace. A CodeLens appears above each model class declaration showing the count of related files found.

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

---

## Requirements

- PHP files must use the `App\Models` namespace for model lenses to activate.
- Inertia navigation requires a Laravel project with Vue pages under `resources/js/{Module}/Pages/`.

---

## Release Notes

### 0.0.1

Initial release — model related files, Inertia go-to-definition, Vue page back-navigation.
