import * as vscode from 'vscode';

export interface RelatedFile extends vscode.QuickPickItem {
    uri: vscode.Uri;
}

interface FilePattern {
    label: string;
    description: string;
    glob: string;
}

function buildPatterns(className: string, tableName: string): FilePattern[] {
    return [
        {
            label: '$(database) Migration',
            description: 'Database Migration',
            glob: `database/migrations/**/*${tableName}*.php`,
        },
        {
            label: '$(beaker) Factory',
            description: 'Model Factory',
            glob: `database/factories/${className}Factory.php`,
        },
        {
            label: '$(play) Seeder',
            description: 'Database Seeder',
            glob: `database/seeders/${className}Seeder.php`,
        },
        {
            label: '$(package) Resource',
            description: 'API Resource',
            glob: `app/Http/Resources/**/*${className}Resource.php`,
        },
        {
            label: '$(shield) Policy',
            description: 'Authorization Policy',
            glob: `app/Policies/${className}Policy.php`,
        },
        {
            label: '$(server) Controller',
            description: 'HTTP Controller',
            glob: `app/Http/Controllers/**/*${className}Controller.php`,
        },
        {
            label: '$(eye) Observer',
            description: 'Model Observer',
            glob: `app/Observers/${className}Observer.php`,
        },
        {
            label: '$(pencil) Request',
            description: 'Form Request',
            glob: `app/Http/Requests/**/${className}/*Request.php`,
        },
    ];
}

export async function findRelatedFiles(
    className: string,
    tableName: string
): Promise<RelatedFile[]> {
    const results: RelatedFile[] = [];
    const patterns = buildPatterns(className, tableName);

    for (const pattern of patterns) {
        try {
            const uris = await vscode.workspace.findFiles(pattern.glob, null, 10);
            for (const uri of uris) {
                results.push({
                    label: pattern.label,
                    description: vscode.workspace.asRelativePath(uri),
                    detail: pattern.description,
                    uri,
                });
            }
        } catch {
            // skip unresolvable patterns
        }
    }

    return results;
}
