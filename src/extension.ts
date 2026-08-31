import * as vscode from 'vscode';
import { ModelCodeLensProvider } from './codeLensProvider';
import { ControllerIndexer } from './controllerIndexer';
import { InertiaDefinitionProvider } from './inertiaDefinitionProvider';
import { InertiaDiagnosticProvider } from './inertiaDiagnosticProvider';
import { InertiaDocumentLinkProvider } from './inertiaDocumentLinkProvider';
import { VueLensProvider } from './vueLensProvider';
import { findRelatedFiles } from './fileLocator';
import { analyzeDocument, forgetDocument } from './modelParser';
import { configureParser } from './phpParserUtil';
import { ModuleInfo, getModuleByName, resolveModuleFor, watchModules } from './moduleResolver';

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel('LaravelGo');

    // Resolves the bundled grammar without depending on the extension's folder name.
    configureParser(context.extensionUri);

    const modelLensProvider = new ModelCodeLensProvider();
    const controllerIndexer = new ControllerIndexer();
    const vueLensProvider = new VueLensProvider(controllerIndexer);
    const inertiaDefProvider = new InertiaDefinitionProvider();
    const inertiaDocumentLinkProvider = new InertiaDocumentLinkProvider();
    const inertiaDiagnostics = new InertiaDiagnosticProvider();
    const moduleWatcher = watchModules();

    const showMenuCommand = vscode.commands.registerCommand(
        'model-related-files.showMenu',
        async (args?: { className: string; tableName: string; moduleName?: string }) => {
            try {
                let module: ModuleInfo | undefined;

                if (args) {
                    module = args.moduleName ? await getModuleByName(args.moduleName) : undefined;
                } else {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) { return; }
                    const { namespace, models } = await analyzeDocument(editor.document);
                    if (!namespace) {
                        vscode.window.showInformationMessage(
                            'File is not in an App\\Models or Modules\\*\\Models namespace.'
                        );
                        return;
                    }
                    const cursor = editor.selection.active;
                    const match = models.find(m => m.line === cursor.line);
                    if (!match) {
                        vscode.window.showInformationMessage('No Laravel model found on this line.');
                        return;
                    }
                    module = await resolveModuleFor(editor.document.uri);
                    args = { className: match.className, tableName: match.tableName };
                }

                const files = await findRelatedFiles(args.className, args.tableName, module);

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
        moduleWatcher,
        showMenuCommand,
        vscode.workspace.onDidCloseTextDocument(doc => forgetDocument(doc.uri)),
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
        vscode.languages.registerDocumentLinkProvider(
            { language: 'php', scheme: 'file' },
            inertiaDocumentLinkProvider
        ),
    );
}

export function deactivate() {}
