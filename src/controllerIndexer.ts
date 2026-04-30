import * as vscode from 'vscode';

export interface ControllerRef {
    uri: vscode.Uri;
    line: number;
    className: string;
    methodName: string;
}

export class ControllerIndexer implements vscode.Disposable {
    private readonly index = new Map<string, ControllerRef[]>();
    private readonly _onDidUpdate = new vscode.EventEmitter<void>();
    readonly onDidUpdate = this._onDidUpdate.event;

    private readonly watcher: vscode.FileSystemWatcher;
    private indexPromise: Promise<void> | null = null;

    constructor() {
        this.watcher = vscode.workspace.createFileSystemWatcher('**/app/**/*.php');
        this.watcher.onDidChange(uri => this.reindexFile(uri));
        this.watcher.onDidCreate(uri => this.reindexFile(uri));
        this.watcher.onDidDelete(uri => {
            this.removeFile(uri);
            this._onDidUpdate.fire();
        });
    }

    ensureIndexed(): Promise<void> {
        if (!this.indexPromise) {
            this.indexPromise = this.buildFullIndex();
        }
        return this.indexPromise;
    }

    private async buildFullIndex(): Promise<void> {
        const uris = await vscode.workspace.findFiles('**/app/**/*.php', null);
        await Promise.all(uris.map(uri => this.indexFile(uri)));
        this._onDidUpdate.fire();
    }

    private async reindexFile(uri: vscode.Uri): Promise<void> {
        this.removeFile(uri);
        await this.indexFile(uri);
        this._onDidUpdate.fire();
    }

    private removeFile(uri: vscode.Uri): void {
        const fileKey = uri.toString();
        for (const [component, refs] of this.index) {
            const filtered = refs.filter(r => r.uri.toString() !== fileKey);
            if (filtered.length === 0) {
                this.index.delete(component);
            } else {
                this.index.set(component, filtered);
            }
        }
    }

    private async indexFile(uri: vscode.Uri): Promise<void> {
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            const lines = Buffer.from(bytes).toString('utf8').split('\n');

            let currentClass = '';
            let currentMethod = '';
            let pendingRenderLine = -1; // line where Inertia::render( had no inline string

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                const classMatch = line.match(/class\s+(\w+)/);
                if (classMatch) { currentClass = classMatch[1]; }

                const methodMatch = line.match(/(?:public|protected|private)\s+function\s+(\w+)/);
                if (methodMatch) { currentMethod = methodMatch[1]; }

                // Resolve pending multiline render — next bare string line is the component
                if (pendingRenderLine >= 0) {
                    const bareMatch = line.match(/^\s*['"]([^'"]+)['"]/);
                    if (bareMatch && currentClass && currentMethod) {
                        this.recordComponent(bareMatch[1], uri, pendingRenderLine, currentClass, currentMethod);
                    }
                    pendingRenderLine = -1;
                    continue;
                }

                // Same-line: inertia('X') or Inertia::render('X')
                const sameLineMatch = line.match(/(?:\binertia\s*\(|Inertia::render\s*\()\s*['"]([^'"]+)['"]/);
                if (sameLineMatch) {
                    if (currentClass && currentMethod) {
                        this.recordComponent(sameLineMatch[1], uri, i, currentClass, currentMethod);
                    }
                    continue;
                }

                // render( with no string yet — string is on next line
                if (/(?:\binertia\s*\(|Inertia::render\s*\()/.test(line)) {
                    pendingRenderLine = i;
                }
            }
        } catch {
            // skip unreadable files
        }
    }

    private recordComponent(
        component: string,
        uri: vscode.Uri,
        line: number,
        className: string,
        methodName: string,
    ): void {
        const refs = this.index.get(component) ?? [];
        refs.push({ uri, line, className, methodName });
        this.index.set(component, refs);
    }

    lookup(componentPath: string): ControllerRef[] {
        return this.index.get(componentPath) ?? [];
    }

    dispose(): void {
        this.watcher.dispose();
        this._onDidUpdate.dispose();
    }
}
