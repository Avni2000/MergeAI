import axios from 'axios';
import { AIProvider, AIProviderConfig, ConflictResolutionRequest, ConflictResolutionResponse } from './AIProvider';

export class ClaudeProvider extends AIProvider {
    private apiEndpoint: string;

    constructor(config: AIProviderConfig) {
        super(config);
        this.apiEndpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';
    }

    async resolveConflict(request: ConflictResolutionRequest): Promise<ConflictResolutionResponse> {
        if (!this.config.apiKey) {
            throw new Error('Claude API key is required');
        }

        try {
            const prompt = this.buildPrompt(request);
            
            const response = await axios.post(
                this.apiEndpoint,
                {
                    model: this.config.model || 'claude-3-opus-20240229',
                    max_tokens: this.config.maxTokens || 2048,
                    temperature: this.config.temperature || 0.3,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    system: 'You are an expert developer helping to resolve merge conflicts. Always respond with valid JSON format.'
                },
                {
                    headers: {
                        'x-api-key': this.config.apiKey,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.content[0].text;
            let parsedResponse;
            
            try {
                parsedResponse = JSON.parse(content);
            } catch (parseError) {
                console.error('Failed to parse Claude response as JSON:', parseError);
                return {
                    resolution: content,
                    explanation: 'AI provided a resolution but response format was unexpected',
                    confidence: 0.6
                };
            }

            return {
                resolution: parsedResponse.resolution || content,
                explanation: parsedResponse.explanation || 'Resolution provided by Claude',
                confidence: parsedResponse.confidence || 0.85
            };
        } catch (error: any) {
            console.error('Claude provider error:', error.response?.data || error);
            throw new Error(`Failed to get resolution from Claude: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    async validateConfiguration(): Promise<boolean> {
        if (!this.config.apiKey) {
            console.error('Claude API key is not configured');
            return false;
        }

        try {
            // Test the API key with a minimal request
            const response = await axios.post(
                this.apiEndpoint,
                {
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 10,
                    messages: [
                        {
                            role: 'user',
                            content: 'Hi'
                        }
                    ]
                },
                {
                    headers: {
                        'x-api-key': this.config.apiKey,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            return response.status === 200;
        } catch (error: any) {
            console.error('Failed to validate Claude configuration:', error.response?.data || error);
            return false;
        }
    }

    async getModelList(): Promise<string[]> {
        // Return available Claude models
        return [
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
            'claude-2.1',
            'claude-2.0'
        ];
    }
} 