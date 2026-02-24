import {
  ChatMessage,
  ChatPlugin,
  LLMRequest,
  PluginContext,
  PluginHookResult,
} from './types';

interface MemoryItem {
  text: string;
  createdAt: number;
}

type MemoryStore = Map<string, MemoryItem[]>;

export class PersonalMemoryPlugin implements ChatPlugin {
  id = 'personal-memory';
  description =
    '为每个用户维护简单的“长期记忆”（如自我介绍、偏好），并在回答前注入到上下文。';
  priority = 75;

  private readonly store: MemoryStore = new Map();
  private readonly maxItemsPerUser = 50;

  private getKey(context: PluginContext): string | undefined {
    return context.userId ?? context.sessionId;
  }

  private pushMemory(key: string, text: string, now: number): void {
    const list = this.store.get(key) ?? [];
    list.push({ text, createdAt: now });
    if (list.length > this.maxItemsPerUser) {
      list.splice(0, list.length - this.maxItemsPerUser);
    }
    this.store.set(key, list);
  }

  private extractMemoryCandidate(text: string): string | undefined {
    const trimmed = text.trim();
    // 非常简单的启发式：包含“我叫/我的名字/我是/我来自/我喜欢”等中文表达
    const patterns = ['我叫', '我的名字是', '我是', '我来自', '我喜欢', '我不喜欢'];
    if (patterns.some((p) => trimmed.includes(p))) {
      return trimmed;
    }
    return undefined;
  }

  async onMessage(params: {
    context: PluginContext;
    message: ChatMessage;
    history: ChatMessage[];
  }): Promise<void> {
    const { context, message } = params;
    if (message.role !== 'user') return;
    const key = this.getKey(context);
    if (!key) return;

    const candidate = this.extractMemoryCandidate(message.content);
    if (!candidate) return;

    this.pushMemory(key, candidate, context.now().getTime());
    context.log.info('Captured personal memory for user', { key, text: candidate });
  }

  async onBeforeLLM(params: {
    context: PluginContext;
    request: LLMRequest;
  }): Promise<PluginHookResult | void> {
    const { context, request } = params;
    const key = this.getKey(context);
    if (!key) return;
    const list = this.store.get(key);
    if (!list || list.length === 0) return;

    const recent = list.slice(-5); // 只取最近几条
    const summaryLines = recent.map((m) => `- ${m.text}`);
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `以下是用户曾经透露的与自身相关的重要信息，请在回答时尽量利用但避免重复啰嗦：\n${summaryLines.join(
        '\n',
      )}`,
    };

    return {
      request: {
        ...request,
        messages: [systemMessage, ...request.messages],
      },
    };
  }
}

