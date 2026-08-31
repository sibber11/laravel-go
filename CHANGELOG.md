# Change Log

All notable changes to the "laravelgo" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- `nwidart/laravel-modules` support. Models in `Modules\{Module}\Models` now get the Related Files lens, with the search scoped strictly to that module's own directory. Modern (`Modules/{Module}/app/`) and legacy (`Modules/{Module}/`) layouts are both detected.
- New related-file types: Livewire component, Service, Enum, Export, Import and Job.
- Settings `modelRelatedFiles.modules.enabled` and `modelRelatedFiles.modules.path`.

### Changed

- Model parsing moved from line-based regex to the bundled tree-sitter PHP grammar, matching how the Inertia features already worked. Verified byte-for-byte identical on 157 real model files.
- One shared parser instance for the whole extension. `controllerIndexer` and `inertiaUtil` each built their own before.

### Fixed

- `initializeParser` looked the extension up by id, so the grammar failed to load unless the extension folder was named exactly `blinkerboy.laravelgo`. It now resolves the grammar from `context.extensionUri`.
- A commented-out `protected $table` above the real one was picked up instead of the real one, silently pointing the migration lookup at the wrong table.
- `class` appearing in a comment, docblock or string produced a phantom CodeLens, and `new class extends Model {}` produced one for a class literally named `extends`.
- A `$table` declared inside a nested anonymous class is no longer attributed to the enclosing model.
- A computed `$table` (`self::PREFIX . 'notes'`) now falls back to the class-derived name and says so in the lens tooltip, instead of being ignored without explanation.

- An explicit `protected $table = '...'` on a model is now used instead of the table name derived from the class. Models with a prefixed or singular table (`crm_deal_user`, `support_system_ticket_feedback`) previously found no migration at all.
- Duplicate entries are no longer listed when two patterns match the same file.

## 0.0.1

- Initial release
