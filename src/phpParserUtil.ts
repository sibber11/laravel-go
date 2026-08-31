import * as vscode from 'vscode';
import { Parser, Language, Query, Node } from "web-tree-sitter";

export interface PhpParser {
    parser: Parser;
    language: Language;
}

let extensionRoot: vscode.Uri | null = null;
let parserPromise: Promise<PhpParser> | null = null;
const queryCache = new Map<string, Query>();

/**
 * Records where the bundled grammar lives. Must run once from activate() before
 * anything parses PHP. Taking the URI from the extension context avoids looking
 * the extension up by id, which fails whenever the folder is not named exactly
 * `blinkerboy.laravelgo`.
 */
export function configureParser(extensionUri: vscode.Uri): void {
    extensionRoot = extensionUri;
}

/** Shared parser — one grammar load for the whole extension. */
export function getParser(): Promise<PhpParser> {
    if (!parserPromise) { parserPromise = createParser(); }
    return parserPromise;
}

async function createParser(): Promise<PhpParser> {
    if (!extensionRoot) {
        throw new Error('PHP parser used before configureParser() ran.');
    }

    await Parser.init();
    const parser = new Parser();
    const wasm = vscode.Uri.joinPath(extensionRoot, 'tree-sitter-php_only.wasm');
    const language = await Language.load(wasm.fsPath);
    parser.setLanguage(language);
    return { parser, language };
}

/** Queries are immutable and costly to compile — keep one per source string. */
export function getQuery(language: Language, source: string): Query {
    let query = queryCache.get(source);
    if (!query) {
        query = new Query(language, source);
        queryCache.set(source, query);
    }
    return query;
}

// Nodes that own their own member declarations. Walking up to the first of
// these attributes a property to the class it really belongs to — without it,
// a `$table` inside `new class extends Model {}` is credited to the outer model.
const CLASS_LIKE = new Set([
    'class_declaration',
    'anonymous_class',
    'interface_declaration',
    'trait_declaration',
    'enum_declaration',
]);

export function enclosingClass(node: Node | null): Node | null {
    for (let current = node; current; current = current.parent) {
        if (CLASS_LIKE.has(current.type)) { return current; }
    }
    return null;
}

export interface PhpComponentMatch {
    componentName: string;
    line: number;
    className?: string;
    methodName?: string;
}

const INERTIA_QUERY = `
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
        )`;

export async function extractComponentsFromPhp(content: string): Promise<PhpComponentMatch[]> {
    const { parser, language } = await getParser();
    const tree = parser.parse(content);
    if (!tree) { return []; }

    try {
        const matches = getQuery(language, INERTIA_QUERY).matches(tree.rootNode);
        const results: PhpComponentMatch[] = [];

        matches.forEach((match) => {
            const className = match.captures.find(c => c.name === 'class.name')?.node.text;
            const methodName = match.captures.find(c => c.name === 'method.name')?.node.text;
            const component = match.captures.find(c => c.name === 'component.name')?.node;

            if (component) {
                results.push({
                    componentName: component.text,
                    line: component.startPosition.row,
                    className,
                    methodName,
                });
            }
        });

        return results;
    } finally {
        tree.delete();
    }
}
