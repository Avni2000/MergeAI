import * as vscode from 'vscode';
import { ConflictDetector, MergeConflict } from './services/ConflictDetector';
import { AIProviderManager } from './providers/AIProviderManager';
import { ConflictResolver } from './services/ConflictResolver';
import { UIManager } from './ui/UIManager';
import { ConfigurationManager } from './services/ConfigurationManager';

let conflictDetector: ConflictDetector;
let aiProviderManager: AIProviderManager;
let conflictResolver: ConflictResolver;
let uiManager: UIManager;
let configManager: ConfigurationManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('MergeAI extension is now active!');

    // Initialize services
    configManager = new ConfigurationManager();
    aiProviderManager = new AIProviderManager(context, configManager);
    conflictDetector = new ConflictDetector();
    conflictResolver = new ConflictResolver(aiProviderManager, conflictDetector);
    uiManager = new UIManager(context);

    // Register commands
    const resolveCurrent = vscode.commands.registerCommand('mergeai.resolveCurrent', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const conflicts = await conflictDetector.detectConflictsInFile(editor.document);
            if (conflicts.length === 0) {
                vscode.window.showInformationMessage('No merge conflicts found in the current file');
                return;
            }

            // Find conflict at cursor position
            const position = editor.selection.active;
            const currentConflict = conflicts.find((c: MergeConflict) => 
                position.line >= c.startLine && position.line <= c.endLine
            );

            if (!currentConflict) {
                vscode.window.showInformationMessage('Place cursor inside a merge conflict');
                return;
            }

            await uiManager.showConflictResolution(currentConflict, conflictResolver, editor);
        } catch (error) {
            vscode.window.showErrorMessage(`Error resolving conflict: ${error}`);
        }
    });

    const resolveAll = vscode.commands.registerCommand('mergeai.resolveAll', async () => {
        try {
            const confirmation = await vscode.window.showWarningMessage(
                'This will attempt to resolve all merge conflicts automatically. Continue?',
                'Yes', 'No'
            );

            if (confirmation !== 'Yes') {
                return;
            }

            await conflictResolver.resolveAllConflicts();
        } catch (error) {
            vscode.window.showErrorMessage(`Error in agent mode: ${error}`);
        }
    });

    const configure = vscode.commands.registerCommand('mergeai.configure', async () => {
        await uiManager.showConfigurationWizard(configManager);
    });

    const showSuggestions = vscode.commands.registerCommand('mergeai.showSuggestions', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const conflicts = await conflictDetector.detectConflictsInFile(editor.document);
        if (conflicts.length === 0) {
            vscode.window.showInformationMessage('No merge conflicts found');
            return;
        }

        await uiManager.showSuggestionsList(conflicts, conflictResolver);
    });

    // Register all disposables
    context.subscriptions.push(
        resolveCurrent,
        resolveAll,
        configure,
        showSuggestions
    );

    // Set up decorations for merge conflicts
    uiManager.setupConflictDecorations();

    // Watch for file changes to detect new conflicts
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
    fileWatcher.onDidChange(async (uri) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const conflicts = await conflictDetector.detectConflictsInFile(document);
        if (conflicts.length > 0) {
            uiManager.updateStatusBar(conflicts.length);
        }
    });

    context.subscriptions.push(fileWatcher);

    // Initialize status bar
    uiManager.createStatusBarItem();
}

export function deactivate() {
    console.log('MergeAI extension is now deactivated');
} 