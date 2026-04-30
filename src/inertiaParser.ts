import * as vscode from 'vscode';

export interface InertiaComponent {
    component: string;
    range: vscode.Range; // range of the string content, without quotes
}

const SAME_LINE_RE = /(?:\binertia\s*\(|Inertia::render\s*\()\s*['"]([^'"]+)['"]/g;
const BARE_STRING_RE = /^\s*['"]([^'"]+)['"]\s*,?\s*$/;
const RENDER_OPEN_RE = /(?:\binertia\s*\(|Inertia::render\s*\()/;

export function parseInertiaComponents(document: vscode.TextDocument): InertiaComponent[] {
    const results: InertiaComponent[] = [];
    let pendingRenderLine = -1;

    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;

        if (pendingRenderLine >= 0) {
            const bareMatch = BARE_STRING_RE.exec(lineText);
            if (bareMatch) {
                const component = bareMatch[1];
                const start = lineText.indexOf(component);
                results.push({
                    component,
                    range: new vscode.Range(i, start, i, start + component.length),
                });
            }
            pendingRenderLine = -1;
            continue;
        }

        SAME_LINE_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        let foundSameLine = false;
        while ((match = SAME_LINE_RE.exec(lineText)) !== null) {
            const component = match[1];
            const start = match.index + match[0].indexOf(component);
            results.push({
                component,
                range: new vscode.Range(i, start, i, start + component.length),
            });
            foundSameLine = true;
        }

        if (!foundSameLine && RENDER_OPEN_RE.test(lineText)) {
            pendingRenderLine = i;
        }
    }

    return results;
}
