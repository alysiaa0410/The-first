import { ChatMessage, ChatPlugin, LLMRequest, LLMResponse, PluginContext } from './types';

export class LoggingPlugin implements ChatPlugin {
  id = 'logging';
  description = '对关键生命周期事件打印结构化日志，便于调试与排障。';
  priority = 10;

  async onMessage(params: {
    context: PluginContext;
    message: ChatMessage;
    history: ChatMessage[];
  }): Promise<void> {
    const { context, message } = params;
    context.log.info('Incoming message', {
      userId: context.userId,
      sessionId: context.sessionId,
      role: message.role,
      preview: message.content.slice(0, 80),
    });
  }

  async onBeforeLLM(params: {
    context: PluginContext;
    request: LLMRequest;
  }): Promise<void> {
    const { context, request } = params;
    context.log.debug('Before LLM call', {
      model: request.model,
      messages: request.messages.length,
    });
  }

  async onAfterLLM(params: {
    context: PluginContext;
    request: LLMRequest;
    response: LLMResponse;
  }): Promise<void> {
    const { context, response } = params;
    const last = [...response.messages].reverse()[0];
    context.log.debug('After LLM call', {
      model: response.model,
      lastPreview: last?.content.slice(0, 80),
      usage: response.usage,
    });
  }
}

