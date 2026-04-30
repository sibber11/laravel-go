import * as vscode from 'vscode';
import { ModelCodeLensProvider } from './codeLensProvider';
import { ControllerIndexer } from './controllerIndexer';
import { InertiaDefinitionProvider } from './inertiaDefinitionProvider';
import { InertiaDiagnosticProvider } from './inertiaDiagnosticProvider';
import { VueLensProvider } from './vueLensProvider';
import { findRelatedFiles } from './fileLocator';
import { hasModelsNamespace, parseModels } from './modelParser';

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel('LaravelGo');

    const modelLensProvider = new ModelCodeLensProvider();
    const controllerIndexer = new ControllerIndexer();
    const vueLensProvider = new VueLensProvider(controllerIndexer);
    const inertiaDefProvider = new InertiaDefinitionProvider();
    const inertiaDiagnostics = new InertiaDiagnosticProvider();

    const showMenuCommand = vscode.commands.registerCommand(
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
        modelLensProvider,
        controllerIndexer,
        vueLensProvider,
        inertiaDiagnostics,
        showMenuCommand,
        vscode.languages.registerCodeLensProvider(
            { language: 'php', scheme: 'file' },
            modelLensProvider
        ),
        vscode.languages.registerCodeLensProvider(
            { language: 'vue', scheme: 'file' },
            vueLensProvider
        ),
        vscode.languages.registerDefinitionProvider(
            { language: 'php', scheme: 'file' },
            inertiaDefProvider
        ),
    );
}

export function deactivate() {}
