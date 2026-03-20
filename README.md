# The Ultimate Prompt Ground (UPG)

다양한 LLM 모델의 프롬프트를 비교 테스트하고, 비용/응답시간을 분석하는 웹 대시보드.

## Quick Start

```bash
# 1. 의존성 설치
npm install

# 2. API Key 설정
cp .env.example .env.local
# .env.local 파일을 열어 사용할 API 키 입력

# 3. 개발 서버 실행
npm run dev

# 4. 브라우저에서 접속
# http://localhost:3000
```

## Share With Coworkers

이 프로젝트는 GitHub Pages 같은 정적 호스팅보다는 Node 서버 배포가 맞습니다. 가장 간단한 경로는 Render 배포입니다.

- `render.yaml` 포함: Render Blueprint로 바로 배포 가능
- SQLite 영속 저장: `DATABASE_PATH`를 Render persistent disk 경로로 분리
- 기본 접근 보호: `BASIC_AUTH_ENABLED=true` + 계정 정보로 앱과 API를 함께 보호
- 헬스체크 엔드포인트: `/api/health`
- Free tier 백업: History 탭에서 `Export Backup JSON` / `Import Backup JSON` 지원

### Render 배포 절차

1. GitHub에 저장소를 push
2. Render에서 `New +` -> `Blueprint` 선택
3. 이 저장소 연결
4. `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`, 각 API 키 입력
5. 배포 완료 후 Render URL을 팀에 공유

기본 Blueprint는 [render.yaml](./render.yaml)에 들어 있습니다.

## 지원 모델 (22개)

| Provider | Models |
|----------|--------|
| **OpenAI** | GPT-5.4, GPT-5.4 Mini/Nano, GPT-4.1, GPT-4.1 Mini/Nano, GPT-4o, GPT-4o Mini, o4-mini, o3, o3-mini |
| **Anthropic** | Claude Opus 4.6, Claude Sonnet 4.5, Claude Haiku 4.5 |
| **Google Gemini** | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash |
| **Perplexity** | Sonar Pro, Sonar Reasoning Pro, Sonar, Sonar Deep Research |

## 기능

- **Playground** — 시스템/유저 프롬프트 편집, 모델 멀티셀렉트, 비동기 동시 호출, SSE 스트리밍 결과 비교
- **모델별 파라미터** — 각 모델이 지원하는 파라미터만 개별 조절 (예: o-series는 Reasoning Effort, Claude/Gemini는 Top K)
- **Response Format** — JSON Schema 지정으로 Structured Output 지원
- **결과 비교 그리드** — Raw / Formatted / HTML Preview 탭, 비용·응답시간·토큰 수 실시간 표시
- **프롬프트 라이브러리** — 프롬프트 세트 저장/로드/편집/삭제 (SQLite 영구 저장)
- **테스트 이력** — 모든 테스트 자동 저장, 상세 결과 비교, CSV 내보내기

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + React + TypeScript + Tailwind CSS v4
- **Backend**: Next.js API Routes (SSE streaming)
- **Database**: SQLite (better-sqlite3)
- **State**: Zustand

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                  # Playground (메인)
│   ├── prompts/page.tsx          # 프롬프트 라이브러리
│   ├── history/page.tsx          # 테스트 이력
│   └── api/
│       ├── llm/route.ts          # LLM 호출 프록시 (SSE)
│       ├── prompts/route.ts      # 프롬프트 CRUD
│       └── history/route.ts      # 이력 CRUD
├── components/
│   ├── layout/Sidebar.tsx
│   └── playground/
│       ├── PromptEditor.tsx      # 프롬프트 에디터
│       ├── ModelSelector.tsx     # 모델 선택 UI
│       ├── ParameterPanel.tsx    # 모델별 파라미터 조절
│       ├── ResultPanel.tsx       # 단일 결과 패널
│       └── ResultGrid.tsx        # 결과 비교 그리드
├── lib/
│   ├── db.ts                     # SQLite 연결/스키마
│   ├── pricing.ts                # 모델 정보, 가격, 파라미터 정의
│   ├── utils.ts                  # 유틸리티 함수
│   └── providers/
│       ├── index.ts              # 통합 인터페이스
│       ├── openai.ts             # OpenAI (o-series reasoning 지원)
│       ├── anthropic.ts          # Claude (top_k 지원)
│       ├── gemini.ts             # Gemini (system_instruction, top_k)
│       └── perplexity.ts         # Perplexity (Sonar 모델)
├── store/playground.ts           # Zustand 상태 관리
├── types/index.ts                # TypeScript 타입 정의
data/
├── upg.db                        # SQLite DB (자동 생성)
└── prompts/                      # 프롬프트 파일 저장소
```

## 환경 변수 (.env.local)

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...
PERPLEXITY_API_KEY=pplx-...

DATABASE_PATH=./data/upg.db
PYTHON_BIN=python

BASIC_AUTH_ENABLED=false
BASIC_AUTH_USERNAME=
BASIC_AUTH_PASSWORD=
```

사용하지 않는 프로바이더의 키는 비워두어도 됨. 해당 모델 호출 시에만 에러 발생.
배포 환경에서는 `BASIC_AUTH_ENABLED=true`를 권장.
