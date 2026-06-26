# Grammar Station（英语语法练习站）

在浏览器中对英文句子进行语法成分标注，提交后由后端通过 SSE 流式返回评估结果与中文译文。前端为 React + Vite，后端为 Python FastAPI。

## 功能概览

- 选中文本区间，标注句法功能（S/V/O…）与结构形式（np/clause/vp…）
- 设置句类、结构类型、时态/语态等全句模式信息
- 客户端 Zod 校验 + 服务端语义校验（span 边界、parent 引用等）
- `POST /api/analyze` 以 Server-Sent Events 推送：进度 → 评估 → 译文增量 → 完成
- 未配置 `OPENAI_API_KEY` 时自动进入**离线模拟模式**，便于本地开发与联调

## 项目结构

```
english_grammar_analysis/
├── package.json          # 根级脚本（dev:web / dev:api / build）
├── api-py/               # Python 后端
│   ├── app/
│   │   ├── main.py       # FastAPI 路由与 SSE
│   │   ├── models.py     # Pydantic 模型（taxonomy 1.0.3）
│   │   ├── semantics.py  # 标注语义校验
│   │   ├── llm.py        # OpenAI 调用 / 离线模拟
│   │   └── throttle_cache.py
│   ├── requirements.txt
│   └── .venv/            # 本地虚拟环境（需自行创建，勿提交）
└── web/                  # React 前端
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   └── lib/schema/   # 类型定义与 Zod schema（与后端 models 对齐）
    └── vite.config.ts    # 开发时 /api 代理到 8788
```

## 环境要求

- **Node.js** 18+（推荐在 WSL/Linux 下执行 `npm install`，勿从 Windows 直接复制 `node_modules`）
- **Python** 3.10+（已在 3.12 验证）
- 可选：**OpenAI 兼容 API**（真实语法评估与翻译）

## 首次安装

### 1. 前端依赖

```bash
cd web
npm install
```

### 2. Python 虚拟环境与依赖

```bash
cd api-py
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 开发运行

在项目根目录开两个终端：

```bash
# 终端 1：API（默认 http://127.0.0.1:8788）
npm run dev:api

# 终端 2：前端（默认 http://127.0.0.1:5173，/api 代理到后端）
npm run dev:web
```

浏览器访问 [http://127.0.0.1:5173](http://127.0.0.1:5173)。

若后端端口不同，可设置：

```bash
VITE_API_PROXY=http://127.0.0.1:8788 npm run dev:web
```

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `OPENAI_API_KEY` | OpenAI（或兼容服务）API Key；未设置则离线模拟 | 空 |
| `OPENAI_BASE_URL` | API 基址 | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 模型名 | `gpt-4o-mini` |
| `OPENAI_TEMPERATURE` | 采样温度；`omit`/`none`/空则不传 | `0.3` |
| `OPENAI_HTTP_READ_TIMEOUT` | HTTP 读超时（秒） | `600` |
| `OPENAI_HTTP_CONNECT_TIMEOUT` | HTTP 连接超时（秒） | `30` |
| `PORT` / `HOST` | uvicorn 监听（`python -m app.main`） | `8788` / `0.0.0.0` |
| `VITE_API_PROXY` | 前端开发代理目标 | `http://127.0.0.1:8788` |

示例：

```bash
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o-mini
npm run dev:api
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/analyze` | 提交标注 JSON，响应 `text/event-stream` |
| `POST` | `/api/tts/jobs` | TTS 任务占位（202） |
| `GET` | `/api/tts/jobs/{id}` | 查询 TTS 任务占位 |
| `POST` | `/api/vocabulary` | 生词本占位（201） |

`analyze` 请求体为 camelCase 的 `AnnotationBundle`（见 `web/src/lib/schema` 与 `api-py/app/models.py`），`taxonomyVersion` 须为 `1.0.3`，`indexEncoding` 须为 `utf-16`。

## 生产构建

```bash
# 仅构建前端静态资源 → web/dist/
npm run build
```

生产部署时需将 `/api` 反向代理到 FastAPI 服务，并单独启动 uvicorn，例如：

```bash
cd api-py
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8788
```

## Docker 部署

项目以根目录 **`.env.example`** 作为部署环境变量文件（Compose 插值与 API 容器环境均从此读取）。

```bash
# 1. 编辑 .env.example（端口、OPENAI_API_KEY、NVIDIA 端点等）
# 2. 构建并启动
docker compose --env-file .env.example up -d --build
# 或使用 npm 脚本（已内置 --env-file .env.example）
npm run docker:up

# 3. 验证（端口与 WEB_PORT 一致，默认 8080）
curl -s http://127.0.0.1:8080/api/health
# 期望：{"ok":true}
```

