import {
  ChatMessage,
  ChatPlugin,
  LLMRequest,
  PluginContext,
  PluginHookResult,
} from './types';

interface ModelRouterRule {
  name: string;
  match: (messages: ChatMessage[]) => boolean;
  targetModel: string;
}

export class ModelRouterPlugin implements ChatPlugin {
  id = 'model-router';
  description = '根据请求内容在不同模型之间做简单路由。';
  priority = 85;

  private readonly defaultModel: string;
  private readonly rules: ModelRouterRule[];

  constructor(options: { defaultModel: string; rules?: ModelRouterRule[] }) {
    this.defaultModel = options.defaultModel;
    this.rules =
      options.rules ??
      [
        {
          name: 'code-heavy',
          match: (messages) => {
            const text = messages.map((m) => m.content).join('\n');
            return /```|class |function |def |SELECT |INSERT |UPDATE /i.test(
              text,
            );
          },
          targetModel: 'gpt-code-strong',
        },
        {
          name: 'short-chitchat',
          match: (messages) => {
            const last = [...messages].reverse()[0];
            if (!last) return false;
            return last.content.length < 60;
          },
          targetModel: 'gpt-small-chat',
        },
      ];
  }

  async onBeforeLLM(params: {
    context: PluginContext;
    request: LLMRequest;
  }): Promise<PluginHookResult | void> {
    const { context, request } = params;
    const messages = request.messages;

    for (const rule of this.rules) {
      if (rule.match(messages)) {
        const target = rule.targetModel;
        context.log.info('ModelRouter matched rule', {
          rule: rule.name,
          from: request.model,
          to: target,
        });
        return {
          request: { ...request, model: target },
        };
      }
    }

    if (request.model !== this.defaultModel) {
      context.log.debug('ModelRouter set default model', {
        from: request.model,
        to: this.defaultModel,
      });
      return {
        request: { ...request, model: this.defaultModel },
      };
    }

    return;
  }
}

