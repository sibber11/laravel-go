import * as vscode from 'vscode';
import * as path from 'path';
import { initializeParser, extractComponentsFromPhp, PhpComponentMatch } from './phpParserUtil';

let parserInstance: Awaited<ReturnType<typeof initializeParser>> | null = null;

export async function getParser() {
    if (!parserInstance) {
        parserInstance = await initializeParser();
    }
    return parserInstance;
}

export function getComponentRange(document: vscode.TextDocument, match: PhpComponentMatch): vscode.Range {
    const lineContent = document.lineAt(match.line).text;
    const startCol = lineContent.indexOf(match.componentName);
    const endCol = startCol + match.componentName.length;
    return new vscode.Range(match.line, startCol, match.line, endCol);
}

export function resolveComponentFileUri(
    componentName: string,
    folderPath: string,
): vscode.Uri {
    const parts = componentName.split('/');
    const [module, ...rest] = parts;
    return vscode.Uri.file(
        path.join(folderPath, 'resources', 'js', module, 'Pages', ...rest) + '.vue'
    );
}

export async function extractInertiaComponents(document: vscode.TextDocument) {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) { return []; }

    try {
        const { parser, language } = await getParser();
        const matches = await extractComponentsFromPhp(document.getText(), parser, language);
        return matches.filter(m => {
            const parts = m.componentName.split('/');
            return parts.length >= 2;
        });
    } catch {
        return [];
    }
}
