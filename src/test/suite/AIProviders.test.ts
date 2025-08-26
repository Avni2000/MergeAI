import * as assert from 'assert';
import { AIProvider, AIProviderConfig, ConflictResolutionRequest, ConflictResolutionResponse } from '../../providers/AIProvider';
import { OllamaProvider } from '../../providers/OllamaProvider';

// Mock Ollama provider for testing
class MockOllamaProvider extends OllamaProvider {
    private mockResponse: ConflictResolutionResponse;

    constructor(config: AIProviderConfig, mockResponse: ConflictResolutionResponse) {
        super(config);
        this.mockResponse = mockResponse;
    }

    async resolveConflict(request: ConflictResolutionRequest): Promise<ConflictResolutionResponse> {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 10));
        return this.mockResponse;
    }

    async validateConfiguration(): Promise<boolean> {
        return true; // Always valid for testing
    }

    async getModelList(): Promise<string[]> {
        return ['codellama', 'llama2', 'mistral'];
    }
}

// Mock OpenAI provider for testing
class MockOpenAIProvider extends AIProvider {
    private mockResponse: ConflictResolutionResponse;
    private shouldFail: boolean;

    constructor(config: AIProviderConfig, mockResponse: ConflictResolutionResponse, shouldFail = false) {
        super(config);
        this.mockResponse = mockResponse;
        this.shouldFail = shouldFail;
    }

    async resolveConflict(request: ConflictResolutionRequest): Promise<ConflictResolutionResponse> {
        if (this.shouldFail) {
            throw new Error('API request failed');
        }
        
        await new Promise(resolve => setTimeout(resolve, 10));
        return this.mockResponse;
    }

    async validateConfiguration(): Promise<boolean> {
        return !!this.config.apiKey;
    }

    async getModelList(): Promise<string[]> {
        return ['gpt-4', 'gpt-3.5-turbo'];
    }
}

