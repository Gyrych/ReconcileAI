# n8n in VS Code

将 n8n 的 Web 界面无缝集成到 VS Code 中。支持两种模式：

- 外部模式（external）：指向你已有的 n8n 实例
- 托管模式（managed）：由扩展自动在本机启动 n8n 并打开

扩展内置本地反向代理，可移除目标返回的 `X-Frame-Options` 与 `Content-Security-Policy` 的 `frame-ancestors`，从而允许在 Webview `<iframe>` 中正常嵌入。

## 功能

- 在 VS Code 面板内直接使用 n8n 工作流编辑器
- 一键启动本地托管 n8n（可选），健康检查与自动打开
- 内置反向代理（可开关），自动移除阻塞嵌入的响应头
- 可配置目标地址、代理端口与托管二进制路径

## 安装与运行

1. 在 VS Code 中打开本项目文件夹
2. 安装依赖并构建：
   ```bash
   npm install
   npm run build
   ```
3. 按 F5 启动“Extension Development Host”调试窗口
4. 在命令面板（Ctrl+Shift+P）执行：
   - `n8n: 打开界面`（使用配置的目标地址，默认 http://127.0.0.1:5678）
   - `n8n: 启动本地托管实例并打开`（自动启动 n8n，再打开）

## 配置项（Settings）

可在 VS Code 设置中搜索“n8n Integration”进行修改：

- `vscode-n8n.targetUrl`：外部 n8n 实例地址，默认 `http://127.0.0.1:5678`
- `vscode-n8n.proxy.enable`：是否启用内置反向代理（默认启用）
- `vscode-n8n.proxy.port`：反向代理监听端口（默认 `5799`）
- `vscode-n8n.managed.enable`：是否启用托管模式（默认关闭）。注：命令中也可直接使用托管启动，无需开启此项
- `vscode-n8n.managed.binary`：n8n 可执行文件路径或名称（默认 `n8n`，需在 PATH 中可用）
- `vscode-n8n.managed.env`：为托管 n8n 进程传递的环境变量字典（如自定义端口、认证配置等）

托管模式默认使用以下环境变量（若未指定）：

- `N8N_HOST=127.0.0.1`
- `N8N_PORT=5678`

## 工作方式

- Webview 使用严格的 CSP，仅允许指定的 frame-src 与必要资源
- 代理会删除响应头中的 `x-frame-options` 与 CSP 的 `frame-ancestors` 以允许被嵌入
- 对可能的 WebSocket 连接进行转发（`ws: true`）

## 常见问题

- 无法登录或会话丢失：
  - 建议使用托管模式（同源、本地地址），第三方 Cookie 受限风险低
  - 远程实例可通过自建同源反向代理并配置 HTTPS、SameSite/ Secure 属性
- 页面空白或被阻止加载：
  - 确认已启用内置代理，或目标后端已放宽 `X-Frame-Options`/`frame-ancestors`
  - 查看 VS Code “开发者工具”中的 Console/Network 以定位具体错误
- 端口被占用：
  - 修改 `vscode-n8n.proxy.port` 或 `N8N_PORT`

## 开发

- 构建：`npm run build`
- 监听：`npm run watch`
- 打包（可选）：`npm run package`

项目结构：

- `src/extension.ts`：扩展入口，Webview、代理与托管流程
- `docs/FEASIBILITY.md`：可行性研究报告

## 许可证

MIT

