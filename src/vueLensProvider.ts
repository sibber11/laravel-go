import * as vscode from 'vscode';
import { ControllerIndexer } from './controllerIndexer';

export class VueLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onDidChange.event;
    private readonly indexerSub: vscode.Disposable;

    constructor(private readonly indexer: ControllerIndexer) {
        this.indexerSub = indexer.onDidUpdate(() => this._onDidChange.fire());
    }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const componentPath = this.extractComponentPath(document.uri);
        if (!componentPath) { return []; }

        await this.indexer.ensureIndexed();

        const refs = this.indexer.lookup(componentPath);
        if (refs.length === 0) { return []; }

        const range = new vscode.Range(0, 0, 0, 0);
        return refs.map(ref => new vscode.CodeLens(range, {
            title: `$(server) ${ref.className}@${ref.methodName}`,
            command: 'vscode.open',
            arguments: [
                ref.uri,
                { selection: new vscode.Range(ref.line, 0, ref.line, 0) },
            ],
        }));
    }

    // resources/js/AdminPanel/Pages/Dashboard.vue      → AdminPanel/Dashboard
    // resources/js/VendorPanel/Pages/Products/Index.vue → VendorPanel/Products/Index
    private extractComponentPath(uri: vscode.Uri): string | null {
        const rel = vscode.workspace.asRelativePath(uri);
        const match = rel.match(/^resources\/js\/(\w+)\/Pages\/(.+)\.vue$/);
        if (!match) { return null; }
        return `${match[1]}/${match[2]}`;
    }

    dispose(): void {
        this.indexerSub.dispose();
        this._onDidChange.dispose();
    }
}
