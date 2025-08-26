import * as vscode from 'vscode';
import { MergeConflict } from '../services/ConflictDetector';
import { ConflictResolver } from '../services/ConflictResolver';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { ConflictResolutionResponse } from '../providers/AIProvider';

export class UIManager {
    private statusBarItem: vscode.StatusBarItem | undefined;
    private conflictDecorationType: vscode.TextEditorDecorationType | undefined;
    
    constructor(private context: vscode.ExtensionContext) {}

    createStatusBarItem(): void {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.text = '$(git-merge) MergeAI';
        this.statusBarItem.tooltip = 'Click to configure MergeAI';
        this.statusBarItem.command = 'mergeai.configure';
        this.statusBarItem.show();
        
        this.context.subscriptions.push(this.statusBarItem);
    }

    updateStatusBar(conflictCount: number): void {
        if (this.statusBarItem) {
            if (conflictCount > 0) {
                this.statusBarItem.text = `$(git-merge) ${conflictCount} conflicts`;
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            } else {
                this.statusBarItem.text = '$(git-merge) MergeAI';
                this.statusBarItem.backgroundColor = undefined;
            }
        }
    }

    setupConflictDecorations(): void {
        this.conflictDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('merge.conflictBackground'),
            border: '1px solid',
            borderColor: new vscode.ThemeColor('merge.conflictBorder'),
            isWholeLine: true,
            overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.errorForeground'),
            overviewRulerLane: vscode.OverviewRulerLane.Full
        });
        
        this.context.subscriptions.push(this.conflictDecorationType);
    }

    async showConflictResolution(
        conflict: MergeConflict,
        resolver: ConflictResolver,
        editor: vscode.TextEditor
    ): Promise<void> {
        // Show progress while getting AI resolution
        const resolution = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Getting AI resolution...',
            cancellable: false
        }, async () => {
            return await resolver.resolveConflict(editor.document, conflict);
        });

        // Show resolution options
        const action = await this.showResolutionDialog(resolution, conflict);
        
        if (action === 'apply') {
            const success = await resolver.applyResolution(editor, conflict, resolution.resolution);
            if (success) {
                vscode.window.showInformationMessage('Conflict resolved successfully!');
            } else {
                vscode.window.showErrorMessage('Failed to apply resolution');
            }
        } else if (action === 'showAlternatives') {
            await this.showAlternativeSuggestions(conflict, resolver, editor);
        }
    }

    private async showResolutionDialog(
        resolution: ConflictResolutionResponse,
        conflict: MergeConflict
    ): Promise<'apply' | 'showAlternatives' | 'cancel'> {
        const confidenceEmoji = resolution.confidence > 0.8 ? '✅' : 
                                resolution.confidence > 0.6 ? '⚠️' : '❌';
        
        const message = `${confidenceEmoji} Confidence: ${(resolution.confidence * 100).toFixed(0)}%\n\n${resolution.explanation}`;
        
        const action = await vscode.window.showInformationMessage(
            message,
            { modal: true },
            'Apply Resolution',
            'Show Alternatives',
            'View Diff',
            'Cancel'
        );
        
        if (action === 'Apply Resolution') {
            return 'apply';
        } else if (action === 'Show Alternatives') {
            return 'showAlternatives';
        } else if (action === 'View Diff') {
            await this.showDiffPreview(conflict, resolution.resolution);
            return await this.showResolutionDialog(resolution, conflict);
        }
        
        return 'cancel';
    }

    private async showDiffPreview(conflict: MergeConflict, resolution: string): Promise<void> {
        // Create a temporary document with the resolution
        const originalContent = `<<<<<<< HEAD\n${conflict.currentContent}\n=======\n${conflict.incomingContent}\n>>>>>>> incoming`;
        const resolvedContent = resolution;
        
        const originalDoc = await vscode.workspace.openTextDocument({
            content: originalContent,
            language: 'text'
        });
        
        const resolvedDoc = await vscode.workspace.openTextDocument({
            content: resolvedContent,
            language: 'text'
        });
        
        await vscode.commands.executeCommand(
            'vscode.diff',
            originalDoc.uri,
            resolvedDoc.uri,
            'Conflict → Resolution'
        );
    }

    async showAlternativeSuggestions(
        conflict: MergeConflict,
        resolver: ConflictResolver,
        editor: vscode.TextEditor
    ): Promise<void> {
        const suggestions = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating alternative suggestions...',
            cancellable: false
        }, async () => {
            return await resolver.getSuggestions(editor.document, conflict, 3);
        });
        
        if (suggestions.length === 0) {
            vscode.window.showErrorMessage('Failed to generate alternative suggestions');
            return;
        }
        
        const items = suggestions.map((s, i) => ({
            label: `Option ${i + 1} (${(s.confidence * 100).toFixed(0)}% confidence)`,
            description: s.explanation.substring(0, 100),
            detail: s.resolution.substring(0, 200) + '...',
            resolution: s
        }));
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a resolution option',
            matchOnDescription: true,
            matchOnDetail: true
        });
        
        if (selected) {
            const action = await this.showResolutionDialog(selected.resolution, conflict);
            if (action === 'apply') {
                const success = await resolver.applyResolution(
                    editor, 
                    conflict, 
                    selected.resolution.resolution
                );
                if (success) {
                    vscode.window.showInformationMessage('Conflict resolved successfully!');
                } else {
                    vscode.window.showErrorMessage('Failed to apply resolution');
                }
            }
        }
    }

    async showSuggestionsList(
        conflicts: MergeConflict[],
        resolver: ConflictResolver
    ): Promise<void> {
        const items = conflicts.map((c, i) => ({
            label: `Conflict ${i + 1} (Line ${c.startLine + 1})`,
            description: `${c.currentContent.substring(0, 50)}...`,
            conflict: c
        }));
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a conflict to view suggestions'
        });
        
        if (selected) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                // Move cursor to conflict
                const position = new vscode.Position(selected.conflict.startLine, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position));
                
                await this.showConflictResolution(selected.conflict, resolver, editor);
            }
        }
    }

    async showConfigurationWizard(configManager: ConfigurationManager): Promise<void> {
        // Provider selection
        const provider = await vscode.window.showQuickPick(
            [
                { label: 'Ollama (Local)', value: 'ollama', description: 'Use local Ollama models' },
                { label: 'OpenAI', value: 'openai', description: 'Use OpenAI GPT models (requires API key)' },
                { label: 'Claude', value: 'claude', description: 'Use Anthropic Claude models (requires API key)' }
            ],
            { placeHolder: 'Select AI provider' }
        );
        
        if (!provider) {
            return;
        }
        
        configManager.setProviderType(provider.value as any);
        
        // Provider-specific configuration
        switch (provider.value) {
            case 'ollama': {
                const ollamaUrl = await vscode.window.showInputBox({
                    prompt: 'Enter Ollama server URL',
                    value: configManager.getOllamaUrl(),
                    placeHolder: 'http://localhost:11434'
                });
                if (ollamaUrl) {
                    configManager.setOllamaUrl(ollamaUrl);
                }
                
                const ollamaModel = await vscode.window.showInputBox({
                    prompt: 'Enter Ollama model name',
                    value: configManager.getOllamaModel(),
                    placeHolder: 'codellama'
                });
                if (ollamaModel) {
                    configManager.setOllamaModel(ollamaModel);
                }
                break;
            }
                
            case 'openai': {
                const openaiModel = await vscode.window.showQuickPick(
                    ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
                    { placeHolder: 'Select OpenAI model' }
                );
                if (openaiModel) {
                    configManager.setOpenAIModel(openaiModel);
                }
                vscode.window.showInformationMessage(
                    'API key will be requested when needed and stored securely'
                );
                break;
            }
                
            case 'claude': {
                const claudeModel = await vscode.window.showQuickPick(
                    ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
                    { placeHolder: 'Select Claude model' }
                );
                if (claudeModel) {
                    configManager.setClaudeModel(claudeModel);
                }
                vscode.window.showInformationMessage(
                    'API key will be requested when needed and stored securely'
                );
                break;
            }
        }
        
        // Auto-resolve setting
        const autoResolve = await vscode.window.showQuickPick(
            [
                { label: 'Manual', value: false, description: 'Review each resolution before applying' },
                { label: 'Automatic', value: true, description: 'Apply resolutions automatically (Agent Mode)' }
            ],
            { placeHolder: 'Select resolution mode' }
        );
        
        if (autoResolve) {
            configManager.setAutoResolve(autoResolve.value);
        }
        
        vscode.window.showInformationMessage('MergeAI configuration updated successfully!');
    }

    highlightConflicts(editor: vscode.TextEditor, conflicts: MergeConflict[]): void {
        if (!this.conflictDecorationType) {
            return;
        }
        
        const decorations = conflicts.map(conflict => {
            return {
                range: new vscode.Range(
                    conflict.startLine, 0,
                    conflict.endLine, editor.document.lineAt(conflict.endLine).text.length
                ),
                hoverMessage: `Merge conflict detected. Use Ctrl+Alt+M to resolve.`
            };
        });
        
        editor.setDecorations(this.conflictDecorationType, decorations);
    }
} 