若改用其他文件名（例如 `.env`），可设置 `ENV_FILE`：

```bash
ENV_FILE=.env docker compose --env-file .env up -d --build
```

常用命令：

```bash
docker compose --env-file .env.example logs -f
docker compose --env-file .env.example down
npm run docker:down
```

架构说明：

| 服务 | 镜像构建目录 | 对外端口 | 说明 |
|------|-------------|----------|------|
| `web` | `web/` | `${WEB_PORT}`（来自 `.env.example`） | Nginx 静态站点 + `/api` 代理 |
| `api` | `api-py/` | 仅内部 8788 | `env_file` 注入 OpenAI/NVIDIA 等变量 |

本地开发时 `npm run dev:api` 也会自动 `source .env.example`，与 Docker 部署使用同一套配置。

**安全提示**：`.env.example` 若含真实 API Key，请勿提交到公开仓库；可改为使用 `.env`（加入 `.gitignore`）并在部署时 `ENV_FILE=.env`。

### 镜像拷贝到另一台服务器部署

构建机（有源码）先打出固定标签的镜像并导出：

```bash
# 1. 构建（镜像名为 grammar-station-api:latest、grammar-station-web:latest）
docker compose --env-file .env.example build

# 2. 导出为 tar（可 scp 到目标机）
docker save grammar-station-api:latest grammar-station-web:latest -o grammar-station-images.tar
# 或：set -a && . .env.example && set +a && npm run docker:save
```

目标服务器只需以下文件（**不需要源码**）：

```
deploy/
├── docker-compose.deploy.yml
├── .env.example          # 或改名为 .env，按环境修改
└── grammar-station-images.tar
```

目标机操作：

```bash
# 1. 导入镜像
docker load -i grammar-station-images.tar
docker images | grep grammar-station   # 确认标签与 API_IMAGE、WEB_IMAGE 一致

# 2. 启动（使用 deploy compose，不 build）
docker compose -f docker-compose.deploy.yml --env-file .env.example up -d
# 或：npm run docker:deploy

# 3. 验证
curl -s http://127.0.0.1:8080/api/health
```

`docker-compose.deploy.yml` 与开发用 `docker-compose.yml` 的区别：

| 文件 | 用途 | 是否 build |
|------|------|------------|
| `docker-compose.yml` | 本机构建 + 运行 | 是 |
| `docker-compose.deploy.yml` | 仅 `image:` 引用已存在镜像 | 否 |

若导出时使用了其他标签，在 `.env.example` 中修改即可，例如：

```env
API_IMAGE=grammar-station-api:1.0.0
WEB_IMAGE=grammar-station-web:1.0.0
```

也可推送到私有仓库后，在目标机 `docker pull`，同样通过 `API_IMAGE` / `WEB_IMAGE` 指定地址。

## 验证与测试

在项目根目录可执行：

```bash
npm run verify
```

或手动执行以下检查（2026-06-26 已通过）：

```bash
# 前端：生产构建 + 类型检查
cd web && npm run build && npm run typecheck

# 后端：模块导入
cd api-py && .venv/bin/python -c "from app.main import app; print(app.title)"

# 健康检查（需先启动 API）
curl -s http://127.0.0.1:8788/api/health
# 期望：{"ok":true}

# 合法标注 + SSE 流（离线模式亦可）
curl -s -N -X POST http://127.0.0.1:8788/api/analyze \
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
# 期望：HTTP 200，依次收到 progress / evaluation / translation / done 事件

# 非法请求体
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8788/api/analyze \
  -H 'Content-Type: application/json' -d '{"bad":true}'
# 期望：400
```

## 数据契约说明

- 前端类型与校验：`web/src/lib/schema/`（Zod）
- 后端模型：`api-py/app/models.py`（Pydantic）
- 修改 taxonomy 常量时需**同时更新**上述两处，并保持 `taxonomyVersion` 一致

## 常见问题

**`esbuild` 平台不匹配**  
在 WSL 中删除 `web/node_modules` 后重新 `npm install`，不要从 Windows 拷贝 `node_modules`。

**`ModuleNotFoundError: fastapi`**  
确认已创建 `api-py/.venv` 并安装 `requirements.txt`，使用 `.venv/bin/python` 启动。

**提交后只有模拟评估**  
未设置 `OPENAI_API_KEY` 时为预期行为；配置密钥后重启 API 即可调用真实大模型。
