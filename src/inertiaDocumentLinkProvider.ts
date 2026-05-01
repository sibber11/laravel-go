import * as vscode from 'vscode';
import { extractInertiaComponents, resolveComponentFileUri, getComponentRange } from './inertiaUtil';

export class InertiaDocumentLinkProvider implements vscode.DocumentLinkProvider {
    async provideDocumentLinks(document: vscode.TextDocument): Promise<vscode.DocumentLink[]> {
        if (document.languageId !== 'php') { return []; }

        const folder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!folder) { return []; }

        const matches = await extractInertiaComponents(document);
        const links: vscode.DocumentLink[] = [];

        for (const match of matches) {
            const fileUri = resolveComponentFileUri(match.componentName, folder.uri.fsPath);
            const range = getComponentRange(document, match);
            const link = new vscode.DocumentLink(range, fileUri);
            links.push(link);
        }

        return links;
    }
}
