import * as vscode from 'vscode';
import { AIProviderManager } from '../providers/AIProviderManager';
import { ConflictDetector, MergeConflict } from './ConflictDetector';
import { ConflictResolutionRequest, ConflictResolutionResponse } from '../providers/AIProvider';

export interface ResolutionResult {
    conflict: MergeConflict;
    resolution: ConflictResolutionResponse;
    applied: boolean;
    error?: string;
}

export class ConflictResolver {
    constructor(
        private aiProviderManager: AIProviderManager,
        private conflictDetector: ConflictDetector
    ) {}

    async resolveConflict(
        document: vscode.TextDocument, 
        conflict: MergeConflict
    ): Promise<ConflictResolutionResponse> {
        const provider = this.aiProviderManager.getProvider();
        
        // Extract context around the conflict
        const context = this.conflictDetector.extractContext(document, conflict);
        
        // Get file language for better AI understanding
        const language = document.languageId;
        
        const request: ConflictResolutionRequest = {
            currentContent: conflict.currentContent,
            incomingContent: conflict.incomingContent,
            baseContent: conflict.baseContent,
            context: context,
            filePath: conflict.filePath,
            language: language
        };

        return await provider.resolveConflict(request);
    }

    async applyResolution(
        editor: vscode.TextEditor,
        conflict: MergeConflict,
        resolution: string
    ): Promise<boolean> {
        try {
            const edit = new vscode.WorkspaceEdit();
            const range = new vscode.Range(
                conflict.startLine, 0,
                conflict.endLine, editor.document.lineAt(conflict.endLine).text.length
            );
            
            edit.replace(editor.document.uri, range, resolution);
            const success = await vscode.workspace.applyEdit(edit);
            
            if (success) {
                await editor.document.save();
            }
            
            return success;
        } catch (error) {
            console.error('Failed to apply resolution:', error);
            return false;
        }
    }

    async resolveAllConflicts(): Promise<ResolutionResult[]> {
        const results: ResolutionResult[] = [];
        const allConflicts = await this.conflictDetector.detectAllConflicts();
        
        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Resolving merge conflicts',
            cancellable: true
        }, async (progress, token) => {
            let totalConflicts = 0;
            for (const conflicts of allConflicts.values()) {
                totalConflicts += conflicts.length;
            }
            
            let resolvedCount = 0;
            
            for (const [filePath, conflicts] of allConflicts.entries()) {
                if (token.isCancellationRequested) {
                    break;
                }
                
                const document = await vscode.workspace.openTextDocument(filePath);
                const editor = await vscode.window.showTextDocument(document);
                
                // Sort conflicts by line number in reverse to avoid offset issues
                const sortedConflicts = [...conflicts].sort((a, b) => b.startLine - a.startLine);
                
                for (const conflict of sortedConflicts) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    
                    resolvedCount++;
                    progress.report({
                        increment: (100 / totalConflicts),
                        message: `Resolving conflict ${resolvedCount}/${totalConflicts} in ${vscode.workspace.asRelativePath(filePath)}`
                    });
                    
                    try {
                        const resolution = await this.resolveConflict(document, conflict);
                        const applied = await this.applyResolution(editor, conflict, resolution.resolution);
                        
                        results.push({
                            conflict,
                            resolution,
                            applied,
                            error: applied ? undefined : 'Failed to apply edit'
                        });
                        
                        if (!applied) {
                            const retry = await vscode.window.showWarningMessage(
                                `Failed to apply resolution to conflict in ${vscode.workspace.asRelativePath(filePath)}`,
                                'Retry', 'Skip', 'Cancel'
                            );
                            
                            if (retry === 'Cancel') {
                                return results;
                            } else if (retry === 'Retry') {
                                // Try again
                                const retryApplied = await this.applyResolution(editor, conflict, resolution.resolution);
                                results[results.length - 1].applied = retryApplied;
                            }
                        }
                    } catch (error: any) {
                        results.push({
                            conflict,
                            resolution: {
                                resolution: '',
                                explanation: '',
                                confidence: 0
                            },
                            applied: false,
                            error: error.message
                        });
                        
                        const action = await vscode.window.showErrorMessage(
                            `Error resolving conflict: ${error.message}`,
                            'Continue', 'Cancel'
                        );
                        
                        if (action === 'Cancel') {
                            return results;
                        }
                    }
                }
            }
            
            return results;
        });
        
        // Show summary
        const successful = results.filter(r => r.applied).length;
        const failed = results.filter(r => !r.applied).length;
        
        if (failed === 0) {
            vscode.window.showInformationMessage(
                `Successfully resolved all ${successful} conflicts!`
            );
        } else {
            vscode.window.showWarningMessage(
                `Resolved ${successful} conflicts, ${failed} failed. Check the output for details.`
            );
        }
        
        return results;
    }

    async getSuggestions(
        document: vscode.TextDocument,
        conflict: MergeConflict,
        count: number = 3
    ): Promise<ConflictResolutionResponse[]> {
        const suggestions: ConflictResolutionResponse[] = [];
        const provider = this.aiProviderManager.getProvider();
        
        // Generate multiple suggestions by varying the temperature
        const temperatures = [0.2, 0.5, 0.8];
        
        for (let i = 0; i < Math.min(count, temperatures.length); i++) {
            try {
                const context = this.conflictDetector.extractContext(document, conflict);
                const request: ConflictResolutionRequest = {
                    currentContent: conflict.currentContent,
                    incomingContent: conflict.incomingContent,
                    baseContent: conflict.baseContent,
                    context: context,
                    filePath: conflict.filePath,
                    language: document.languageId
                };
                
                const resolution = await provider.resolveConflict(request);
                suggestions.push(resolution);
            } catch (error) {
                console.error('Failed to get suggestion:', error);
            }
        }
        
        return suggestions;
    }
} 