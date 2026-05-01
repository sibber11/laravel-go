import * as vscode from 'vscode';
import * as path from 'path';
import { extractInertiaComponents, getComponentRange } from './inertiaUtil';

export class InertiaDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): Promise<vscode.Location | null> {
        const matches = await extractInertiaComponents(document);

        const hit = matches.find(m => {
            const range = getComponentRange(document, m);
            return range.contains(position);
        });
        if (!hit) { return null; }

        const offsetInString = position.character;
        return this.handleSegment(hit.componentName, offsetInString, document, position);
    }

    private async handleSegment(
        component: string,
        offsetInString: number,
        document: vscode.TextDocument,
        position: vscode.Position,
    ): Promise<vscode.Location | null> {
        const folder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!folder) { return null; }

        const segments = component.split('/');
        if (segments.length < 2) { return null; }

        const segIndex = this.segmentAt(segments, offsetInString);
        const isFile = segIndex === segments.length - 1;

        if (isFile) {
            const uri = this.resolveFileUri(segments, folder.uri.fsPath);
            try {
                await vscode.workspace.fs.stat(uri);
                return new vscode.Location(uri, new vscode.Position(0, 0));
            } catch {
                const rel = vscode.workspace.asRelativePath(uri);
                const action = await vscode.window.showErrorMessage(
                    `Component not found: ${rel}`,
                    'Create File',
                );
                if (action === 'Create File') {
                    await this.createVueFile(uri);
                }
                return new vscode.Location(document.uri, position);
            }
        }

        // Intermediate segment → reveal directory, stay in place
        const dirUri = this.resolveDirUri(segments, segIndex, folder.uri.fsPath);
        vscode.commands.executeCommand('revealInExplorer', dirUri);
        return new vscode.Location(document.uri, position);
    }

    private segmentAt(segments: string[], offset: number): number {
        let pos = 0;
        for (let i = 0; i < segments.length; i++) {
            const end = pos + segments[i].length;
            if (offset >= pos && offset <= end) { return i; }
            pos = end + 1;
        }
        return segments.length - 1;
    }

    // AdminPanel/BlogSetup/BlogList → resources/js/AdminPanel/Pages/BlogSetup/BlogList.vue
    private resolveFileUri(segments: string[], root: string): vscode.Uri {
        const [module, ...rest] = segments;
        return vscode.Uri.file(
            path.join(root, 'resources', 'js', module, 'Pages', ...rest) + '.vue'
        );
    }

    // Segment 0 (AdminPanel)  → resources/js/AdminPanel
    // Segment 1 (BlogSetup)   → resources/js/AdminPanel/Pages/BlogSetup
    private resolveDirUri(segments: string[], segIndex: number, root: string): vscode.Uri {
        const [module, ...rest] = segments;
        if (segIndex === 0) {
            return vscode.Uri.file(path.join(root, 'resources', 'js', module));
        }
        return vscode.Uri.file(
            path.join(root, 'resources', 'js', module, 'Pages', ...rest.slice(0, segIndex))
        );
    }

    private async createVueFile(uri: vscode.Uri): Promise<void> {
        const name = path.basename(uri.fsPath, '.vue');
        const content = [
            '<template>',
            '    <div>',
            `        <!-- ${name} -->`,
            '    </div>',
            '</template>',
            '',
            '<script setup lang="ts">',
            '//',
            '</script>',
            '',
        ].join('\n');

        await vscode.workspace.fs.createDirectory(
            vscode.Uri.file(path.dirname(uri.fsPath))
        );
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));

        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
    }
}
