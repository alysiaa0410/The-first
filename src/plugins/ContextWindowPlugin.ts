import {
  ChatMessage,
  ChatPlugin,
  LLMRequest,
  PluginContext,
  PluginHookResult,
} from './types';

interface ContextWindowOptions {
  maxChars: number;
}

export class ContextWindowPlugin implements ChatPlugin {
  id = 'context-window-manager';
  description = '控制上下文长度，避免超过模型窗口限制（基于字符数的粗略管理）。';
  priority = 70;

  private readonly opts: ContextWindowOptions;

  constructor(opts?: Partial<ContextWindowOptions>) {
    this.opts = {
      maxChars: opts?.maxChars ?? 16_000,
    };
  }

  private truncateMessages(messages: ChatMessage[]): ChatMessage[] {
    let total = 0;
    const kept: ChatMessage[] = [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      const len = msg.content.length;
      if (total + len > this.opts.maxChars) {
        // 给出一个简短摘要提示（真正摘要可以交给模型来做，这里先简单处理）
        kept.unshift({
          role: 'system',
          content:
            '上面的部分对话因为长度限制被折叠为摘要：用户之前与助手有多轮交互，请在回答时注意延续上下文语气即可。',
        });
        break;
      }
      kept.unshift(msg);
      total += len;
    }
    return kept;
  }

  async onBeforeLLM(params: {
    context: PluginContext;
    request: LLMRequest;
  }): Promise<PluginHookResult | void> {
    const { context, request } = params;
    const totalChars = request.messages.reduce(
      (sum, m) => sum + m.content.length,
      0,
    );
    if (totalChars <= this.opts.maxChars) {
      return;
    }
    const truncated = this.truncateMessages(request.messages);
    context.log.info('Context truncated due to length limit', {
      beforeChars: totalChars,
      afterChars: truncated.reduce((s, m) => s + m.content.length, 0),
    });
    return {
      request: {
        ...request,
        messages: truncated,
      },
    };
  }
}

