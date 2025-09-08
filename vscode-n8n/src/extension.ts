import * as vscode from 'vscode';
import * as http from 'http';
import * as httpProxy from 'http-proxy';
import { spawn, ChildProcess } from 'child_process';

type Maybe<T> = T | undefined;

interface ManagedProcessState {
  process: Maybe<ChildProcess>;
  baseUrl: string;
  ready: boolean;
}

let proxyServer: Maybe<http.Server>;
let proxyTargetUrl: string = 'http://127.0.0.1:5678';
let managedState: ManagedProcessState = { process: undefined, baseUrl: 'http://127.0.0.1:5678', ready: false };

export function activate(context: vscode.ExtensionContext) {
  const openDisposable = vscode.commands.registerCommand('vscode-n8n.open', async () => {
    const config = vscode.workspace.getConfiguration();
    const enableProxy = config.get<boolean>('vscode-n8n.proxy.enable', true);
    const proxyPort = config.get<number>('vscode-n8n.proxy.port', 5799);
    const targetUrl = config.get<string>('vscode-n8n.targetUrl', 'http://127.0.0.1:5678');

    proxyTargetUrl = targetUrl;

    if (enableProxy) {
      await ensureProxyStarted(proxyPort, targetUrl);
    }

    const useUrl = enableProxy ? `http://127.0.0.1:${proxyPort}` : targetUrl;
    openWebview(useUrl, context);
  });

  const startManagedDisposable = vscode.commands.registerCommand('vscode-n8n.startManaged', async () => {
    const config = vscode.workspace.getConfiguration();
    const enableProxy = config.get<boolean>('vscode-n8n.proxy.enable', true);
    const proxyPort = config.get<number>('vscode-n8n.proxy.port', 5799);
    const binary = config.get<string>('vscode-n8n.managed.binary', 'n8n');
    const env = config.get<Record<string, string>>('vscode-n8n.managed.env', {});

    try {
      await startManagedN8n(binary, env);
      const baseUrl = managedState.baseUrl;
      if (enableProxy) {
        await ensureProxyStarted(proxyPort, baseUrl);
      }
      const useUrl = enableProxy ? `http://127.0.0.1:${proxyPort}` : baseUrl;
      openWebview(useUrl, context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`启动托管 n8n 失败: ${message}`);
    }
  });

  context.subscriptions.push(openDisposable, startManagedDisposable);
}

export function deactivate() {
  if (proxyServer) {
    proxyServer.close();
    proxyServer = undefined;
  }
  if (managedState.process) {
    managedState.process.kill();
    managedState.process = undefined;
  }
}

function openWebview(url: string, context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'n8nWebview',
    'n8n',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  const csp = [
    `default-src 'none'`,
    `img-src ${panel.webview.cspSource} data:`,
    `style-src ${panel.webview.cspSource} 'unsafe-inline'`,
    `script-src 'unsafe-inline' 'unsafe-eval'`,
    `frame-src ${url} http: https:`,
    `connect-src ${panel.webview.cspSource} http: https:`
  ].join('; ');

  panel.webview.html = getWebviewContent(url, csp);
}

function getWebviewContent(url: string, csp: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>n8n</title>
  <style>
    html, body, #frame { height: 100%; width: 100%; margin: 0; padding: 0; }
    body { background: var(--vscode-editor-background); }
    #bar { height: 36px; display: flex; align-items: center; padding: 0 8px; gap: 8px; border-bottom: 1px solid var(--vscode-editorGroup-border); font-family: var(--vscode-font-family); }
    #frame { height: calc(100% - 36px); border: 0; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 10px; border-radius: 3px; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    #url { flex: 1; color: var(--vscode-foreground); opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  </style>
  </head>
  <body>
    <div id="bar">
      <button id="reload">刷新</button>
      <span id="url"></span>
    </div>
    <iframe id="frame" src="${url}" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals allow-downloads"></iframe>
    <script>
      const urlSpan = document.getElementById('url');
      urlSpan.textContent = '${url}';
      document.getElementById('reload').addEventListener('click', () => {
        const frame = document.getElementById('frame');
        frame.src = frame.src;
      });
    </script>
  </body>
  </html>`;
}

async function ensureProxyStarted(port: number, targetUrl: string): Promise<void> {
  if (proxyServer) {
    return;
  }

  const proxy = httpProxy.createProxyServer({
    target: targetUrl,
    changeOrigin: true,
    ws: true,
    selfHandleResponse: false
  });

  proxy.on('proxyRes', (proxyRes) => {
    // 移除阻止 iframe 的响应头
    delete proxyRes.headers['x-frame-options'];
    if (typeof proxyRes.headers['content-security-policy'] === 'string') {
      const csp = proxyRes.headers['content-security-policy'] as string;
      // 去除 frame-ancestors 指令，保留其余 CSP
      const filtered = csp
        .split(';')
        .map(s => s.trim())
        .filter(s => s.toLowerCase().startsWith('frame-ancestors') === false)
        .join('; ');
      if (filtered.length > 0) {
        proxyRes.headers['content-security-policy'] = filtered;
      } else {
        delete proxyRes.headers['content-security-policy'];
      }
    }
  });

  proxy.on('error', (err) => {
    vscode.window.showErrorMessage(`代理错误: ${err.message}`);
  });

  proxyServer = http.createServer((req, res) => {
    proxy.web(req, res, { target: targetUrl });
  });

  proxyServer.on('upgrade', (req, socket, head) => {
    proxy.ws(req, socket, head, { target: targetUrl });
  });

  await new Promise<void>((resolve, reject) => {
    proxyServer!.once('error', reject);
    proxyServer!.listen(port, '127.0.0.1', () => resolve());
  });
}

async function startManagedN8n(binary: string, extraEnv: Record<string, string>): Promise<void> {
  if (managedState.process) {
    return; // 已启动
  }
  const env: NodeJS.ProcessEnv = { ...process.env, ...extraEnv };
  // 强制绑定到 127.0.0.1，减少暴露面
  env['N8N_PORT'] = env['N8N_PORT'] || '5678';
  env['N8N_HOST'] = env['N8N_HOST'] || '127.0.0.1';
  managedState.baseUrl = `http://${env['N8N_HOST']}:${env['N8N_PORT']}`;

  const child = spawn(binary, { env, stdio: 'pipe' });
  managedState.process = child;
  managedState.ready = false;

  const output = (data: Buffer) => {
    const text = data.toString();
    if (!managedState.ready && /Server .* listening/i.test(text)) {
      managedState.ready = true;
    }
  };
  child.stdout?.on('data', output);
  child.stderr?.on('data', output);

  child.on('exit', (code) => {
    if (code !== 0) {
      vscode.window.showErrorMessage(`n8n 进程退出，代码: ${code}`);
    }
    managedState.process = undefined;
    managedState.ready = false;
  });

  // 简单健康检查等待，最多 30 秒
  const ok = await waitForHealthy(managedState.baseUrl, 30000);
  if (!ok) {
    throw new Error('n8n 启动超时或不可用');
  }
}

async function waitForHealthy(url: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await httpGet(url);
      if (ok) return true;
    } catch {
      // ignore
    }
    await delay(500);
  }
  return false;
}

function httpGet(url: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', reject);
    req.setTimeout(3000, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

