import {
  ChatMessage,
  ChatPlugin,
  LLMRequest,
  PluginContext,
  PluginHookResult,
} from './types';

declare module './types' {
  interface PluginContext {
    preferredLanguage?: string;
  }
}

export class LanguageDetectPlugin implements ChatPlugin {
  id = 'language-detect';
  description = '简单语言检测与语言偏好标记。';
  priority = 60;

  private detectLanguage(text: string): 'zh' | 'en' | 'other' {
    const chineseChar = /[\u4e00-\u9fff]/;
    const hasChinese = chineseChar.test(text);
    if (hasChinese) return 'zh';
    const asciiLetter = /[a-zA-Z]/;
    if (asciiLetter.test(text)) return 'en';
    return 'other';
  }

  async onMessage(params: {
    context: PluginContext;
    message: ChatMessage;
    history: ChatMessage[];
  }): Promise<void> {
    const { context, message } = params;
    if (message.role !== 'user') return;
    const lang = this.detectLanguage(message.content);
    if (lang === 'other') return;
    (context as any).preferredLanguage = lang;
  }

  async onBeforeLLM(params: {
    context: PluginContext;
    request: LLMRequest;
  }): Promise<PluginHookResult | void> {
    const { context, request } = params;
    const lang = (context as any).preferredLanguage;
    if (!lang) return;

    const prefix =
      lang === 'zh'
        ? '请使用简体中文回答用户的问题。'
        : 'Please answer the user in English.';

    const systemMessage: ChatMessage = {
      role: 'system',
      content: prefix,
    };

    return {
      request: {
        ...request,
        messages: [systemMessage, ...request.messages],
      },
    };
  }
}

