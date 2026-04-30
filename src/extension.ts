import * as vscode from 'vscode';
import { ModelCodeLensProvider } from './codeLensProvider';
import { findRelatedFiles } from './fileLocator';
import { hasModelsNamespace, parseModels } from './modelParser';

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel('LaravelGo');
    const codeLensProvider = new ModelCodeLensProvider();

    const command = vscode.commands.registerCommand(
        'model-related-files.showMenu',
        async (args?: { className: string; tableName: string }) => {
            try {
                if (!args) {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) { return; }
                    if (!hasModelsNamespace(editor.document)) {
                        vscode.window.showInformationMessage('File is not in the App\\Models namespace.');
                        return;
                    }
                    const matches = parseModels(editor.document);
                    const cursor = editor.selection.active;
                    const match = matches.find(m => m.line === cursor.line);
                    if (!match) {
                        vscode.window.showInformationMessage('No Laravel model found on this line.');
                        return;
                    }
                    args = { className: match.className, tableName: match.tableName };
                }

                const files = await findRelatedFiles(args.className, args.tableName);

                if (files.length === 0) {
                    vscode.window.showInformationMessage(
                        `No related files found for model "${args.className}".`
                    );
                    return;
                }

                const selected = await vscode.window.showQuickPick(files, {
                    title: `Related Files: ${args.className}`,
                    placeHolder: 'Select a file to open',
                    matchOnDescription: true,
                    matchOnDetail: true,
                });

                if (!selected) { return; }

                const config = vscode.workspace.getConfiguration('modelRelatedFiles');
                const openInSplit = config.get<boolean>('openInSplit', true);

                const doc = await vscode.workspace.openTextDocument(selected.uri);
                await vscode.window.showTextDocument(doc, {
                    viewColumn: openInSplit ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                output.appendLine(`[error] ${msg}`);
                vscode.window.showErrorMessage(`LaravelGo: ${msg}`);
            }
        }
    );

    context.subscriptions.push(
        output,
        codeLensProvider,
        command,
        vscode.languages.registerCodeLensProvider(
            { language: 'php', scheme: 'file' },
            codeLensProvider
        ),
    );
}

export function deactivate() {}
