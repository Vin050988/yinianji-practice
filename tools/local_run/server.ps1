# 一年级练习 - PowerShell 备用静态服务器（没装 Python 时用）
$port = 8090
$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Path }

$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*" } |
    Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "localhost" }

$listener = New-Object System.Net.HttpListener
try {
    $listener.Prefixes.Add("http://${ip}:${port}/")
    $listener.Start()
} catch {
    try {
        $listener.Stop()
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://+:$port/")
        $listener.Start()
    } catch {
        Write-Host "启动失败：端口 $port 被占用或需要管理员权限。" -ForegroundColor Red
        Write-Host "请右键本脚本 -> 以管理员身份运行，或把端口改成别的。" -ForegroundColor Yellow
        Read-Host "按回车退出"
        exit
    }
}

Write-Host "==============================================" -ForegroundColor Green
Write-Host "  一年级练习 已启动"
Write-Host "  本机浏览:  http://localhost:$port"
Write-Host "  iPad 浏览: http://$ip:$port" -ForegroundColor Cyan
Write-Host "  iPad 连同一个 WiFi，Safari 打开后添加到主屏幕"
Write-Host "  关闭本窗口即停止"
Write-Host "==============================================" -ForegroundColor Green

$mime = @{
    ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"
    ".css"="text/css"; ".js"="text/javascript"
    ".json"="application/json; charset=utf-8"
    ".mp3"="audio/mpeg"; ".m4a"="audio/mp4"; ".wav"="audio/wav"
    ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"
    ".gif"="image/gif"; ".svg"="image/svg+xml"; ".ico"="image/x-icon"
}

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $p = $ctx.Request.Url.AbsolutePath
        if ($p -eq "/" -or $p -eq "") { $p = "/index.html" }
        $file = Join-Path $root ($p.TrimStart("/"))
        $file = [System.IO.Path]::GetFullPath($file)
        if ((Test-Path $file -PathType Leaf) -and $file.StartsWith($root)) {
            $ext = [System.IO.Path]::GetExtension($file).ToLower()
            $ct = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($file)
            $ctx.Response.ContentType = $ct
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.AppendHeader("Access-Control-Allow-Origin", "*")
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $ctx.Response.StatusCode = 404
        }
        $ctx.Response.Close()
    } catch {
        break
    }
}
