# 一键启动开发服务器的 PowerShell 脚本
# 使用方法：在项目根目录运行 `./start-dev.ps1`

Param(
  [switch]$InstallDependencies
)

# 切换到脚本所在目录（项目根）
Set-Location -Path $PSScriptRoot

if ($InstallDependencies) {
  Write-Host "正在安装依赖，请稍候..." -ForegroundColor Cyan
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install 失败（退出代码 $LASTEXITCODE）。请检查网络或 npm 配置。"
    exit $LASTEXITCODE
  }
}

Write-Host "启动 Vite 开发服务器... 输出将直接显示在此终端。按 Ctrl+C 停止。" -ForegroundColor Green

# 启动开发服务器
npm run dev


