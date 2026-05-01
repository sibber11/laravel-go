import * as vscode from 'vscode';
import { Parser, Language, Query } from "web-tree-sitter";

export async function initializeParser(): Promise<{ parser: Parser, language: Language }> {
    await Parser.init();
    const parser = new Parser();
    // load the language from the extension's bundled WASM file
    const path = vscode.extensions.getExtension('blinkerboy.laravelgo')?.extensionPath;
    const uri = vscode.Uri.joinPath(vscode.Uri.file(path!), 'tree-sitter-php_only.wasm');
    const language = await Language.load(uri.fsPath);
    parser.setLanguage(language);
    return { parser, language };
}

export interface PhpComponentMatch {
    componentName: string;
    line: number;
    className?: string;
    methodName?: string;
}

export async function extractComponentsFromPhp(
    content: string,
    parser: Parser,
    language: Language,
): Promise<PhpComponentMatch[]> {
    const tree = parser.parse(content);
    const query = new Query(language, `
        (class_declaration
            name: (name) @class.name
            body: (declaration_list
                (method_declaration (name) @method.name
                    body: (compound_statement
                        (return_statement
                            (scoped_call_expression
                            scope: (name) @scope.name (#eq? @scope.name "Inertia")
                            name: (name) @scope.method (#eq? @scope.method "render")
                            arguments: (arguments (argument (string (string_content) @component.name)) )
                        )
                        )
                    )
                )
            )
        )`);

    const matches = query.matches(tree!.rootNode);
    const results: PhpComponentMatch[] = [];

    matches.forEach((match) => {
        const className = match.captures.find(c => c.name === 'class.name')?.node.text;
        const methodName = match.captures.find(c => c.name === 'method.name')?.node.text;
        const componentName = match.captures.find(c => c.name === 'component.name')?.node.text;
        const line = match.captures.find(c => c.name === 'component.name')?.node.startPosition.row;

        if (componentName !== undefined && line !== undefined) {
            results.push({
                componentName,
                line,
                className,
                methodName,
            });
        }
    });

    return results;
}
