import * as vscode from 'vscode';

export interface ModelMatch {
    className: string;
    tableName: string;
    line: number;
    range: vscode.Range;
}

function toSnakeCase(name: string): string {
    return name.replace(/([A-Z])/g, (_, char, offset) =>
        offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase()
    );
}

function pluralize(word: string): string {
    if (/[^aeiou]y$/.test(word)) {
        return word.slice(0, -1) + 'ies';
    }
    if (/(?:s|x|z|ch|sh)$/.test(word)) {
        return word + 'es';
    }
    return word + 's';
}

export function classToTableName(className: string): string {
    return pluralize(toSnakeCase(className));
}

export function hasModelsNamespace(document: vscode.TextDocument): boolean {
    // Only scan first 20 lines — namespace always at top
    const limit = Math.min(20, document.lineCount);
    for (let i = 0; i < limit; i++) {
        if (/namespace\s+App\\Models\b/.test(document.lineAt(i).text)) {
            return true;
        }
    }
    return false;
}

export function parseModels(document: vscode.TextDocument): ModelMatch[] {
    const matches: ModelMatch[] = [];
    const lineCount = document.lineCount;

    for (let i = 0; i < lineCount; i++) {
        const line = document.lineAt(i);
        if (line.text.length > 500) { continue; }

        const regex = /class\s+(\w+)/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(line.text)) !== null) {
            const className = match[1];
            const tableName = classToTableName(className);
            matches.push({
                className,
                tableName,
                line: i,
                range: new vscode.Range(
                    new vscode.Position(i, match.index),
                    new vscode.Position(i, match.index + match[0].length)
                ),
            });
        }
    }

    return matches;
}
