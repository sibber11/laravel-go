import * as vscode from 'vscode';
import * as path from 'path';
import { parseInertiaComponents } from './inertiaParser';

export class InertiaDiagnosticProvider implements vscode.Disposable {
    private readonly collection = vscode.languages.createDiagnosticCollection('laravelgo-inertia');
    private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly subs: vscode.Disposable[];

    constructor() {
        // Re-validate open PHP docs when Vue files are created/deleted
        const vueWatcher = vscode.workspace.createFileSystemWatcher('**/resources/js/**/*.vue');
        vueWatcher.onDidCreate(() => this.revalidateAll());
        vueWatcher.onDidDelete(() => this.revalidateAll());

        this.subs = [
            vueWatcher,
            vscode.workspace.onDidOpenTextDocument(doc => this.schedule(doc)),
            vscode.workspace.onDidChangeTextDocument(e => this.schedule(e.document)),
            vscode.workspace.onDidCloseTextDocument(doc => {
                this.collection.delete(doc.uri);
                this.clearTimer(doc.uri.toString());
            }),
        ];

        vscode.workspace.textDocuments.forEach(doc => this.schedule(doc));
    }

    private schedule(document: vscode.TextDocument): void {
        if (document.languageId !== 'php') { return; }
        const key = document.uri.toString();
        this.clearTimer(key);
        this.timers.set(key, setTimeout(() => this.update(document), 500));
    }

    private clearTimer(key: string): void {
        const t = this.timers.get(key);
        if (t) { clearTimeout(t); this.timers.delete(key); }
    }

    private revalidateAll(): void {
        vscode.workspace.textDocuments
            .filter(d => d.languageId === 'php')
            .forEach(d => this.schedule(d));
    }

    private async update(document: vscode.TextDocument): Promise<void> {
        const folder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!folder) { return; }

        const components = parseInertiaComponents(document);
        const diagnostics: vscode.Diagnostic[] = [];

        for (const { component, range } of components) {
            const parts = component.split('/');
            if (parts.length < 2) { continue; }

            const [module, ...rest] = parts;
            const fileUri = vscode.Uri.file(
                path.join(folder.uri.fsPath, 'resources', 'js', module, 'Pages', ...rest) + '.vue'
            );

            try {
                await vscode.workspace.fs.stat(fileUri);
            } catch {
                const rel = vscode.workspace.asRelativePath(fileUri);
                const diag = new vscode.Diagnostic(
                    range,
                    `Inertia component not found: ${rel}`,
                    vscode.DiagnosticSeverity.Error,
                );
                diag.source = 'LaravelGo';
                diagnostics.push(diag);
            }
        }

        this.collection.set(document.uri, diagnostics);
    }

    dispose(): void {
        this.collection.dispose();
        this.timers.forEach(t => clearTimeout(t));
        this.subs.forEach(s => s.dispose());
    }
}
