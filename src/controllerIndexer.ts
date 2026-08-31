import * as vscode from 'vscode';

import { extractComponentsFromPhp, getParser } from './phpParserUtil';

export interface ComponentSource {
    uri: vscode.Uri;
    line: number;
}

export interface ControllerRef extends ComponentSource {
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
        this.watcher = vscode.workspace.createFileSystemWatcher('**/app/Http/Controllers/**/*.php');
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
        const uris = await vscode.workspace.findFiles('**/app/Http/Controllers/**/*.php', null);
        await getParser();
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
            const content = new TextDecoder('utf-8').decode(bytes);
            const matches = await extractComponentsFromPhp(content);
            matches.forEach((match) => {
                if (match.className && match.methodName) {
                    this.recordComponent(match.componentName, uri, match.line, match.className, match.methodName);
                }
            });
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
