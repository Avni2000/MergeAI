import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConflictResolver } from '../../services/ConflictResolver';
import { ConflictDetector, MergeConflict } from '../../services/ConflictDetector';
import { AIProviderManager } from '../../providers/AIProviderManager';
import { ConfigurationManager } from '../../services/ConfigurationManager';
import { AIProvider, AIProviderConfig, ConflictResolutionRequest, ConflictResolutionResponse } from '../../providers/AIProvider';

// Mock AI Provider for testing
class MockAIProvider extends AIProvider {
    private responses: ConflictResolutionResponse[];
    private callCount = 0;

    constructor(config: AIProviderConfig, responses: ConflictResolutionResponse[]) {
        super(config);
        this.responses = responses;
    }

    async resolveConflict(request: ConflictResolutionRequest): Promise<ConflictResolutionResponse> {
        const response = this.responses[this.callCount] || this.responses[0];
        this.callCount++;
        return response;
    }

    async validateConfiguration(): Promise<boolean> {
        return true;
    }

    async getModelList(): Promise<string[]> {
        return ['mock-model'];
    }
}

// Mock AI Provider Manager
class MockAIProviderManager extends AIProviderManager {
    private mockProvider: MockAIProvider;

    constructor(context: vscode.ExtensionContext, configManager: ConfigurationManager, mockProvider: MockAIProvider) {
        super(context, configManager);
        this.mockProvider = mockProvider;
    }

    getProvider(): AIProvider {
        return this.mockProvider;
    }
}

suite('ConflictResolver Test Suite', () => {
    let conflictResolver: ConflictResolver;
    let conflictDetector: ConflictDetector;
    let mockProvider: MockAIProvider;
    let mockProviderManager: MockAIProviderManager;

    setup(async () => {
        // Create mock AI provider with test responses
        const mockResponses: ConflictResolutionResponse[] = [
            {
                resolution: 'function resolved() {\n    return "merged successfully";\n}',
                explanation: 'Combined both implementations',
                confidence: 0.9
            }
        ];

        mockProvider = new MockAIProvider({}, mockResponses);
        
        // Create a mock extension context
        const mockContext = {
            secrets: {
                get: async () => undefined,
                store: async () => {},
                delete: async () => {}
            }
        } as any;

        const configManager = new ConfigurationManager();
        mockProviderManager = new MockAIProviderManager(mockContext, configManager, mockProvider);
        
        conflictDetector = new ConflictDetector();
        conflictResolver = new ConflictResolver(mockProviderManager, conflictDetector);
    });

    test('should resolve a simple conflict', async () => {
        const content = `function test() {
<<<<<<< HEAD
    return "current version";
=======
    return "incoming version";
>>>>>>> feature
}`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });

        const conflicts = await conflictDetector.detectConflictsInFile(document);
        assert.strictEqual(conflicts.length, 1);

        const resolution = await conflictResolver.resolveConflict(document, conflicts[0]);
        
        assert.ok(resolution.resolution);
        assert.ok(resolution.explanation);
        assert.strictEqual(typeof resolution.confidence, 'number');
        assert.ok(resolution.confidence >= 0 && resolution.confidence <= 1);
    });

    test('should generate multiple suggestions', async () => {
        const content = `function test() {
<<<<<<< HEAD
    console.log("HEAD");
=======
    console.log("branch");
>>>>>>> feature
}`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });

        const conflicts = await conflictDetector.detectConflictsInFile(document);
        const suggestions = await conflictResolver.getSuggestions(document, conflicts[0], 2);
        
        assert.ok(suggestions.length > 0);
        suggestions.forEach(suggestion => {
            assert.ok(suggestion.resolution);
            assert.ok(suggestion.explanation);
            assert.strictEqual(typeof suggestion.confidence, 'number');
        });
    });

    test('should apply resolution to editor', async () => {
        const content = `function test() {
<<<<<<< HEAD
    return "current";
=======
    return "incoming";
>>>>>>> feature
}`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });

        const editor = await vscode.window.showTextDocument(document);
        const conflicts = await conflictDetector.detectConflictsInFile(document);
        
        const testResolution = 'function test() {\n    return "resolved";\n}';
        const success = await conflictResolver.applyResolution(editor, conflicts[0], testResolution);
        
        assert.strictEqual(success, true);
        
        // Verify the content was actually changed
        const updatedContent = editor.document.getText();
        assert.ok(updatedContent.includes('resolved'));
        assert.ok(!updatedContent.includes('<<<<<<<'));
        assert.ok(!updatedContent.includes('======='));
        assert.ok(!updatedContent.includes('>>>>>>>'));
    });

    test('should handle conflicts with base content', async () => {
        const content = `function test() {
<<<<<<< HEAD
    return "current";
||||||| base
    return "original";
=======
    return "incoming";
>>>>>>> feature
}`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });

        const conflicts = await conflictDetector.detectConflictsInFile(document);
        assert.strictEqual(conflicts.length, 1);
        assert.ok(conflicts[0].baseContent);

        const resolution = await conflictResolver.resolveConflict(document, conflicts[0]);
        assert.ok(resolution.resolution);
        assert.ok(resolution.explanation);
    });

    test('should handle empty conflict sections', async () => {
        const content = `function test() {
<<<<<<< HEAD
=======
    return "incoming only";
>>>>>>> feature
}`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });

        const conflicts = await conflictDetector.detectConflictsInFile(document);
        const resolution = await conflictResolver.resolveConflict(document, conflicts[0]);
        
        assert.ok(resolution.resolution);
        assert.ok(resolution.explanation);
    });

    test('should include context in resolution request', async () => {
        const content = `// Important function
// Used throughout the application
function test() {
<<<<<<< HEAD
    return "current";
=======
    return "incoming";
>>>>>>> feature
}
// End of function`;

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'javascript'
        });

        const conflicts = await conflictDetector.detectConflictsInFile(document);
        const context = conflictDetector.extractContext(document, conflicts[0], 10);
        
        // Verify context extraction works
        assert.ok(context.includes('Important function'));
        assert.ok(context.includes('End of function'));
        
        // Verify resolution works with context
        const resolution = await conflictResolver.resolveConflict(document, conflicts[0]);
        assert.ok(resolution.resolution);
        assert.ok(resolution.explanation);
    });
}); 