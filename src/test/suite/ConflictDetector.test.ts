import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConflictDetector, MergeConflict } from '../../services/ConflictDetector';

suite('ConflictDetector Test Suite', () => {
    let conflictDetector: ConflictDetector;

    setup(() => {
        conflictDetector = new ConflictDetector();
    });

    test('should detect simple merge conflict', async () => {
        const content = `function hello() {
<<<<<<< HEAD
    console.log("Hello from HEAD");
=======
    console.log("Hello from branch");
>>>>>>> feature-branch
}`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });

        const conflicts = await conflictDetector.detectConflictsInFile(document);
        
        assert.strictEqual(conflicts.length, 1);
        
        const conflict = conflicts[0];
        assert.strictEqual(conflict.startLine, 1);
        assert.strictEqual(conflict.endLine, 5);
        assert.strictEqual(conflict.currentContent, '    console.log("Hello from HEAD");');
        assert.strictEqual(conflict.incomingContent, '    console.log("Hello from branch");');
        assert.strictEqual(conflict.separatorLine, 3);
    });

    test('should detect multiple merge conflicts', async () => {
        const content = `function first() {
<<<<<<< HEAD
    return "first HEAD";
=======
    return "first branch";
>>>>>>> feature
}

function second() {
<<<<<<< HEAD
    return "second HEAD";
=======
    return "second branch";
>>>>>>> feature
}`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });

        const conflicts = await conflictDetector.detectConflictsInFile(document);
        
        assert.strictEqual(conflicts.length, 2);
        assert.strictEqual(conflicts[0].startLine, 1);
        assert.strictEqual(conflicts[1].startLine, 8);
    });

    test('should detect 3-way merge conflict with base', async () => {
        const content = `function test() {
<<<<<<< HEAD
    console.log("HEAD version");
||||||| base
    console.log("base version");
=======
    console.log("branch version");
>>>>>>> feature
}`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });

        const conflicts = await conflictDetector.detectConflictsInFile(document);
        
        assert.strictEqual(conflicts.length, 1);
        
        const conflict = conflicts[0];
        assert.strictEqual(conflict.currentContent, '    console.log("HEAD version");');
        assert.strictEqual(conflict.incomingContent, '    console.log("branch version");');
        assert.strictEqual(conflict.baseContent, '    console.log("base version");');
    });

    test('should return empty array for file without conflicts', async () => {
        const content = `function hello() {
    console.log("No conflicts here");
}`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });

        const conflicts = await conflictDetector.detectConflictsInFile(document);
        
        assert.strictEqual(conflicts.length, 0);
    });

    test('should detect conflict at cursor position', () => {
        const conflicts: MergeConflict[] = [
            {
                startLine: 5,
                endLine: 10,
                currentStart: 6,
                currentEnd: 7,
                incomingStart: 9,
                incomingEnd: 9,
                separatorLine: 8,
                currentContent: 'HEAD content',
                incomingContent: 'branch content',
                filePath: 'test.js'
            },
            {
                startLine: 15,
                endLine: 20,
                currentStart: 16,
                currentEnd: 17,
                incomingStart: 19,
                incomingEnd: 19,
                separatorLine: 18,
                currentContent: 'Another HEAD content',
                incomingContent: 'Another branch content',
                filePath: 'test.js'
            }
        ];

        // Position inside first conflict
        const position1 = new vscode.Position(7, 0);
        const conflict1 = conflictDetector.getConflictAtPosition(conflicts, position1);
        assert.strictEqual(conflict1, conflicts[0]);

        // Position inside second conflict
        const position2 = new vscode.Position(18, 0);
        const conflict2 = conflictDetector.getConflictAtPosition(conflicts, position2);
        assert.strictEqual(conflict2, conflicts[1]);

        // Position outside any conflict
        const position3 = new vscode.Position(25, 0);
        const conflict3 = conflictDetector.getConflictAtPosition(conflicts, position3);
        assert.strictEqual(conflict3, undefined);
    });

    test('should extract context around conflict', async () => {
        const content = `line 1
line 2
line 3
<<<<<<< HEAD
HEAD content
=======
branch content
>>>>>>> feature
line 4
line 5
line 6`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });

        const conflicts = await conflictDetector.detectConflictsInFile(document);
        const conflict = conflicts[0];
        
        const context = conflictDetector.extractContext(document, conflict, 2);
        
        assert.ok(context.includes('line 2'));
        assert.ok(context.includes('line 3'));
        assert.ok(context.includes('line 4'));
        assert.ok(context.includes('line 5'));
    });

    test('should check if document has conflicts', async () => {
        const conflictContent = `function test() {
<<<<<<< HEAD
    return "HEAD";
=======
    return "branch";
>>>>>>> feature
}`;

        const noConflictContent = `function test() {
    return "no conflicts";
}`;

        const conflictDoc = await vscode.workspace.openTextDocument({
            content: conflictContent,
            language: 'javascript'
        });

        const noConflictDoc = await vscode.workspace.openTextDocument({
            content: noConflictContent,
            language: 'javascript'
        });

        assert.strictEqual(conflictDetector.hasConflicts(conflictDoc), true);
        assert.strictEqual(conflictDetector.hasConflicts(noConflictDoc), false);
    });

    test('should handle edge case with empty conflict sections', async () => {
        const content = `function test() {
<<<<<<< HEAD
=======
>>>>>>> feature
}`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });

        const conflicts = await conflictDetector.detectConflictsInFile(document);
        
        assert.strictEqual(conflicts.length, 1);
        assert.strictEqual(conflicts[0].currentContent, '');
        assert.strictEqual(conflicts[0].incomingContent, '');
    });

    test('should handle malformed conflict markers', async () => {
        const content = `function test() {
<<<<<<< HEAD
    some content
// Missing separator or end marker
}`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });

        const conflicts = await conflictDetector.detectConflictsInFile(document);
        
        // Should not detect incomplete conflicts
        assert.strictEqual(conflicts.length, 0);
    });
}); 