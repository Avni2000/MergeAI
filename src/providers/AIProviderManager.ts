import * as vscode from 'vscode';
import { AIProvider, AIProviderConfig } from './AIProvider';
import { OllamaProvider } from './OllamaProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { ClaudeProvider } from './ClaudeProvider';
import { ConfigurationManager } from '../services/ConfigurationManager';

export type ProviderType = 'ollama' | 'openai' | 'claude';

export class AIProviderManager {
    private currentProvider: AIProvider | null = null;
    private context: vscode.ExtensionContext;
    private configManager: ConfigurationManager;

    constructor(context: vscode.ExtensionContext, configManager: ConfigurationManager) {
        this.context = context;
        this.configManager = configManager;
        this.initializeProvider();
    }

    private async initializeProvider() {
        const providerType = this.configManager.getProviderType();
        await this.switchProvider(providerType);
    }

    async switchProvider(type: ProviderType): Promise<void> {
        const config = await this.getProviderConfig(type);
        
        switch (type) {
            case 'ollama':
                this.currentProvider = new OllamaProvider(config);
                break;
            case 'openai':
                this.currentProvider = new OpenAIProvider(config);
                break;
            case 'claude':
                this.currentProvider = new ClaudeProvider(config);
                break;
            default:
                throw new Error(`Unknown provider type: ${type}`);
        }

        // Validate the configuration
        const isValid = await this.currentProvider.validateConfiguration();
        if (!isValid) {
            vscode.window.showWarningMessage(`${type} provider configuration is invalid. Please check your settings.`);
        }
    }

    async getProviderConfig(type: ProviderType): Promise<AIProviderConfig> {
        const config: AIProviderConfig = {};

        switch (type) {
            case 'ollama':
                config.endpoint = this.configManager.getOllamaUrl();
                config.model = this.configManager.getOllamaModel();
                break;
            
            case 'openai':
                config.apiKey = await this.getApiKey('openai');
                config.model = this.configManager.getOpenAIModel();
                break;
            
            case 'claude':
                config.apiKey = await this.getApiKey('claude');
                config.model = this.configManager.getClaudeModel();
                break;
        }

        config.temperature = 0.3;
        config.maxTokens = 2048;

        return config;
    }

    private async getApiKey(provider: 'openai' | 'claude'): Promise<string | undefined> {
        const secretKey = `mergeai.${provider}.apiKey`;
        
        // Try to get from secret storage first
        let apiKey = await this.context.secrets.get(secretKey);
        
        if (!apiKey) {
            // Prompt user for API key
            apiKey = await vscode.window.showInputBox({
                prompt: `Enter your ${provider.toUpperCase()} API key`,
                password: true,
                placeHolder: 'sk-...'
            });
            
            if (apiKey) {
                // Store in secret storage
                await this.context.secrets.store(secretKey, apiKey);
            }
        }
        
        return apiKey;
    }

    async updateApiKey(provider: 'openai' | 'claude', apiKey: string): Promise<void> {
        const secretKey = `mergeai.${provider}.apiKey`;
        await this.context.secrets.store(secretKey, apiKey);
        
        // Reinitialize provider if it's the current one
        const currentType = this.configManager.getProviderType();
        if (currentType === provider) {
            await this.switchProvider(currentType);
        }
    }

    async clearApiKey(provider: 'openai' | 'claude'): Promise<void> {
        const secretKey = `mergeai.${provider}.apiKey`;
        await this.context.secrets.delete(secretKey);
    }

    getProvider(): AIProvider {
        if (!this.currentProvider) {
            throw new Error('No AI provider is configured');
        }
        return this.currentProvider;
    }

    async validateCurrentProvider(): Promise<boolean> {
        if (!this.currentProvider) {
            return false;
        }
        return await this.currentProvider.validateConfiguration();
    }

    async getAvailableModels(): Promise<string[]> {
        if (!this.currentProvider) {
            return [];
        }
        return await this.currentProvider.getModelList();
    }
} 