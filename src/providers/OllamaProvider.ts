import { Ollama } from 'ollama';
import { AIProvider, AIProviderConfig, ConflictResolutionRequest, ConflictResolutionResponse } from './AIProvider';

export class OllamaProvider extends AIProvider {
    private ollama: Ollama;

    constructor(config: AIProviderConfig) {
        super(config);
        this.ollama = new Ollama({
            host: config.endpoint || 'http://localhost:11434'
        });
    }

    async resolveConflict(request: ConflictResolutionRequest): Promise<ConflictResolutionResponse> {
        try {
            const prompt = this.buildPrompt(request);
            
            const response = await this.ollama.generate({
                model: this.config.model || 'codellama',
                prompt: prompt,
                stream: false,
                format: 'json',
                options: {
                    temperature: this.config.temperature || 0.3,
                    num_predict: this.config.maxTokens || 2048
                }
            });

            // Parse the JSON response
            let parsedResponse;
            try {
                parsedResponse = JSON.parse(response.response);
            } catch (parseError) {
                // If JSON parsing fails, try to extract meaningful content
                console.error('Failed to parse Ollama response as JSON:', parseError);
                return {
                    resolution: response.response,
                    explanation: 'AI provided a resolution but response format was unexpected',
                    confidence: 0.5
                };
            }

            return {
                resolution: parsedResponse.resolution || response.response,
                explanation: parsedResponse.explanation || 'Resolution provided by Ollama',
                confidence: parsedResponse.confidence || 0.7
            };
        } catch (error) {
            console.error('Ollama provider error:', error);
            throw new Error(`Failed to get resolution from Ollama: ${error}`);
        }
    }

    async validateConfiguration(): Promise<boolean> {
        try {
            // Check if Ollama is running and the model is available
            const models = await this.ollama.list();
            const modelName = this.config.model || 'codellama';
            
            const modelExists = models.models.some(m => m.name === modelName || m.name.startsWith(modelName));
            
            if (!modelExists) {
                console.warn(`Model ${modelName} not found in Ollama. Available models:`, models.models.map(m => m.name));
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Failed to validate Ollama configuration:', error);
            return false;
        }
    }

    async getModelList(): Promise<string[]> {
        try {
            const models = await this.ollama.list();
            return models.models.map(m => m.name);
        } catch (error) {
            console.error('Failed to get Ollama model list:', error);
            return [];
        }
    }

    async pullModel(modelName: string): Promise<void> {
        try {
            console.log(`Pulling Ollama model: ${modelName}`);
            await this.ollama.pull({ 
                model: modelName,
                stream: false 
            });
            console.log(`Successfully pulled model: ${modelName}`);
        } catch (error) {
            console.error(`Failed to pull model ${modelName}:`, error);
            throw error;
        }
    }
} 