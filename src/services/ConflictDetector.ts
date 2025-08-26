import * as vscode from 'vscode';

export interface MergeConflict {
    startLine: number;
    endLine: number;
    currentStart: number;
    currentEnd: number;
    incomingStart: number;
    incomingEnd: number;
    separatorLine: number;
    currentContent: string;
    incomingContent: string;
    baseContent?: string;
    filePath: string;
}

export class ConflictDetector {
    private readonly conflictStartPattern = /^<{7}\s+(.*)$/;
    private readonly conflictSeparatorPattern = /^={7}$/;
    private readonly conflictEndPattern = /^>{7}\s+(.*)$/;
    private readonly conflictBasePattern = /^\|{7}\s+(.*)$/;

    async detectConflictsInFile(document: vscode.TextDocument): Promise<MergeConflict[]> {
        const conflicts: MergeConflict[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        let inConflict = false;
        let currentConflict: Partial<MergeConflict> | null = null;
        let section: 'current' | 'base' | 'incoming' = 'current';
        let currentContent: string[] = [];
        let baseContent: string[] = [];
        let incomingContent: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (this.conflictStartPattern.test(line)) {
                // Start of a new conflict
                inConflict = true;
                currentConflict = {
                    startLine: i,
                    currentStart: i + 1,
                    filePath: document.fileName
                };
                section = 'current';
                currentContent = [];
                baseContent = [];
                incomingContent = [];
            } else if (inConflict && this.conflictSeparatorPattern.test(line)) {
                // Separator between current and incoming
                if (currentConflict) {
                    currentConflict.currentEnd = i - 1;
                    currentConflict.separatorLine = i;
                    currentConflict.incomingStart = i + 1;
                }
                section = 'incoming';
            } else if (inConflict && this.conflictBasePattern.test(line)) {
                // Base marker (for 3-way merge conflicts)
                section = 'base';
            } else if (inConflict && this.conflictEndPattern.test(line)) {
                // End of conflict
                if (currentConflict) {
                    currentConflict.endLine = i;
                    currentConflict.incomingEnd = i - 1;
                    currentConflict.currentContent = currentContent.join('\n');
                    currentConflict.incomingContent = incomingContent.join('\n');
                    if (baseContent.length > 0) {
                        currentConflict.baseContent = baseContent.join('\n');
                    }
                    conflicts.push(currentConflict as MergeConflict);
                }
                inConflict = false;
                currentConflict = null;
            } else if (inConflict) {
                // Content within conflict
                switch (section) {
                    case 'current':
                        currentContent.push(line);
                        break;
                    case 'base':
                        baseContent.push(line);
                        break;
                    case 'incoming':
                        incomingContent.push(line);
                        break;
                }
            }
        }

        return conflicts;
    }

    async detectAllConflicts(): Promise<Map<string, MergeConflict[]>> {
        const conflictsByFile = new Map<string, MergeConflict[]>();
        
        // Find all files in workspace
        const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
        
        for (const file of files) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const conflicts = await this.detectConflictsInFile(document);
                if (conflicts.length > 0) {
                    conflictsByFile.set(file.fsPath, conflicts);
                }
            } catch (error) {
                // Skip files that can't be opened as text
                continue;
            }
        }

        return conflictsByFile;
    }

    hasConflicts(document: vscode.TextDocument): boolean {
        const text = document.getText();
        return this.conflictStartPattern.test(text) && 
               this.conflictSeparatorPattern.test(text) && 
               this.conflictEndPattern.test(text);
    }

    getConflictAtPosition(conflicts: MergeConflict[], position: vscode.Position): MergeConflict | undefined {
        return conflicts.find(conflict => 
            position.line >= conflict.startLine && 
            position.line <= conflict.endLine
        );
    }

    extractContext(document: vscode.TextDocument, conflict: MergeConflict, contextLines: number = 50): string {
        const lines = document.getText().split('\n');
        const startContext = Math.max(0, conflict.startLine - contextLines);
        const endContext = Math.min(lines.length - 1, conflict.endLine + contextLines);
        
        const beforeContext = lines.slice(startContext, conflict.startLine).join('\n');
        const afterContext = lines.slice(conflict.endLine + 1, endContext + 1).join('\n');
        
        return `Context before conflict:\n${beforeContext}\n\nContext after conflict:\n${afterContext}`;
    }
} 