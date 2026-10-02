# 부동산 임장 앱 — Vercel 배포판

투자·실거주 겸용 부동산 현장 임장 기록 웹앱의 Next.js(Vercel) 포팅 버전입니다.
호스티드 버전(space-2)의 기능을 Next.js App Router + Postgres 기반으로 재구현했습니다.

## 아키텍처

- **Frontend**: Next.js App Router + React 19 + Leaflet(지도) + recharts(차트)
- **Backend**: Next.js Route Handlers (`app/api/*`) — 기존 서버 액션을 1:1로 이식
- **DB**: drizzle-orm + PostgreSQL (Neon / Supabase / Vercel Postgres)
- **파일 저장**: Vercel Blob (사진·음성 녹음)
- **자동 시세 확인**: Vercel Cron (`vercel.json`) + `/api/cron/price-check`

## Vercel 배포 방법

### 1. GitHub 연결
1. Vercel 대시보드에서 "Add New Project" → 이 리포지토리(`cybereun/imjang`) 선택
2. Branch는 **`vercel`** 선택 (main이 아님에 주의)
3. Framework Preset: Next.js (자동 감지)

### 2. Postgres 프로비저닝 (택 1)
- **Neon** (https://neon.tech): 무료 티어, 프로젝트 생성 후 연결 문자열 복사
- **Supabase** (https://supabase.com): 무료 티어, Project Settings → Database → Connection string
- **Vercel Postgres**: Vercel 대시보드 → Storage → Create Database → Postgres

연결 문자열을 아래 `DATABASE_URL` 환경변수에 입력합니다.

### 3. 환경변수 설정
Vercel 대시보드 → Project → Settings → Environment Variables에 입력:

| 변수 | 설명 | 발급처 |
|---|---|---|
| `MOLIT_API_KEY` | 국토교통부 실거래가 API 키 | 공공데이터포털(data.go.kr) |
| `VWORLD_API_KEY` | 브이월드 지도 API 키 | 브이월드(vworld.kr, 무료) |
| `DATABASE_URL` | Postgres 연결 문자열 | Neon / Supabase / Vercel Postgres |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 읽기/쓰기 토큰 | Vercel 대시보드 → Storage → Blob → 발급 |
| `CRON_SECRET` | Cron 보호용 임의 문자열 | 직접 생성 (예: `openssl rand -hex 32`) |

### 4. DB 마이그레이션
```bash
# 로컬에서 DATABASE_URL을 .env에 설정한 뒤
npm install
npx drizzle-kit migrate
```
또는 Neon/Supabase의 SQL Editor에서 `drizzle/0001_initial.sql`을 직접 실행해도 됩니다.

### 5. Blob Storage 생성
Vercel 대시보드 → Storage → Create → Blob → 생성 후 발급된 토큰을
`BLOB_READ_WRITE_TOKEN`에 입력합니다.

### 6. Cron 확인
`vercel.json`에 매일 06:53 KST(21:53 UTC) 실행이 등록되어 있습니다.
Vercel 대시보드 → Project → Cron Jobs에서 활성화 상태를 확인하세요.
`/api/cron/price-check`는 `CRON_SECRET` Bearer 토큰으로 보호됩니다.

## 로컬 개발

```bash
npm install
cp .env.example .env   # 환경변수 입력
npx drizzle-kit migrate
npm run dev
```

## 주요 변경점 (호스티드 버전 대비)

- `@hatch/space-sdk` 의존성 제거 → 표준 fetch/Request/Response
- SQLite → PostgreSQL (drizzle pg-core, 통합 마이그레이션 1개)
- 사진·음성 파일: 만료형 서명 URL 대신 Vercel Blob 공개 URL을 `blobKey` 컬럼에 저장
- 국토부/VWorld API 키: 서버 환경변수로만 관리 (브라우저 localStorage 방식 폐지)
- 자동 시세 확인: 호스티드 예약 작업 → Vercel Cron
- VWorld 지도 타일은 클라이언트에서 키를 URL에 넣어 호출하는 공식 방식 유지

## 디렉토리 구조

```
app/
  api/            # Route Handlers (기존 서버 액션 1:1 이식)
    cron/price-check/  # Vercel Cron 엔드포인트
  page.tsx        # 메인 앱 (클라이언트 컴포넌트)
  layout.tsx
  globals.css
  components/     # App.tsx 분할 컴포넌트
components/       # (app/components와 동일, 아래 참조)
lib/
  db.ts           # drizzle Postgres 연결
  route.ts        # Route Handler 헬퍼 (zod 검증)
  molit.ts        # 국토부 API 호출
  blob.ts         # Vercel Blob 래퍼
  regions.ts      # LAWD_CD 지역 데이터
  api-client.ts   # 클라이언트용 fetch 래퍼 (기존 api.* 호출과 동일 인터페이스)
db/
  schema.ts       # drizzle pg-core 스키마 (24개 테이블)
drizzle/
  0001_initial.sql  # 통합 Postgres 마이그레이션
vercel.json       # Cron 스케줄
```
