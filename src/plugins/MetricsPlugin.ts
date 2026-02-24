import {
  ChatMessage,
  ChatPlugin,
  LLMRequest,
  LLMResponse,
  PluginContext,
} from './types';

export interface MetricsSnapshot {
  totalRequests: number;
  totalResponses: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  estimatedTokens: number;
}

export class MetricsPlugin implements ChatPlugin {
  id = 'metrics';
  description = '统计调用次数与 token（粗略估算），方便后续做可视化或埋点上报。';
  priority = 5;

  private totalRequests = 0;
  private totalResponses = 0;
  private totalPromptTokens = 0;
  private totalCompletionTokens = 0;

  getSnapshot(): MetricsSnapshot {
    const estimatedTokens =
      this.totalPromptTokens + this.totalCompletionTokens;
    return {
      totalRequests: this.totalRequests,
      totalResponses: this.totalResponses,
      totalPromptTokens: this.totalPromptTokens,
      totalCompletionTokens: this.totalCompletionTokens,
      estimatedTokens,
    };
  }

  private estimateTokens(messages: ChatMessage[]): number {
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  async onBeforeLLM(params: {
    context: PluginContext;
    request: LLMRequest;
  }): Promise<void> {
    this.totalRequests += 1;
    const estimate = this.estimateTokens(params.request.messages);
    this.totalPromptTokens += estimate;
  }

  async onAfterLLM(params: {
    context: PluginContext;
    request: LLMRequest;
    response: LLMResponse;
  }): Promise<void> {
    this.totalResponses += 1;
    if (params.response.usage) {
      this.totalPromptTokens += params.response.usage.promptTokens;
      this.totalCompletionTokens += params.response.usage.completionTokens;
    } else {
      const estimate = this.estimateTokens(params.response.messages);
      this.totalCompletionTokens += estimate;
    }
  }
}