suite('AI Providers Test Suite', () => {
    
    test('should create AIProvider with correct config', () => {
        const config: AIProviderConfig = {
            model: 'test-model',
            temperature: 0.5,
            maxTokens: 1000
        };

        const mockResponse: ConflictResolutionResponse = {
            resolution: 'resolved code',
            explanation: 'test explanation',
            confidence: 0.9
        };

        const provider = new MockOllamaProvider(config, mockResponse);
        assert.ok(provider);
    });

    test('should build proper prompt for conflict resolution', () => {
        const config: AIProviderConfig = { model: 'test-model' };
        const mockResponse: ConflictResolutionResponse = {
            resolution: 'resolved code',
            explanation: 'test explanation',
            confidence: 0.9
        };

        const provider = new MockOllamaProvider(config, mockResponse);
        
        const request: ConflictResolutionRequest = {
            currentContent: 'current version',
            incomingContent: 'incoming version',
            baseContent: 'base version',
            context: 'surrounding context',
            filePath: 'test.js',
            language: 'javascript'
        };

        // Access the protected buildPrompt method through casting
        const prompt = (provider as any).buildPrompt(request);
        
        assert.ok(prompt.includes('current version'));
        assert.ok(prompt.includes('incoming version'));
        assert.ok(prompt.includes('base version'));
        assert.ok(prompt.includes('surrounding context'));
        assert.ok(prompt.includes('test.js'));
        assert.ok(prompt.includes('JSON format'));
    });

    test('should resolve conflict successfully', async () => {
        const config: AIProviderConfig = { model: 'test-model' };
        const expectedResponse: ConflictResolutionResponse = {
            resolution: 'function merged() { return "resolved"; }',
            explanation: 'Combined both implementations',
            confidence: 0.85
        };

        const provider = new MockOllamaProvider(config, expectedResponse);
        
        const request: ConflictResolutionRequest = {
            currentContent: 'function test() { return "current"; }',
            incomingContent: 'function test() { return "incoming"; }',
            context: 'function context',
            filePath: 'test.js'
        };

        const response = await provider.resolveConflict(request);
        
        assert.strictEqual(response.resolution, expectedResponse.resolution);
        assert.strictEqual(response.explanation, expectedResponse.explanation);
        assert.strictEqual(response.confidence, expectedResponse.confidence);
    });

    test('should handle API errors gracefully', async () => {
        const config: AIProviderConfig = { model: 'test-model' };
        const mockResponse: ConflictResolutionResponse = {
            resolution: '',
            explanation: '',
            confidence: 0
        };

        const provider = new MockOpenAIProvider(config, mockResponse, true);
        
        const request: ConflictResolutionRequest = {
            currentContent: 'current',
            incomingContent: 'incoming',
            context: 'context',
            filePath: 'test.js'
        };

        try {
            await provider.resolveConflict(request);
            assert.fail('Should have thrown an error');
        } catch (error: any) {
            assert.ok(error.message.includes('API request failed'));
        }
    });

    test('should validate configuration correctly', async () => {
        const validConfig: AIProviderConfig = {
            apiKey: 'valid-key',
            model: 'gpt-4'
        };

        const invalidConfig: AIProviderConfig = {
            model: 'gpt-4'
            // Missing API key
        };

        const mockResponse: ConflictResolutionResponse = {
            resolution: 'test',
            explanation: 'test',
            confidence: 0.5
        };

        const validProvider = new MockOpenAIProvider(validConfig, mockResponse);
        const invalidProvider = new MockOpenAIProvider(invalidConfig, mockResponse);

        assert.strictEqual(await validProvider.validateConfiguration(), true);
        assert.strictEqual(await invalidProvider.validateConfiguration(), false);
    });

    test('should return model list', async () => {
        const config: AIProviderConfig = { model: 'test-model' };
        const mockResponse: ConflictResolutionResponse = {
            resolution: 'test',
            explanation: 'test',
            confidence: 0.5
        };

        const ollamaProvider = new MockOllamaProvider(config, mockResponse);
        const openaiProvider = new MockOpenAIProvider(config, mockResponse);

        const ollamaModels = await ollamaProvider.getModelList();
        const openaiModels = await openaiProvider.getModelList();

        assert.ok(ollamaModels.includes('codellama'));
        assert.ok(ollamaModels.includes('llama2'));
        assert.ok(openaiModels.includes('gpt-4'));
        assert.ok(openaiModels.includes('gpt-3.5-turbo'));
    });

    test('should handle prompt building without base content', () => {
        const config: AIProviderConfig = { model: 'test-model' };
        const mockResponse: ConflictResolutionResponse = {
            resolution: 'test',
            explanation: 'test',
            confidence: 0.5
        };

        const provider = new MockOllamaProvider(config, mockResponse);
        
        const request: ConflictResolutionRequest = {
            currentContent: 'current version',
            incomingContent: 'incoming version',
            // No baseContent
            context: 'surrounding context',
            filePath: 'test.js'
        };

        const prompt = (provider as any).buildPrompt(request);
        
        assert.ok(prompt.includes('current version'));
        assert.ok(prompt.includes('incoming version'));
        assert.ok(!prompt.includes('BASE VERSION'));
        assert.ok(prompt.includes('surrounding context'));
    });

    test('should include confidence score in response', async () => {
        const config: AIProviderConfig = { model: 'test-model' };
        const expectedResponse: ConflictResolutionResponse = {
            resolution: 'resolved code',
            explanation: 'merged successfully',
            confidence: 0.92
        };

        const provider = new MockOllamaProvider(config, expectedResponse);
        
        const request: ConflictResolutionRequest = {
            currentContent: 'current',
            incomingContent: 'incoming',
            context: 'context',
            filePath: 'test.js'
        };

        const response = await provider.resolveConflict(request);
        
        assert.strictEqual(typeof response.confidence, 'number');
        assert.ok(response.confidence >= 0 && response.confidence <= 1);
        assert.strictEqual(response.confidence, 0.92);
    });
}); 