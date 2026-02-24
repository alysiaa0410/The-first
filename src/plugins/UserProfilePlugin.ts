import {
  ChatMessage,
  ChatPlugin,
  LLMRequest,
  PluginContext,
  PluginHookResult,
} from './types';

interface UserProfile {
  userId: string;
  totalMessages: number;
  avgQuestionLength: number;
  lastActiveAt: number;
}

export class UserProfilePlugin implements ChatPlugin {
  id = 'user-profile';
  description = '基于历史交互维护简单用户画像，并通过 system prompt 影响回答风格。';
  priority = 65;

  private readonly profiles: Map<string, UserProfile> = new Map();

  private getKey(context: PluginContext): string | undefined {
    return context.userId ?? context.sessionId;
  }

  private getOrCreateProfile(context: PluginContext): UserProfile | undefined {
    const key = this.getKey(context);
    if (!key) return undefined;
    let p = this.profiles.get(key);
    if (!p) {
      p = {
        userId: key,
        totalMessages: 0,
        avgQuestionLength: 0,
        lastActiveAt: context.now().getTime(),
      };
      this.profiles.set(key, p);
    }
    return p;
  }

  async onMessage(params: {
    context: PluginContext;
    message: ChatMessage;
    history: ChatMessage[];
  }): Promise<void> {
    const { context, message } = params;
    if (message.role !== 'user') return;
    const profile = this.getOrCreateProfile(context);
    if (!profile) return;

    const len = message.content.length;
    const totalBefore = profile.totalMessages;
    profile.totalMessages += 1;
    profile.avgQuestionLength =
      (profile.avgQuestionLength * totalBefore + len) / profile.totalMessages;
    profile.lastActiveAt = context.now().getTime();
  }

  async onBeforeLLM(params: {
    context: PluginContext;
    request: LLMRequest;
  }): Promise<PluginHookResult | void> {
    const { context, request } = params;
    const profile = this.getOrCreateProfile(context);
    if (!profile) return;

    let styleHint: string;
    if (profile.avgQuestionLength < 40) {
      styleHint =
        '用户提问通常比较简短，请优先给出简洁扼要、直奔主题的回答，可用列表快速列出要点。';
    } else if (profile.avgQuestionLength > 120) {
      styleHint =
        '用户提问通常较长且详细，请给出分步骤、结构化、相对详细的回答。';
    } else {
      styleHint =
        '用户提问长度中等，请在保证清晰的前提下，兼顾条理性与简洁性。';
    }

    const systemMessage: ChatMessage = {
      role: 'system',
      content: `基于用户历史行为的风格偏好：${styleHint}`,
    };

    return {
      request: {
        ...request,
        messages: [systemMessage, ...request.messages],
      },
    };
  }
}

