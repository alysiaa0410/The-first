import {
  ChatMessage,
  ChatPlugin,
  LLMRequest,
  LLMResponse,
  PluginContext,
  PluginHookResult,
} from './types';

interface ContentFilterOptions {
  blockedKeywords: string[];
}

export class ContentFilterPlugin implements ChatPlugin {
  id = 'content-filter';
  description = '对用户输入与模型输出进行敏感内容粗略过滤。';
  priority = 95;

  private readonly opts: ContentFilterOptions;

  constructor(opts?: Partial<ContentFilterOptions>) {
    this.opts = {
      blockedKeywords: opts?.blockedKeywords ?? ['违法', '恐怖', '爆炸物'],
    };
  }

  private containsBlocked(text: string): string | undefined {
    for (const kw of this.opts.blockedKeywords) {
      if (text.includes(kw)) return kw;
    }
    return undefined;
  }

  async onMessage(params: {
    context: PluginContext;
    message: ChatMessage;
    history: ChatMessage[];
  }): Promise<{ message?: ChatMessage; stopPropagation?: boolean } | void> {
    const { context, message } = params;
    if (message.role !== 'user') return;
    const hit = this.containsBlocked(message.content);
    if (!hit) return;
    context.log.warn('Blocked user input keyword', { keyword: hit });
    return {
      message: {
        role: 'assistant',
        content:
          '你的请求中包含敏感或受限制的内容，出于安全与合规考虑，我无法按该方向继续回答。如果有其他合法合规的问题，我很乐意帮你。',
      },
      stopPropagation: true,
    };
  }

  async onAfterLLM(params: {
    context: PluginContext;
    request: LLMRequest;
    response: LLMResponse;
  }): Promise<PluginHookResult | void> {
    const { context, response } = params;
    const last = [...response.messages].reverse()[0];
    if (!last) return;
    const hit = this.containsBlocked(last.content);
    if (!hit) return;
    context.log.warn('Blocked model output keyword', { keyword: hit });
    const safe: ChatMessage = {
      role: 'assistant',
      content:
        '生成的回答中包含敏感内容，已被自动拦截。我可以改为提供相关的安全科普或一般性说明，如果你有这方面的需要可以具体说明。',
    };
    return {
      response: {
        ...response,
        messages: [safe],
      },
      stopPropagation: true,
    };
  }
}

