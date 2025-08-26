export interface AIProviderConfig {
    apiKey?: string;
    model?: string;
    endpoint?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface ConflictResolutionRequest {
    currentContent: string;
    incomingContent: string;
    baseContent?: string;
    context: string;
    filePath: string;
    language?: string;
}

export interface ConflictResolutionResponse {
    resolution: string;
    explanation: string;
    confidence: number; // 0-1
    alternatives?: string[];
}

export abstract class AIProvider {
    protected config: AIProviderConfig;

    constructor(config: AIProviderConfig) {
        this.config = config;
    }

    abstract resolveConflict(request: ConflictResolutionRequest): Promise<ConflictResolutionResponse>;
    
    abstract validateConfiguration(): Promise<boolean>;
    
    abstract getModelList(): Promise<string[]>;

    protected buildPrompt(request: ConflictResolutionRequest): string {
        let prompt = `You are an expert developer helping to resolve a merge conflict in ${request.filePath}.

The conflict has occurred between the following versions:

CURRENT VERSION (HEAD):
\`\`\`
${request.currentContent}
\`\`\`

INCOMING VERSION:
\`\`\`
${request.incomingContent}
\`\`\`
`;

        if (request.baseContent) {
            prompt += `
BASE VERSION (common ancestor):
\`\`\`
${request.baseContent}
\`\`\`
`;
        }

        prompt += `
SURROUNDING CONTEXT:
${request.context}

Please analyze this merge conflict and provide:
1. A resolved version that correctly merges both changes
2. An explanation of your resolution strategy
3. Your confidence level (0-1) in this resolution

Consider:
- The intent of both changes
- Maintaining code functionality
- Preserving important logic from both versions
- Following the coding style and patterns in the file

Respond in JSON format:
{
    "resolution": "the merged code",
    "explanation": "why you resolved it this way",
    "confidence": 0.95
}`;

        return prompt;
    }
} 