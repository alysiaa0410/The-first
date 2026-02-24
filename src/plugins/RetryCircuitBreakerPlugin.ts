import {
  ChatPlugin,
  LLMRequest,
  LLMResponse,
  PluginContext,
  PluginErrorResult,
} from './types';

interface RetryCircuitBreakerOptions {
  maxRetries: number;
  backoffMs: number;
  errorThreshold: number;
  resetTimeoutMs: number;
}

interface CircuitState {
  failures: number;
  lastFailureTime: number;
  open: boolean;
}

export class RetryCircuitBreakerPlugin implements ChatPlugin {
  id = 'retry-circuit-breaker';
  description = '对 LLM 调用进行自动重试和熔断控制。';
  priority = 90;

  private readonly opts: RetryCircuitBreakerOptions;
  private readonly state: CircuitState = {
    failures: 0,
    lastFailureTime: 0,
    open: false,
  };

  constructor(opts?: Partial<RetryCircuitBreakerOptions>) {
    this.opts = {
      maxRetries: opts?.maxRetries ?? 2,
      backoffMs: opts?.backoffMs ?? 500,
      errorThreshold: opts?.errorThreshold ?? 5,
      resetTimeoutMs: opts?.resetTimeoutMs ?? 30_000,
    };
  }

  private isTransientError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('timeout')) return true;
      if (msg.includes('network')) return true;
      if (msg.includes('ecconnreset')) return true;
      if (msg.includes('econnrefused')) return true;
    }
    return false;
  }

  private recordFailure(context: PluginContext): void {
    const now = context.now().getTime();
    this.state.failures += 1;
    this.state.lastFailureTime = now;
    if (this.state.failures >= this.opts.errorThreshold) {
      this.state.open = true;
      context.log.warn('Circuit opened due to repeated failures', {
        failures: this.state.failures,
      });
    }
  }

  private maybeReset(context: PluginContext): void {
    if (!this.state.open) return;
    const now = context.now().getTime();
    if (now - this.state.lastFailureTime > this.opts.resetTimeoutMs) {
      context.log.info('Circuit half-open, allowing new requests');
      this.state.open = false;
      this.state.failures = 0;
    }
  }

  async onError(params: {
    context: PluginContext;
    error: unknown;
    request?: LLMRequest;
  }): Promise<PluginErrorResult | void> {
    const { context, error, request } = params;
    this.maybeReset(context);

    if (!request) {
      return { handled: false };
    }

    if (this.state.open) {
      context.log.warn('Circuit is open, short-circuiting request');
      const response: LLMResponse = {
        model: request.model,
        messages: [
          {
            role: 'assistant',
            content:
              '当前系统负载较高或服务不稳定，已暂时暂停调用大模型，请稍后再试。',
          },
        ],
      };
      return { handled: true, response };
    }

    if (!this.isTransientError(error)) {
      this.recordFailure(context);
      return { handled: false };
    }

    this.recordFailure(context);
    context.log.warn('Transient error detected, will rely on上层重试逻辑', {
      error,
    });

    return { handled: false };
  }
}

