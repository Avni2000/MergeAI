import * as vscode from 'vscode';
import { ProviderType } from '../providers/AIProviderManager';

export class ConfigurationManager {
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.config = vscode.workspace.getConfiguration('mergeai');
        
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('mergeai')) {
                this.config = vscode.workspace.getConfiguration('mergeai');
            }
        });
    }

    getProviderType(): ProviderType {
        return this.config.get<ProviderType>('provider', 'ollama');
    }

    setProviderType(provider: ProviderType): void {
        this.config.update('provider', provider, vscode.ConfigurationTarget.Global);
    }

    getOllamaUrl(): string {
        return this.config.get<string>('ollamaUrl', 'http://localhost:11434');
    }

    setOllamaUrl(url: string): void {
        this.config.update('ollamaUrl', url, vscode.ConfigurationTarget.Global);
    }

    getOllamaModel(): string {
        return this.config.get<string>('ollamaModel', 'codellama');
    }

    setOllamaModel(model: string): void {
        this.config.update('ollamaModel', model, vscode.ConfigurationTarget.Global);
    }

    getOpenAIModel(): string {
        return this.config.get<string>('openaiModel', 'gpt-4');
    }

    setOpenAIModel(model: string): void {
        this.config.update('openaiModel', model, vscode.ConfigurationTarget.Global);
    }

    getClaudeModel(): string {
        return this.config.get<string>('claudeModel', 'claude-3-opus-20240229');
    }

    setClaudeModel(model: string): void {
        this.config.update('claudeModel', model, vscode.ConfigurationTarget.Global);
    }

    getAutoResolve(): boolean {
        return this.config.get<boolean>('autoResolve', false);
    }

    setAutoResolve(value: boolean): void {
        this.config.update('autoResolve', value, vscode.ConfigurationTarget.Global);
    }

    getContextLines(): number {
        return this.config.get<number>('contextLines', 50);
    }

    setContextLines(lines: number): void {
        this.config.update('contextLines', lines, vscode.ConfigurationTarget.Global);
    }

    getAllSettings(): Record<string, any> {
        return {
            provider: this.getProviderType(),
            ollamaUrl: this.getOllamaUrl(),
            ollamaModel: this.getOllamaModel(),
            openaiModel: this.getOpenAIModel(),
            claudeModel: this.getClaudeModel(),
            autoResolve: this.getAutoResolve(),
            contextLines: this.getContextLines()
        };
    }
} 