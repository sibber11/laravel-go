import * as vscode from 'vscode';

export interface ModuleInfo {
    /** Studly module name taken from the directory, e.g. "HRM". */
    name: string;
    /** Lower-case alias declared in module.json, falls back to the lower-cased name. */
    alias: string;
    /** Module root, e.g. <workspace>/Modules/HRM. */
    root: vscode.Uri;
    /** PHP source root — <root>/app on modern layouts, <root> on legacy ones. */
    app: vscode.Uri;
}

const _onDidChangeModules = new vscode.EventEmitter<void>();
export const onDidChangeModules = _onDidChangeModules.event;

let cache: Promise<ModuleInfo[]> | null = null;

function config<T>(key: string, fallback: T): T {
    return vscode.workspace.getConfiguration('modelRelatedFiles').get<T>(key, fallback);
}

function modulesPath(): string {
    return config('modules.path', 'Modules')
        .replace(/^\.\//, '')
        .replace(/^\/+|\/+$/g, '');
}

async function discover(): Promise<ModuleInfo[]> {
    if (!config('modules.enabled', true)) { return []; }

    const base = modulesPath();
    if (!base) { return []; }

    const manifests = await vscode.workspace.findFiles(`${base}/*/module.json`);
    const modules = await Promise.all(manifests.map(readManifest));
    return modules.filter((m): m is ModuleInfo => m !== null);
}

async function readManifest(manifest: vscode.Uri): Promise<ModuleInfo | null> {
    const root = vscode.Uri.joinPath(manifest, '..');
    const name = root.path.split('/').pop();
    if (!name) { return null; }

    let alias = name.toLowerCase();
    try {
        const bytes = await vscode.workspace.fs.readFile(manifest);
        const parsed = JSON.parse(new TextDecoder('utf-8').decode(bytes));
        if (typeof parsed?.alias === 'string' && parsed.alias) {
            alias = parsed.alias;
        }
    } catch {
        // Malformed or unreadable module.json — the directory is still a module.
    }

    return { name, alias, root, app: await resolveAppFolder(root) };
}

// Modern nwidart layouts keep PHP under <module>/app; legacy ones put
// Http/, Models/ etc. directly in the module root.
async function resolveAppFolder(root: vscode.Uri): Promise<vscode.Uri> {
    const app = vscode.Uri.joinPath(root, 'app');
    try {
        const stat = await vscode.workspace.fs.stat(app);
        if (stat.type & vscode.FileType.Directory) { return app; }
    } catch {
        // No app folder — legacy layout.
    }
    return root;
}

export function getModules(): Promise<ModuleInfo[]> {
    if (!cache) { cache = discover(); }
    return cache;
}

export async function getModuleByName(name: string): Promise<ModuleInfo | undefined> {
    return (await getModules()).find(m => m.name === name);
}

export async function resolveModuleFor(uri: vscode.Uri): Promise<ModuleInfo | undefined> {
    const target = uri.path;
    // Longest root wins so a nested module resolves to the inner one.
    return (await getModules())
        .filter(m => target.startsWith(m.root.path + '/'))
        .sort((a, b) => b.root.path.length - a.root.path.length)[0];
}

export function invalidateModuleCache(): void {
    cache = null;
    _onDidChangeModules.fire();
}

/** Keeps the module cache in sync with manifest and settings changes. */
export function watchModules(): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher('**/module.json');
    watcher.onDidCreate(() => invalidateModuleCache());
    watcher.onDidChange(() => invalidateModuleCache());
    watcher.onDidDelete(() => invalidateModuleCache());

    const configSub = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('modelRelatedFiles.modules')) {
            invalidateModuleCache();
        }
    });

    const foldersSub = vscode.workspace.onDidChangeWorkspaceFolders(() => invalidateModuleCache());

    return vscode.Disposable.from(watcher, configSub, foldersSub, _onDidChangeModules);
}
