import * as vscode from 'vscode';
import { analyzeDocument, ModelMatch } from './modelParser';
import { findRelatedFiles } from './fileLocator';
import { ModuleInfo, onDidChangeModules, resolveModuleFor } from './moduleResolver';

export class ModelCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onDidChange.event;

    private readonly watcher: vscode.FileSystemWatcher;
    private readonly modulesSub: vscode.Disposable;

    constructor() {
        // Refresh lenses when Laravel files are created or deleted
        this.watcher = vscode.workspace.createFileSystemWatcher(
            '**/{database/migrations,database/factories,database/seeders,app/Http/Resources,app/Http/Controllers,app/Policies,app/Observers,app/Http/Requests,app/Livewire,app/Services,app/Enums,app/Exports,app/Imports,app/Jobs}/**/*.php'
        );
        this.watcher.onDidCreate(() => this._onDidChange.fire());
        this.watcher.onDidDelete(() => this._onDidChange.fire());
        this.modulesSub = onDidChangeModules(() => this._onDidChange.fire());
    }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        if (document.languageId !== 'php') { return []; }

        const { namespace, models } = await analyzeDocument(document);
        if (!namespace || models.length === 0) { return []; }

        // Models inside a module only ever look at that module's files.
        const module = await resolveModuleFor(document.uri);

        const lenses = await Promise.all(models.map(match => this.buildLens(match, module)));
        return lenses;
    }

    private async buildLens(match: ModelMatch, module?: ModuleInfo): Promise<vscode.CodeLens> {
        const range = new vscode.Range(match.line, 0, match.line, 0);
        try {
            const files = await findRelatedFiles(match.className, match.tableName, module);
            const count = files.length;
            const title = count === 0
                ? '$(x) No related files found'
                : `$(files) ${count} related file${count === 1 ? '' : 's'}`;

            return new vscode.CodeLens(range, {
                title,
                tooltip: match.tableSource === 'dynamic'
                    ? `$table on ${match.className} is computed at runtime — searching for "${match.tableName}" derived from the class name instead.`
                    : undefined,
                command: count > 0 ? 'model-related-files.showMenu' : '',
                arguments: [{
                    className: match.className,
                    tableName: match.tableName,
                    moduleName: module?.name,
                }],
            });
        } catch {
            return new vscode.CodeLens(range, {
                title: '$(warning) Related files unavailable',
                command: '',
            });
        }
    }

    refresh(): void {
        this._onDidChange.fire();
    }

    dispose(): void {
        this.watcher.dispose();
        this.modulesSub.dispose();
        this._onDidChange.dispose();
    }
}
