import axios from 'axios';
import { AIProvider, AIProviderConfig, ConflictResolutionRequest, ConflictResolutionResponse } from './AIProvider';

export class OpenAIProvider extends AIProvider {
    private apiEndpoint: string;

    constructor(config: AIProviderConfig) {
        super(config);
        this.apiEndpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
    }

    async resolveConflict(request: ConflictResolutionRequest): Promise<ConflictResolutionResponse> {
        if (!this.config.apiKey) {
            throw new Error('OpenAI API key is required');
        }

        try {
            const prompt = this.buildPrompt(request);
            
            const response = await axios.post(
                this.apiEndpoint,
                {
                    model: this.config.model || 'gpt-4',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert developer helping to resolve merge conflicts. Always respond with valid JSON.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: this.config.temperature || 0.3,
                    max_tokens: this.config.maxTokens || 2048,
                    response_format: { type: 'json_object' }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.choices[0].message.content;
            let parsedResponse;
            
            try {
                parsedResponse = JSON.parse(content);
            } catch (parseError) {
                console.error('Failed to parse OpenAI response as JSON:', parseError);
                return {
                    resolution: content,
                    explanation: 'AI provided a resolution but response format was unexpected',
                    confidence: 0.6
                };
            }

            return {
                resolution: parsedResponse.resolution || content,
                explanation: parsedResponse.explanation || 'Resolution provided by OpenAI',
                confidence: parsedResponse.confidence || 0.85
            };
        } catch (error: any) {
            console.error('OpenAI provider error:', error.response?.data || error);
            throw new Error(`Failed to get resolution from OpenAI: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    async validateConfiguration(): Promise<boolean> {
        if (!this.config.apiKey) {
            console.error('OpenAI API key is not configured');
            return false;
        }

        try {
            // Test the API key with a minimal request
            const response = await axios.get(
                'https://api.openai.com/v1/models',
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`
                    }
                }
            );
            
            return response.status === 200;
        } catch (error: any) {
            console.error('Failed to validate OpenAI configuration:', error.response?.data || error);
            return false;
        }
    }

    async getModelList(): Promise<string[]> {
        // Return commonly used models
        // In production, you might want to fetch this from the API
        return [
            'gpt-4-turbo-preview',
            'gpt-4',
            'gpt-4-32k',
            'gpt-3.5-turbo',
            'gpt-3.5-turbo-16k'
        ];
    }
} 