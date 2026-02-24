export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: Role;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface LLMRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  model: string;
  messages: ChatMessage[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  raw?: unknown;
}

export interface PluginContext {
  /** 唯一请求 ID，用于日志/追踪 */
  traceId: string;
  /** 当前用户 ID（如果有） */
  userId?: string;
  /** 会话 ID（多轮对话用） */
  sessionId?: string;
  /** 任意扩展字段 */
  meta?: Record<string, unknown>;

  /** 记录日志 */
  log: {
    debug: (msg: string, extra?: Record<string, unknown>) => void;
    info: (msg: string, extra?: Record<string, unknown>) => void;
    warn: (msg: string, extra?: Record<string, unknown>) => void;
    error: (msg: string, extra?: Record<string, unknown>) => void;
  };

  /** 当前时间（方便测试时注入） */
  now: () => Date;
}

export type PluginPriority = number;

export interface PluginHookResult {
  /** 修改后的请求（消息、模型配置等） */
  request?: LLMRequest;
  /** 如果直接给出响应，则后续不再调用模型 */
  response?: LLMResponse;
  /** 是否中断后续插件与模型调用 */
  stopPropagation?: boolean;
}

export interface PluginErrorResult {
  /** 是否拦截这个错误，给出自己的 response */
  handled: boolean;
  response?: LLMResponse;
}

export interface ChatPlugin {
  /** 插件唯一 ID */
  id: string;
  /** 简短描述 */
  description: string;
  /** 数字越大，优先级越高（默认 0） */
  priority?: PluginPriority;

  /** 新消息进入时（还未组装成 LLMRequest 前） */
  onMessage?(params: {
    context: PluginContext;
    message: ChatMessage;
    history: ChatMessage[];
  }): Promise<{ message?: ChatMessage; stopPropagation?: boolean } | void>;

  /** 调用模型前（已组装好 LLMRequest） */
  onBeforeLLM?(params: {
    context: PluginContext;
    request: LLMRequest;
  }): Promise<PluginHookResult | void>;

  /** 调用模型后 */
  onAfterLLM?(params: {
    context: PluginContext;
    request: LLMRequest;
    response: LLMResponse;
  }): Promise<PluginHookResult | void>;

  /** 整个流程中有错误时 */
  onError?(params: {
    context: PluginContext;
    error: unknown;
    request?: LLMRequest;
  }): Promise<PluginErrorResult | void>;
}

