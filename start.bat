@echo off
echo ========================================
echo   SaveAny - 万能视频下载器 启动脚本
echo ========================================
echo.

echo [1/4] 安装后端依赖...
cd /d "%~dp0backend"
pip install -r requirements.txt
echo.

echo [2/4] 安装前端依赖...
cd /d "%~dp0frontend"
call npm install
echo.

echo [3/4] 启动后端服务 (端口 8000)...
cd /d "%~dp0backend"
start "SaveAny Backend" python -m uvicorn main:app --host 0.0.0.0 --port 8000
echo 后端已启动!
echo.

echo [4/4] 启动前端服务 (端口 3000)...
cd /d "%~dp0frontend"
start "SaveAny Frontend" npm run dev
echo 前端已启动!
echo.

echo ========================================
echo   启动完成! 请访问 http://localhost:3000
echo ========================================
pause
