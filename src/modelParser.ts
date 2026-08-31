import * as vscode from 'vscode';
import { Node } from 'web-tree-sitter';
import { enclosingClass, getParser, getQuery } from './phpParserUtil';

export interface ModelNamespace {
    /** Full namespace, e.g. "App\\Models" or "Modules\\HRM\\Models". */
    namespace: string;
    /** Module name when the model lives in a module, undefined for app models. */
    moduleName?: string;
}

export interface ModelMatch {
    className: string;
    tableName: string;
    /**
     * `declared` — read from a literal `$table`.
     * `derived`  — no `$table`, name built from the class.
     * `dynamic`  — `$table` exists but is computed, so the derived name is used.
     */
    tableSource: 'declared' | 'derived' | 'dynamic';
    line: number;
    range: vscode.Range;
}

export interface ModelDocument {
    namespace: ModelNamespace | null;
    models: ModelMatch[];
}

const APP_MODELS = /^App\\Models$/;
const MODULE_MODELS = /^Modules\\(\w+)\\Models$/;

const NAMESPACE_QUERY = `(namespace_definition name: (namespace_name) @ns)`;

const CLASS_QUERY = `(class_declaration name: (name) @name) @class`;

const TABLE_QUERY = `
    (property_declaration
        (property_element
            name: (variable_name (name) @prop.name)
            default_value: (_) @prop.value)
        (#eq? @prop.name "table"))`;

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

const cache = new Map<string, { version: number; result: ModelDocument }>();

export async function analyzeDocument(document: vscode.TextDocument): Promise<ModelDocument> {
    const key = document.uri.toString();
    const cached = cache.get(key);
    if (cached && cached.version === document.version) {
        return cached.result;
    }

    const result = await analyze(document);
    cache.set(key, { version: document.version, result });
    return result;
}

export function forgetDocument(uri: vscode.Uri): void {
    cache.delete(uri.toString());
}

async function analyze(document: vscode.TextDocument): Promise<ModelDocument> {
    const empty: ModelDocument = { namespace: null, models: [] };

    let parsed;
    try {
        parsed = await getParser();
    } catch {
        return empty;
    }

    const { parser, language } = parsed;
    const tree = parser.parse(document.getText());
    if (!tree) { return empty; }

    try {
        const namespace = readNamespace(tree.rootNode, language);
        if (!namespace) { return empty; }

        return { namespace, models: readModels(tree.rootNode, language) };
    } finally {
        tree.delete();
    }
}

function readNamespace(root: Node, language: Parameters<typeof getQuery>[0]): ModelNamespace | null {
    for (const match of getQuery(language, NAMESPACE_QUERY).matches(root)) {
        const name = match.captures[0]?.node.text;
        if (!name) { continue; }

        if (APP_MODELS.test(name)) { return { namespace: name }; }

        const module = MODULE_MODELS.exec(name);
        if (module) { return { namespace: name, moduleName: module[1] }; }
    }
    return null;
}

function readModels(root: Node, language: Parameters<typeof getQuery>[0]): ModelMatch[] {
    // A $table belongs to the nearest class-like ancestor. Anything owned by an
    // anonymous class, trait or enum is therefore never credited to the model.
    const tables = new Map<number, Node>();
    for (const match of getQuery(language, TABLE_QUERY).matches(root)) {
        const value = match.captures.find(c => c.name === 'prop.value')?.node;
        if (!value) { continue; }

        const owner = enclosingClass(value);
        if (!owner || owner.type !== 'class_declaration') { continue; }
        // First declaration wins, matching PHP itself.
        if (!tables.has(owner.id)) { tables.set(owner.id, value); }
    }

    const models: ModelMatch[] = [];
    for (const match of getQuery(language, CLASS_QUERY).matches(root)) {
        const classNode = match.captures.find(c => c.name === 'class')?.node;
        const nameNode = match.captures.find(c => c.name === 'name')?.node;
        if (!classNode || !nameNode) { continue; }

        const className = nameNode.text;
        const property = tables.get(classNode.id);
        const declared = readStringLiteral(property);

        models.push({
            className,
            tableName: declared ?? classToTableName(className),
            tableSource: declared !== null ? 'declared' : property ? 'dynamic' : 'derived',
            line: nameNode.startPosition.row,
            range: new vscode.Range(
                nameNode.startPosition.row,
                nameNode.startPosition.column,
                nameNode.endPosition.row,
                nameNode.endPosition.column
            ),
        });
    }

    return models;
}

// Only a plain string literal is usable. A computed value such as
// `self::PREFIX . 'notes'` yields null so the caller falls back to the
// class-derived name instead of silently guessing wrong.
function readStringLiteral(node: Node | undefined): string | null {
    if (!node || node.type !== 'string') { return null; }
    return node.namedChildren.find(child => child?.type === 'string_content')?.text ?? '';
}

export async function getModelsNamespace(
    document: vscode.TextDocument
): Promise<ModelNamespace | null> {
    return (await analyzeDocument(document)).namespace;
}

export async function hasModelsNamespace(document: vscode.TextDocument): Promise<boolean> {
    return (await analyzeDocument(document)).namespace !== null;
}

export async function parseModels(document: vscode.TextDocument): Promise<ModelMatch[]> {
    return (await analyzeDocument(document)).models;
}
