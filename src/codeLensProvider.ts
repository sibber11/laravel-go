import * as vscode from 'vscode';
import { hasModelsNamespace, parseModels, ModelMatch } from './modelParser';
import { findRelatedFiles } from './fileLocator';

export class ModelCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onDidChange.event;

    private readonly watcher: vscode.FileSystemWatcher;

    constructor() {
        // Refresh lenses when Laravel files are created or deleted
        this.watcher = vscode.workspace.createFileSystemWatcher(
            '**/{database/migrations,database/factories,database/seeders,app/Http/Resources,app/Http/Controllers,app/Policies,app/Observers,app/Http/Requests}/**/*.php'
        );
        this.watcher.onDidCreate(() => this._onDidChange.fire());
        this.watcher.onDidDelete(() => this._onDidChange.fire());
    }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        if (document.languageId !== 'php') { return []; }
        if (!hasModelsNamespace(document)) { return []; }

        const matches = parseModels(document);
        if (matches.length === 0) { return []; }

        const lenses = await Promise.all(matches.map(match => this.buildLens(match)));
        return lenses;
    }

    private async buildLens(match: ModelMatch): Promise<vscode.CodeLens> {
        const range = new vscode.Range(match.line, 0, match.line, 0);
        try {
            const files = await findRelatedFiles(match.className, match.tableName);
            const count = files.length;
            const title = count === 0
                ? '$(x) No related files found'
                : `$(files) ${count} related file${count === 1 ? '' : 's'}`;

            return new vscode.CodeLens(range, {
                title,
                command: count > 0 ? 'model-related-files.showMenu' : '',
                arguments: [{ className: match.className, tableName: match.tableName }],
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
        this._onDidChange.dispose();
    }
}
