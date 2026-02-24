## Neo-Mofox Bot Plugins

这是一个为聊天型 Bot 设计的 **TypeScript 插件框架 + 常用插件集合**，同时预留了 Python 方向的扩展位，方便你在自己的仓库中直接使用或二次开发。

### 功能概览

- **通用插件框架**：统一的 `ChatPlugin` 接口和 `PluginManager` 管理器。
- **稳定性与性能**
  - `RateLimiterPlugin`：按用户/会话限流。
  - `RetryCircuitBreakerPlugin`：错误统计与熔断（可在外层结合重试逻辑）。
  - `CachePlugin`：响应缓存，命中则直接返回。
  - `ContextWindowPlugin`：基于字符数粗略控制上下文窗口。
- **安全与合规**
  - `ContentFilterPlugin`：输入/输出敏感词粗过滤。
- **观测性**
  - `LoggingPlugin`：结构化生命周期日志。
- **智能增强**
  - `ModelRouterPlugin`：根据内容（如是否含代码）路由到不同模型。
  - `LanguageDetectPlugin`：简单语言检测，并在 system prompt 中指定中/英文回答。

> 你可以直接把这个项目初始化为 git 仓库，推到 GitHub，然后根据自己的 Neo-Mofox Bot 主程序进行集成。

### 目录结构

```text
.
├─ package.json
├─ tsconfig.json
├─ README.md
└─ src
   ├─ index.ts
   ├─ example.ts
   └─ plugins
      ├─ types.ts
      ├─ PluginManager.ts
      ├─ RateLimiterPlugin.ts
      ├─ RetryCircuitBreakerPlugin.ts
      ├─ CachePlugin.ts
      ├─ ContextWindowPlugin.ts
      ├─ ContentFilterPlugin.ts
      ├─ LoggingPlugin.ts
      ├─ ModelRouterPlugin.ts
      └─ LanguageDetectPlugin.ts
```

### 安装依赖 & 构建

```bash
cd g:\Cursor-Workerspace
npm install
npm run build
```

运行示例（使用伪造 LLM 调用）：

```bash
npm start
```

你会在控制台看到结构化日志和一条模拟回复。

### 在你的 Bot 中使用

在你的主项目中，你可以按以下方式集成（示例伪代码）：

```ts
import {
  PluginManager,
  RateLimiterPlugin,
  RetryCircuitBreakerPlugin,
  CachePlugin,
  ContextWindowPlugin,
  ContentFilterPlugin,
  LoggingPlugin,
  ModelRouterPlugin,
  LanguageDetectPlugin,
} from 'neo-mofox-bot-plugins'; // 或者本地相对路径
```

然后在请求进来时，组装 `PluginContext`、`ChatMessage` 列表，以及你自己的 `callLLM` 函数，调用 `PluginManager.handleMessage` 即可。

### 推送到 GitHub 的步骤（Windows PowerShell）

```bash
cd g:\Cursor-Workerspace
git init
git add .
git commit -m "init neo-mofox bot plugins"
git branch -M main
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
```

完成以上步骤后，你就拥有了一个可以直接复用和继续扩展的插件仓库。

