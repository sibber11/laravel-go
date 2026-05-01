import { log } from 'console';
import * as vscode from 'vscode';

import { Parser, Language, Query } from "web-tree-sitter";

export async function initializeParser(): Promise<{ parser: Parser, language: Language }> {
    await Parser.init();
    const parser = new Parser();
    // load the language from the extension's bundled WASM file
    const path = vscode.extensions.getExtension('blinkerboy.laravelgo')?.extensionPath;
    const uri = vscode.Uri.joinPath(vscode.Uri.file(path!), 'tree-sitter-php_only.wasm');
    const language = await Language.load(uri.fsPath);
    parser.setLanguage(language);
    return { parser, language };
}

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
    private parser!: Parser;
    private language!: Language;

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
        const { parser, language } = await initializeParser();
        this.parser = parser;
        this.language = language;
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
            const tree = this.parser.parse(content);
            const query = new Query(this.language, `
                (class_declaration
                    name: (name) @class.name
                    body: (declaration_list
                        (method_declaration (name) @method.name
                            body: (compound_statement
                                (return_statement
                                    (scoped_call_expression
                                    scope: (name) @scope.name (#eq? @scope.name "Inertia")
                                    name: (name) @scope.method (#eq? @scope.method "render")
                                    arguments: (arguments (argument (string (string_content) @component.name)) )
                                )
                                )
                            )
                        )
                    ) 
                )`);
            const matches = query.matches(tree!.rootNode);
            matches.forEach((match) => {
                const className = match.captures.find(c => c.name === 'class.name')?.node.text;
                const methodName = match.captures.find(c => c.name === 'method.name')?.node.text;
                const componentName = match.captures.find(c => c.name === 'component.name')?.node.text;

                if (className && methodName && componentName) {
                    const line = match.captures.find(c => c.name === 'component.name')!.node.startPosition.row;
                    this.recordComponent(componentName, uri, line, className, methodName);
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
