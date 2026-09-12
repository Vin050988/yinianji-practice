#!/bin/bash
# 一年级练习 App · 本地预览启动器（双击运行）
# 作用：在本机起一个网页服务，方便用电脑或 iPad 打开体验。
cd "$(dirname "$0")" || exit 1

PORT=8080
echo "──────────────────────────────────────────"
echo "  一年级练习 App · 本地预览"
echo "──────────────────────────────────────────"
echo "  电脑访问 : http://localhost:${PORT}"
IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -n "$IP" ]; then
  echo "  iPad 访问 : http://${IP}:${PORT}   （需和这台 Mac 在同一个 Wi-Fi）"
else
  echo "  iPad 访问 : 未取到局域网 IP，请检查 Wi-Fi"
fi
echo "──────────────────────────────────────────"
echo "  按 Control + C 停止服务"
echo ""

open "http://localhost:${PORT}" 2>/dev/null
python3 -m http.server "${PORT}" --bind 0.0.0.0
