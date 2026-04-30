Build a VS Code extension that adds an inline clickable button next to php class that extends Model When clicked, it shows a quick pick menu with related files, and opening the selected file in the editor.

### Requirements:

1. **Extension Setup:**
   - Create a standard VS Code extension structure with package.json, extension.ts, tsconfig.json
   - Extension ID: `model-related-files`
   - Display name: "Model Related Files"
   - Target language: Activate for PHP files

2. **Inline Button Decoration:**
   - After every PHP class with `class...extends...Model..."` (partial match, any position ), show a text decoration button
   - Button text: `📁 Related Files`
   - Style: Blue text (#4ec9ff), dark background (#333333), subtle border, rounded corners
   - Button should be positioned right after the closing quote of the class attribute
   - Support multiple occurrences in a single file

3. **Quick Pick Menu (on button click):**
   - Show a VS Code quick pick dropdown with these related files:
     * `/database/migrations/**[table_name]**.php` - "Data model"
   - `[table_name]` is extracted from the class value (e.g., `class UserProfile` → table name is "user_profiles")
   - Menu should show file basename, relative directory, and description
   - Use fuzzy matching in quick pick


5. **Click Behavior:**
   - When user selects an existing file: Open it in a new editor tab (split right)

7. **Command Registration:**
   - Register command: `model-related-files.showMenu`
   - Also add this command to the editor context menu (right-click) when cursor is on a model class
   - Keyboard shortcut: `Ctrl+Shift+P` then "Model: Show Related Files"

8. **Performance & Edge Cases:**
   - Debounce decoration updates (300ms)
   - Don't show decorations on lines longer than 500 characters
   - Support multiple workspace folders
   - Handle file URIs with special characters and spaces
   - Use VS Code's FileSystemWatcher to update file existence status

9. **Configuration Options (add to package.json):**
   - `modelRelatedFiles.buttonPosition`: "after-class" | "end-of-line" (default: "after-class")
   - `modelRelatedFiles.openInSplit`: boolean (default: true)
   - `modelRelatedFiles.searchDirectories`: string[] (default: [".", "./components", ".."])
   - `modelRelatedFiles.filePatterns`: object mapping extensions to descriptions

10. **Error Handling:**
    - Try-catch all file operations
    - Show user-friendly error messages via vscode.window.showErrorMessage
    - Log detailed errors to the extension's output channel
    - Never crash the extension on individual file errors

### Technical Implementation Notes:
- Use `vscode.window.createTextEditorDecorationType` with `after` for the inline button
- Use `vscode.commands.registerCommand` for the menu logic
- Use `vscode.window.showQuickPick` with `QuickPickItem` for the file menu
- Use `vscode.workspace.openTextDocument` and `vscode.window.showTextDocument` to open files
- Use `vscode.Uri.file()` to construct file URIs
- Use `fs.accessSync` or `vscode.workspace.fs.stat` to check file existence
- Register decorations in `onDidChangeActiveTextEditor` and `onDidChangeTextDocument` events

### File Structure: