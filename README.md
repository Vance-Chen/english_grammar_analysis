# Grammar Station（英语语法练习站）

[![GitHub](https://img.shields.io/github/repo/Vance-Chen/english_grammar_analysis)](https://github.com/Vance-Chen/english_grammar_analysis)

在浏览器中对英文句子进行**语法成分标注**，提交后由后端通过 **SSE** 流式返回 AI 评估结果与中文译文。

- 前端：React 18 + Vite + TypeScript + Zod
- 后端：Python FastAPI + Pydantic
- 部署：Docker Compose（Nginx + uvicorn）

## 功能概览

- 选中文本区间，标注句法功能（S / V / O …）与结构形式（np / clause / vp …）
- 设置句类、结构类型、时态 / 语态等全句信息
- 客户端 Zod 校验 + 服务端语义校验（span 边界、parent 引用等）
- `POST /api/analyze`：SSE 推送进度 → 评估 → 译文增量 → 完成
- 未配置 `OPENAI_API_KEY` 时进入**离线模拟模式**
- 评估与译文**并行请求**，先完成的先返回（可配置不同模型）

## 项目结构

```
english_grammar_analysis/
├── package.json              # 根脚本：dev / verify / docker
├── docker-compose.yml        # 本地构建 + 运行
├── docker-compose.deploy.yml # 仅镜像部署（无源码）
├── .env.example              # 环境变量模板（复制为 .env）
├── api-py/
│   ├── app/
│   │   ├── main.py           # 路由与 SSE
│   │   ├── llm.py            # LLM 调用（并行评估/译文）
│   │   ├── models.py         # Pydantic（taxonomy 1.0.3）
│   │   ├── semantics.py      # 标注语义校验
│   │   ├── security.py       # 密钥脱敏、安全错误信息
│   │   └── throttle_cache.py
│   ├── Dockerfile
│   └── requirements.txt
└── web/
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   └── lib/schema/       # Zod 类型（与后端对齐）
    ├── nginx.conf
    └── Dockerfile
```

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.10+
- Docker / Docker Compose（可选，用于部署）

### 1. 安装依赖

```bash
cd web && npm install

cd ../api-py
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cd ..   # 回到项目根目录
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY 等（勿提交 .env）
```

**NVIDIA 免费 API 示例**（[NVIDIA Build](https://build.nvidia.com/)）：

```env
OPENAI_API_KEY=nvapi-xxxxxxxx
OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1
OPENAI_MODEL=nvidia/nemotron-3-ultra-550b-a55b
# 大模型慢时，可为译文单独指定更快模型：
# OPENAI_MODEL_TRANSLATION=meta/llama-3.1-8b-instruct
```

### 3. 开发运行

```bash
# 终端 1：API  http://127.0.0.1:8788
npm run dev:api

# 终端 2：Web  http://127.0.0.1:5173
npm run dev:web
```

## 根目录脚本

| 命令 | 说明 |
|------|------|
| `npm run dev:api` | 启动 FastAPI（读取 `.env`） |
| `npm run dev:web` | 启动 Vite 开发服务器 |
| `npm run build` | 构建前端 → `web/dist/` |
| `npm run verify` | 前端构建 + 类型检查 + 后端导入 |
| `npm run docker:up` | Docker 构建并启动 |
| `npm run docker:down` | 停止容器 |
| `npm run docker:deploy` | 使用 deploy compose 启动 |
| `npm run docker:save` | 导出镜像 tar 包 |

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `OPENAI_API_KEY` | API Key；空则离线模拟 | 空 |
| `OPENAI_BASE_URL` | 兼容 OpenAI 的 API 地址 | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 评估用模型 | `gpt-4o-mini` |
| `OPENAI_MODEL_TRANSLATION` | 译文模型；空则同 `OPENAI_MODEL` | 空 |
| `OPENAI_MAX_TOKENS` | 评估最大 token | `2048` |
| `OPENAI_MAX_TOKENS_TRANSLATION` | 译文最大 token | `512` |
| `OPENAI_TEMPERATURE` | 采样温度 | `0.3` |
| `OPENAI_HTTP_READ_TIMEOUT` | 读超时（秒） | `600` |
| `CORS_ORIGINS` | 逗号分隔；空则仅 localhost:5173 | 开发默认 |
| `WEB_PORT` | Docker 对外端口 | `8080` |
| `VITE_API_PROXY` | 前端 dev 代理目标 | `http://127.0.0.1:8788` |

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/analyze` | 标注分析（SSE） |
| `POST` | `/api/tts/jobs` | TTS 占位 |
| `GET` | `/api/tts/jobs/{id}` | TTS 查询占位 |
| `POST` | `/api/vocabulary` | 生词本占位 |

`analyze` 请求体为 camelCase 的 `AnnotationBundle`（见 `web/src/lib/schema` 与 `api-py/app/models.py`）。

## Docker 部署

```bash
cp .env.example .env    # 编辑密钥
npm run docker:up
curl -s http://127.0.0.1:8080/api/health
```

### 镜像拷贝 / Docker Hub

```bash
# 构建并导出
docker compose --env-file .env build
docker save grammar-station-api:latest grammar-station-web:latest -o grammar-station-images.tar

# 推送到 Docker Hub（需 docker login）
docker tag grammar-station-api:latest  YOUR_USER/grammar-station-api:latest
docker tag grammar-station-web:latest YOUR_USER/grammar-station-web:latest
docker push YOUR_USER/grammar-station-api:latest
docker push YOUR_USER/grammar-station-web:latest
```

目标机：`docker-compose.deploy.yml` + `.env` + `docker load` 或 `docker pull`。

## 测试验证

```bash
npm run verify
```

**2026-06-26 测试结果**

| 检查项 | 结果 |
|--------|------|
| `npm run verify`（构建 + tsc + Python 导入） | 通过 |
| `GET /api/health` | 200 `{"ok":true}` |
| `POST /api/analyze` 非法体 | 400 |
| `POST /api/analyze` 合法体 + SSE | 200，progress → evaluation → translation |
| 前端首页（Docker :8080） | 200 |
| `security.py` 密钥脱敏 | 通过 |

手动 API 测试：

```bash
curl -s -N -X POST http://127.0.0.1:8080/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{
    "taxonomyVersion": "1.0.3",
    "text": "He left.",
    "indexEncoding": "utf-16",
    "sentencePatterns": {
      "sentenceClass": "declarative",
      "structureType": "simple",
      "specialPatterns": ["none"]
    },
    "spans": [
      {"id": "s1", "start": 0, "end": 2, "grammaticalFunction": "S", "formCategory": "np"},
      {"id": "v1", "start": 3, "end": 7, "grammaticalFunction": "V", "formCategory": "vp"}
    ]
  }'
```

## 安全说明

| 项 | 做法 |
|----|------|
| API 密钥 | 仅写在 `.env`（已 gitignore） |
| `.env.example` | 模板，勿填真实 Key |
| CORS | 默认限制 localhost；生产同域经 Nginx 代理 |
| 错误信息 | 上游 LLM 详情不返回浏览器 |
| 镜像包 | `*.tar` 不提交 Git |

密钥泄露后请在服务商控制台**立即轮换**。

## 常见问题

**HTTP 部署白屏 / `crypto.randomUUID is not a function`**  
非 HTTPS 环境已用 `randomId()` 兼容；请部署含 `index-8734e10c.js` 及之后的前端构建。

**`esbuild` 平台不匹配**  
在 WSL 内删除 `web/node_modules` 后重新 `npm install`。

**NVIDIA 模型很慢**  
可为 `OPENAI_MODEL_TRANSLATION` 指定更小模型，或换用更快 endpoint。

**只有模拟评估**  
检查 `.env` 中 `OPENAI_API_KEY` 是否已配置，并重启 API 容器。

## License

MIT（如需变更请自行添加 LICENSE 文件）
