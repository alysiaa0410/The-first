import {
  ChatMessage,
  ChatPlugin,
  LLMRequest,
  LLMResponse,
  PluginContext,
} from './types';

export type LLMCaller = (request: LLMRequest) => Promise<LLMResponse>;

export class PluginManager {
  private plugins: ChatPlugin[] = [];

  register(plugin: ChatPlugin): void {
    this.plugins.push(plugin);
    this.plugins.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  getRegisteredPlugins(): ChatPlugin[] {
    return [...this.plugins];
  }

  async handleMessage(params: {
    context: PluginContext;
    incoming: ChatMessage;
    history: ChatMessage[];
    baseRequest: Omit<LLMRequest, 'messages'>;
    callLLM: LLMCaller;
  }): Promise<LLMResponse> {
    const { context, incoming, history, baseRequest, callLLM } = params;

    let currentMessage: ChatMessage = incoming;
    const currentHistory: ChatMessage[] = [...history];

    // 1) onMessage 链
    for (const plugin of this.plugins) {
      if (!plugin.onMessage) continue;
      const result = await plugin.onMessage({
        context,
        message: currentMessage,
        history: currentHistory,
      });
      if (result?.message) {
        currentMessage = result.message;
      }
      if (result?.stopPropagation) {
        break;
      }
    }

    // 把当前消息加入历史
    currentHistory.push(currentMessage);

    let request: LLMRequest = {
      ...baseRequest,
      messages: currentHistory,
    };

    // 2) onBeforeLLM 链
    for (const plugin of this.plugins) {
      if (!plugin.onBeforeLLM) continue;
      const result = await plugin.onBeforeLLM({ context, request });
      if (!result) continue;
      if (result.request) {
        request = result.request;
      }
      if (result.response) {
        // 被插件短路，直接返回
        return result.response;
      }
      if (result.stopPropagation) {
        break;
      }
    }

    let response: LLMResponse;
    try {
      response = await callLLM(request);
    } catch (error) {
      // onError 链
      for (const plugin of this.plugins) {
        if (!plugin.onError) continue;
        const result = await plugin.onError({ context, error, request });
        if (result?.handled && result.response) {
          return result.response;
        }
      }
      throw error;
    }

    // 3) onAfterLLM 链
    for (const plugin of this.plugins) {
      if (!plugin.onAfterLLM) continue;
      const result = await plugin.onAfterLLM({ context, request, response });
      if (!result) continue;
      if (result.response) {
        response = result.response;
      }
      if (result.stopPropagation) {
        break;
      }
    }

    return response;
  }
}

