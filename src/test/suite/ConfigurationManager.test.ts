import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigurationManager } from '../../services/ConfigurationManager';

suite('ConfigurationManager Test Suite', () => {
    let configManager: ConfigurationManager;
    let originalConfiguration: vscode.WorkspaceConfiguration;

    setup(() => {
        // Store original configuration
        originalConfiguration = vscode.workspace.getConfiguration('mergeai');
        configManager = new ConfigurationManager();
    });

    teardown(async () => {
        // Reset configuration to defaults
        const config = vscode.workspace.getConfiguration('mergeai');
        await config.update('provider', 'ollama', vscode.ConfigurationTarget.Global);
        await config.update('ollamaUrl', 'http://localhost:11434', vscode.ConfigurationTarget.Global);
        await config.update('ollamaModel', 'codellama', vscode.ConfigurationTarget.Global);
        await config.update('openaiModel', 'gpt-4', vscode.ConfigurationTarget.Global);
        await config.update('claudeModel', 'claude-3-opus-20240229', vscode.ConfigurationTarget.Global);
        await config.update('autoResolve', false, vscode.ConfigurationTarget.Global);
        await config.update('contextLines', 50, vscode.ConfigurationTarget.Global);
    });

    test('should return default provider type', () => {
        const provider = configManager.getProviderType();
        assert.strictEqual(provider, 'ollama');
    });

    test('should set and get provider type', () => {
        configManager.setProviderType('openai');
        const provider = configManager.getProviderType();
        assert.strictEqual(provider, 'openai');
    });

    test('should return default Ollama URL', () => {
        const url = configManager.getOllamaUrl();
        assert.strictEqual(url, 'http://localhost:11434');
    });

    test('should set and get Ollama URL', () => {
        const newUrl = 'http://localhost:8080';
        configManager.setOllamaUrl(newUrl);
        const url = configManager.getOllamaUrl();
        assert.strictEqual(url, newUrl);
    });

    test('should return default Ollama model', () => {
        const model = configManager.getOllamaModel();
        assert.strictEqual(model, 'codellama');
    });

    test('should set and get Ollama model', () => {
        const newModel = 'llama2';
        configManager.setOllamaModel(newModel);
        const model = configManager.getOllamaModel();
        assert.strictEqual(model, newModel);
    });

    test('should return default OpenAI model', () => {
        const model = configManager.getOpenAIModel();
        assert.strictEqual(model, 'gpt-4');
    });

    test('should set and get OpenAI model', () => {
        const newModel = 'gpt-3.5-turbo';
        configManager.setOpenAIModel(newModel);
        const model = configManager.getOpenAIModel();
        assert.strictEqual(model, newModel);
    });

    test('should return default Claude model', () => {
        const model = configManager.getClaudeModel();
        assert.strictEqual(model, 'claude-3-opus-20240229');
    });

    test('should set and get Claude model', () => {
        const newModel = 'claude-3-sonnet-20240229';
        configManager.setClaudeModel(newModel);
        const model = configManager.getClaudeModel();
        assert.strictEqual(model, newModel);
    });

    test('should return default auto-resolve setting', () => {
        const autoResolve = configManager.getAutoResolve();
        assert.strictEqual(autoResolve, false);
    });

    test('should set and get auto-resolve setting', () => {
        configManager.setAutoResolve(true);
        const autoResolve = configManager.getAutoResolve();
        assert.strictEqual(autoResolve, true);
    });

    test('should return default context lines', () => {
        const contextLines = configManager.getContextLines();
        assert.strictEqual(contextLines, 50);
    });

    test('should set and get context lines', () => {
        const newContextLines = 100;
        configManager.setContextLines(newContextLines);
        const contextLines = configManager.getContextLines();
        assert.strictEqual(contextLines, newContextLines);
    });

    test('should return all settings', () => {
        // Set some custom values
        configManager.setProviderType('claude');
        configManager.setAutoResolve(true);
        configManager.setContextLines(75);
        
        const settings = configManager.getAllSettings();
        
        assert.strictEqual(settings.provider, 'claude');
        assert.strictEqual(settings.autoResolve, true);
        assert.strictEqual(settings.contextLines, 75);
        assert.strictEqual(settings.ollamaUrl, 'http://localhost:11434');
        assert.strictEqual(settings.ollamaModel, 'codellama');
        assert.strictEqual(settings.openaiModel, 'gpt-4');
        assert.strictEqual(settings.claudeModel, 'claude-3-opus-20240229');
    });

    test('should handle configuration changes', async () => {
        // Directly update configuration to simulate external change
        const config = vscode.workspace.getConfiguration('mergeai');
        await config.update('provider', 'openai', vscode.ConfigurationTarget.Global);
        
        // Give some time for the change event to fire
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Create new manager to test if it picks up the change
        const newConfigManager = new ConfigurationManager();
        const provider = newConfigManager.getProviderType();
        assert.strictEqual(provider, 'openai');
    });
}); 