import * as vscode from 'vscode';
import { ModuleInfo } from './moduleResolver';

export interface RelatedFile extends vscode.QuickPickItem {
    uri: vscode.Uri;
}

interface FilePattern {
    label: string;
    description: string;
    /** Whether `glob` is relative to the PHP source folder or to the project/module root. */
    base: 'app' | 'root';
    glob: string;
}

function buildPatterns(className: string, tableName: string): FilePattern[] {
    return [
        {
            label: '$(database) Migration',
            description: 'Database Migration',
            base: 'root',
            glob: `database/migrations/**/*${tableName}*.php`,
        },
        {
            label: '$(beaker) Factory',
            description: 'Model Factory',
            base: 'root',
            glob: `database/factories/${className}Factory.php`,
        },
        {
            label: '$(play) Seeder',
            description: 'Database Seeder',
            base: 'root',
            glob: `database/seeders/${className}Seeder.php`,
        },
        {
            label: '$(package) Resource',
            description: 'API Resource',
            base: 'app',
            glob: `Http/Resources/**/*${className}Resource.php`,
        },
        {
            label: '$(shield) Policy',
            description: 'Authorization Policy',
            base: 'app',
            glob: `Policies/${className}Policy.php`,
        },
        {
            label: '$(server) Controller',
            description: 'HTTP Controller',
            base: 'app',
            glob: `Http/Controllers/**/*${className}Controller.php`,
        },
        {
            label: '$(eye) Observer',
            description: 'Model Observer',
            base: 'app',
            glob: `Observers/${className}Observer.php`,
        },
        {
            label: '$(pencil) Request',
            description: 'Form Request',
            base: 'app',
            glob: `Http/Requests/**/${className}/*Request.php`,
        },
        {
            label: '$(zap) Livewire',
            description: 'Livewire Component',
            base: 'app',
            glob: `Livewire/**/${className}/*.php`,
        },
        {
            label: '$(gear) Service',
            description: 'Service Class',
            base: 'app',
            glob: `Services/${className}/*.php`,
        },
        {
            label: '$(gear) Service',
            description: 'Service Class',
            base: 'app',
            glob: `Services/**/${className}Service.php`,
        },
        {
            label: '$(symbol-enum) Enum',
            description: 'Enum',
            base: 'app',
            glob: `Enums/${className}/*.php`,
        },
        {
            label: '$(export) Export',
            description: 'Export',
            base: 'app',
            glob: `Exports/${className}/*.php`,
        },
        {
            label: '$(export) Export',
            description: 'Export',
            base: 'app',
            glob: `Exports/**/${className}Export.php`,
        },
        {
            label: '$(cloud-download) Import',
            description: 'Import',
            base: 'app',
            glob: `Imports/**/${className}Import.php`,
        },
        {
            label: '$(watch) Job',
            description: 'Queued Job',
            base: 'app',
            glob: `Jobs/**/*${className}*Job.php`,
        },
    ];
}

// Without a module the globs stay anchored at the workspace root, exactly as before.
function rootGlob(pattern: FilePattern): string {
    return pattern.base === 'app' ? `app/${pattern.glob}` : pattern.glob;
}

// With a module the search is confined to that module's directory.
function moduleGlob(pattern: FilePattern, module: ModuleInfo): vscode.RelativePattern {
    const base = pattern.base === 'app' ? module.app : module.root;
    return new vscode.RelativePattern(base, pattern.glob);
}

export async function findRelatedFiles(
    className: string,
    tableName: string,
    module?: ModuleInfo
): Promise<RelatedFile[]> {
    const results: RelatedFile[] = [];
    const seen = new Set<string>();
    const patterns = buildPatterns(className, tableName);

    for (const pattern of patterns) {
        try {
            const glob = module ? moduleGlob(pattern, module) : rootGlob(pattern);
            const uris = await vscode.workspace.findFiles(glob, null, 10);
            for (const uri of uris) {
                const key = uri.toString();
                if (seen.has(key)) { continue; }
                seen.add(key);

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
