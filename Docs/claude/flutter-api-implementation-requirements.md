# Flutter API実装要件定義書

## 1. 概要

### 1.1 目的
ReactのWebアプリケーションの機能を維持しつつ、Flutterモバイルアプリからも同じ機能にアクセスできるようにするため、必要なAPIエンドポイントを実装する。

### 1.2 現状
- **認証基盤**: 完了済み（Bearer token + Cookie両対応）
- **実装済みAPI**: PTO、Timesheets、Auth signout
- **未実装**: Dashboard、Schedule、Team、Shift Swaps、Chat、Tasks、Forms、Reports、Settings、Organization、Audit Logs

### 1.3 認証方式
| クライアント | 認証方式 | 実装状況 |
|-------------|---------|---------|
| React (Web) | Cookie認証 | ✅ 完了 |
| Flutter (Mobile) | Bearer Token | ✅ 完了 |

---

## 2. 優先度別API実装一覧

### 2.1 優先度: 高（Phase 1）

#### 2.1.1 Dashboard API
従業員がアプリを開いて最初に見る画面のデータ

| エンドポイント | メソッド | 説明 | ロール |
|--------------|--------|------|-------|
| `/api/dashboard/summary` | GET | ダッシュボード集計データ | 全員 |
| `/api/dashboard/today-shifts` | GET | 今日のシフト一覧 | 全員 |

**関連ファイル:**
- `src/app/(dashboard)/dashboard/page.tsx`

**必要なデータ:**
```typescript
interface DashboardSummary {
  todayShiftsCount: number;
  clockedInCount: number;
  pendingPtoCount: number;
  pendingSwapCount: number;
  unreadMessagesCount: number;
  userTodayEntries: TimeEntry[];
  locations: Location[];
}
```

---

#### 2.1.2 Time Clock API
出退勤打刻機能

| エンドポイント | メソッド | 説明 | ロール |
|--------------|--------|------|-------|
| `/api/time-clock/status` | GET | 現在の打刻状態取得 | 全員 |
| `/api/time-clock/clock-in` | POST | 出勤打刻 | 全員 |
| `/api/time-clock/clock-out` | POST | 退勤打刻 | 全員 |
| `/api/time-clock/break-start` | POST | 休憩開始 | 全員 |
| `/api/time-clock/break-end` | POST | 休憩終了 | 全員 |
| `/api/time-entries` | GET | 打刻履歴取得 | 全員 |

**関連ファイル:**
- `src/app/(dashboard)/dashboard/page.tsx`（Time Clock Widget）
- `src/components/time-clock/`

**リクエスト/レスポンス:**
```typescript
// POST /api/time-clock/clock-in
interface ClockInRequest {
  location_id: string;
  notes?: string;
  coordinates?: { lat: number; lng: number };
}

interface ClockInResponse {
  success: boolean;
  data: TimeEntry;
}
```

---

#### 2.1.3 Schedule/Shifts API
シフト管理機能

| エンドポイント | メソッド | 説明 | ロール |
|--------------|--------|------|-------|
| `/api/shifts` | GET | シフト一覧取得 | 全員 |
| `/api/shifts` | POST | シフト作成 | admin/manager |
| `/api/shifts/[id]` | GET | シフト詳細取得 | 全員 |
| `/api/shifts/[id]` | PUT | シフト更新 | admin/manager |
| `/api/shifts/[id]` | DELETE | シフト削除 | admin/manager |
| `/api/shifts/my` | GET | 自分のシフト取得 | 全員 |
| `/api/shifts/publish` | POST | シフト公開 | admin/manager |

**関連ファイル:**
- `src/app/(dashboard)/schedule/page.tsx`
- `src/components/schedule/`

**クエリパラメータ:**
```typescript
// GET /api/shifts
interface ShiftQueryParams {
  start_date: string;      // YYYY-MM-DD
  end_date: string;        // YYYY-MM-DD
  user_id?: string;        // 特定ユーザーのシフトのみ
  location_id?: string;    // 特定ロケーションのみ
  department_id?: string;  // 特定部署のみ
  status?: 'draft' | 'published';
}
```

---

#### 2.1.4 Shift Swaps API
シフト交換機能

| エンドポイント | メソッド | 説明 | ロール |
|--------------|--------|------|-------|
| `/api/shift-swaps` | GET | 交換リクエスト一覧 | 全員 |
| `/api/shift-swaps` | POST | 交換リクエスト作成 | 全員 |
| `/api/shift-swaps/[id]` | GET | 交換リクエスト詳細 | 全員 |
| `/api/shift-swaps/[id]/approve` | PUT | 承認 | 関係者/admin |
| `/api/shift-swaps/[id]/reject` | PUT | 拒否 | 関係者/admin |
| `/api/shift-swaps/settings` | GET | 交換設定取得 | 全員 |
| `/api/shift-swaps/settings` | PUT | 交換設定更新 | admin |

**関連ファイル:**
- `src/app/(dashboard)/shift-swaps/page.tsx`
- `src/components/shift-swaps/`

---

### 2.2 優先度: 中（Phase 2）

#### 2.2.1 Team API
チーム・従業員管理

| エンドポイント | メソッド | 説明 | ロール |
|--------------|--------|------|-------|
| `/api/team/members` | GET | チームメンバー一覧 | admin/manager |
| `/api/team/members/[id]` | GET | メンバー詳細 | admin/manager |
| `/api/team/members/[id]` | PUT | メンバー更新 | admin |
| `/api/team/members/[id]` | DELETE | メンバー無効化 | admin |
| `/api/team/invitations` | GET | 招待一覧 | admin |
| `/api/team/invitations` | POST | 招待作成 | admin |
| `/api/team/invitations/[id]` | DELETE | 招待取消 | admin |
| `/api/team/positions` | GET | ポジション一覧 | 全員 |

**関連ファイル:**
- `src/app/(dashboard)/team/page.tsx`
- `src/components/team/`

---

#### 2.2.2 Chat API
メッセージング機能

| エンドポイント | メソッド | 説明 | ロール |
|--------------|--------|------|-------|
| `/api/chat/rooms` | GET | チャットルーム一覧 | 全員 |
| `/api/chat/rooms` | POST | ルーム作成 | 全員 |
| `/api/chat/rooms/[id]` | GET | ルーム詳細 | 参加者 |
| `/api/chat/rooms/[id]/messages` | GET | メッセージ取得 | 参加者 |
| `/api/chat/rooms/[id]/messages` | POST | メッセージ送信 | 参加者 |
| `/api/chat/rooms/[id]/participants` | GET | 参加者一覧 | 参加者 |
| `/api/chat/rooms/[id]/participants` | POST | 参加者追加 | 作成者/admin |
| `/api/chat/rooms/[id]/read` | POST | 既読マーク | 参加者 |

**関連ファイル:**
- `src/app/(dashboard)/chat/page.tsx`
- `src/components/chat/`

**リアルタイム通信:**
- Supabase Realtimeを使用
- Flutterは`supabase_flutter`パッケージでWebSocket接続

---

#### 2.2.3 Profile API
ユーザープロファイル

| エンドポイント | メソッド | 説明 | ロール |
|--------------|--------|------|-------|
| `/api/profile` | GET | 自分のプロファイル取得 | 全員 |
| `/api/profile` | PUT | プロファイル更新 | 全員 |
| `/api/profile/avatar` | POST | アバター画像アップロード | 全員 |
| `/api/profile/locations` | GET | 割り当てロケーション取得 | 全員 |
| `/api/profile/department` | GET | 所属部署取得 | 全員 |

**関連ファイル:**
- `src/app/(dashboard)/profile/page.tsx`
- `src/components/profile/`

---

#### 2.2.4 Tasks API
タスク管理

| エンドポイント | メソッド | 説明 | ロール |
|--------------|--------|------|-------|
| `/api/tasks` | GET | タスク一覧 | 全員 |
| `/api/tasks` | POST | タスク作成 | admin/manager |
| `/api/tasks/[id]` | GET | タスク詳細 | 全員 |
| `/api/tasks/[id]` | PUT | タスク更新 | admin/manager |
| `/api/tasks/[id]` | DELETE | タスク削除 | admin/manager |
| `/api/tasks/[id]/status` | PUT | ステータス更新 | 担当者 |
| `/api/tasks/[id]/assignments` | POST | 担当者割り当て | admin/manager |

**関連ファイル:**
- `src/app/(dashboard)/tasks/page.tsx`
- `src/components/tasks/`

---

### 2.3 優先度: 低（Phase 3）

#### 2.3.1 Organization API
組織管理（管理者のみ）

| エンドポイント | メソッド | 説明 | ロール |
|--------------|--------|------|-------|
| `/api/organization` | GET | 組織情報取得 | admin |
| `/api/organization` | PUT | 組織情報更新 | admin |
| `/api/organization/locations` | GET | ロケーション一覧 | admin |
| `/api/organization/locations` | POST | ロケーション作成 | admin |
| `/api/organization/locations/[id]` | PUT | ロケーション更新 | admin |
| `/api/organization/locations/[id]` | DELETE | ロケーション削除 | admin |
| `/api/organization/departments` | GET | 部署一覧 | admin |
| `/api/organization/departments` | POST | 部署作成 | admin |
| `/api/organization/departments/[id]` | PUT | 部署更新 | admin |
| `/api/organization/departments/[id]` | DELETE | 部署削除 | admin |
| `/api/organization/positions` | GET | ポジション一覧 | admin |
| `/api/organization/positions` | POST | ポジション作成 | admin |
| `/api/organization/positions/[id]` | PUT | ポジション更新 | admin |
| `/api/organization/positions/[id]` | DELETE | ポジション削除 | admin |

**関連ファイル:**
- `src/app/(dashboard)/organization/page.tsx`
- `src/components/organization/`

---

#### 2.3.2 Settings API
設定管理

| エンドポイント | メソッド | 説明 | ロール |
|--------------|--------|------|-------|
| `/api/settings/notifications` | GET | 通知設定取得 | 全員 |
| `/api/settings/notifications` | PUT | 通知設定更新 | 全員 |
| `/api/settings/organization/schedule` | GET | スケジュール設定取得 | admin |
| `/api/settings/organization/schedule` | PUT | スケジュール設定更新 | admin |
| `/api/settings/organization/shift-swap` | GET | シフト交換設定取得 | admin |
| `/api/settings/organization/shift-swap` | PUT | シフト交換設定更新 | admin |

**関連ファイル:**
- `src/app/(dashboard)/settings/page.tsx`
- `src/components/settings/`

---

#### 2.3.3 Reports API
レポート・分析

| エンドポイント | メソッド | 説明 | ロール |
|--------------|--------|------|-------|
| `/api/reports/summary` | GET | サマリーメトリクス | admin/manager |
| `/api/reports/work-hours` | GET | 勤務時間レポート | admin/manager |
| `/api/reports/shift-coverage` | GET | シフトカバー率 | admin/manager |
| `/api/reports/pto-breakdown` | GET | PTO使用状況 | admin/manager |
| `/api/reports/attendance` | GET | 出勤状況レポート | admin/manager |

**関連ファイル:**
- `src/app/(dashboard)/reports/page.tsx`
- `src/components/reports/`

---

#### 2.3.4 Audit Logs API
監査ログ

| エンドポイント | メソッド | 説明 | ロール |
|--------------|--------|------|-------|
| `/api/audit-logs` | GET | 監査ログ一覧 | admin |
| `/api/audit-logs/[id]` | GET | 監査ログ詳細 | admin |

**関連ファイル:**
- `src/app/(dashboard)/audit-logs/page.tsx`

---

#### 2.3.5 Forms API
フォーム管理

| エンドポイント | メソッド | 説明 | ロール |
|--------------|--------|------|-------|
| `/api/forms/templates` | GET | フォームテンプレート一覧 | 全員 |
| `/api/forms/templates/[id]` | GET | テンプレート詳細 | 全員 |
| `/api/forms/submissions` | GET | 提出一覧 | 全員(自分)/admin(全員) |
| `/api/forms/submissions` | POST | フォーム提出 | 全員 |
| `/api/forms/submissions/[id]` | GET | 提出詳細 | 全員 |

**関連ファイル:**
- `src/app/(dashboard)/forms/page.tsx`
- `src/components/forms/`

---

## 3. 実装パターン

### 3.1 ファイル構造
```
src/app/api/
├── shared/
│   ├── auth.ts          # 認証ヘルパー（実装済み）
│   └── rbac.ts          # 権限チェック（実装済み）
├── dashboard/
│   ├── summary/route.ts
│   └── today-shifts/route.ts
├── time-clock/
│   ├── status/route.ts
│   ├── clock-in/route.ts
│   ├── clock-out/route.ts
│   ├── break-start/route.ts
│   └── break-end/route.ts
├── shifts/
│   ├── route.ts
│   ├── [id]/route.ts
│   ├── my/route.ts
│   └── publish/route.ts
├── shift-swaps/
│   ├── route.ts
│   ├── [id]/route.ts
│   ├── [id]/approve/route.ts
│   ├── [id]/reject/route.ts
│   └── settings/route.ts
├── team/
│   ├── members/route.ts
│   ├── members/[id]/route.ts
│   ├── invitations/route.ts
│   ├── invitations/[id]/route.ts
│   └── positions/route.ts
├── chat/
│   ├── rooms/route.ts
│   ├── rooms/[id]/route.ts
│   ├── rooms/[id]/messages/route.ts
│   ├── rooms/[id]/participants/route.ts
│   └── rooms/[id]/read/route.ts
├── profile/
│   ├── route.ts
│   ├── avatar/route.ts
│   ├── locations/route.ts
│   └── department/route.ts
├── tasks/
│   ├── route.ts
│   ├── [id]/route.ts
│   ├── [id]/status/route.ts
│   └── [id]/assignments/route.ts
├── organization/
│   ├── route.ts
│   ├── locations/route.ts
│   ├── locations/[id]/route.ts
│   ├── departments/route.ts
│   ├── departments/[id]/route.ts
│   ├── positions/route.ts
│   └── positions/[id]/route.ts
├── settings/
│   ├── notifications/route.ts
│   └── organization/
│       ├── schedule/route.ts
│       └── shift-swap/route.ts
├── reports/
│   ├── summary/route.ts
│   ├── work-hours/route.ts
│   ├── shift-coverage/route.ts
│   ├── pto-breakdown/route.ts
│   └── attendance/route.ts
├── audit-logs/
│   ├── route.ts
│   └── [id]/route.ts
└── forms/
    ├── templates/route.ts
    ├── templates/[id]/route.ts
    ├── submissions/route.ts
    └── submissions/[id]/route.ts
```

### 3.2 標準APIパターン
```typescript
import { NextRequest, NextResponse } from "next/server";
import { authenticateAndAuthorize } from "@/app/api/shared/auth";
import { isPrivilegedUser } from "@/app/api/shared/rbac";

export async function GET(request: NextRequest) {
  try {
    const { error: authError, user, profile, supabase } =
      await authenticateAndAuthorize(request);

    if (authError || !user || !profile || !supabase) {
      return authError || NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 権限チェック（必要な場合）
    if (!isPrivilegedUser(profile.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // データ取得
    const { data, error: fetchError } = await supabase
      .from("table_name")
      .select("*")
      .eq("organization_id", profile.organization_id);

    if (fetchError) {
      console.error("Error:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch data" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### 3.3 レスポンス形式
```typescript
// 成功時
{
  "success": true,
  "data": { ... } | [ ... ]
}

// ページネーション付き
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}

// エラー時
{
  "success": false,
  "error": "Error message",
  "details": { ... }  // オプション
}
```

---

## 4. 実装スケジュール

### Phase 1（優先度: 高）
**目標**: モバイルアプリで基本的な勤怠管理が可能になる

| 機能 | API数 | 関連ページ |
|-----|------|----------|
| Dashboard | 2 | dashboard/page.tsx |
| Time Clock | 6 | dashboard/page.tsx |
| Shifts | 7 | schedule/page.tsx |
| Shift Swaps | 7 | shift-swaps/page.tsx |
| **合計** | **22** | |

### Phase 2（優先度: 中）
**目標**: チーム管理とコミュニケーション機能

| 機能 | API数 | 関連ページ |
|-----|------|----------|
| Team | 8 | team/page.tsx |
| Chat | 8 | chat/page.tsx |
| Profile | 5 | profile/page.tsx |
| Tasks | 7 | tasks/page.tsx |
| **合計** | **28** | |

### Phase 3（優先度: 低）
**目標**: 管理機能の完全化

| 機能 | API数 | 関連ページ |
|-----|------|----------|
| Organization | 14 | organization/page.tsx |
| Settings | 6 | settings/page.tsx |
| Reports | 5 | reports/page.tsx |
| Audit Logs | 2 | audit-logs/page.tsx |
| Forms | 5 | forms/page.tsx |
| **合計** | **32** | |

---

## 5. 注意事項

### 5.1 セキュリティ
- すべてのAPIで`authenticateAndAuthorize`を使用
- organization_idによるデータ分離を徹底
- 管理者専用エンドポイントは`isPrivilegedUser`でチェック
- SQLインジェクション対策（Supabaseのクエリビルダー使用）

### 5.2 パフォーマンス
- 一覧取得APIにはページネーションを実装
- 不要なJOINを避ける
- 適切なインデックスの確認

### 5.3 互換性
- ReactアプリとFlutterアプリで同じAPIを使用
- レスポンス形式を統一
- 後方互換性を維持

### 5.4 テスト
- 各APIのユニットテスト
- 認証テスト（Bearer token / Cookie）
- 権限テスト（各ロールでのアクセス）

---

## 6. 既存実装済みAPI一覧

以下のAPIは実装・更新済みでFlutter対応完了:

### PTO関連
- ✅ `GET/POST /api/pto/requests`
- ✅ `GET/PUT/DELETE /api/pto/requests/[id]`
- ✅ `PUT /api/pto/requests/[id]/approve`
- ✅ `PUT /api/pto/requests/[id]/reject`
- ✅ `GET /api/pto/balance`
- ✅ `POST /api/pto/balance/initialize`
- ✅ `GET/POST/PUT /api/pto/policies`

### Timesheets関連
- ✅ `GET/POST /api/timesheets`
- ✅ `GET/PUT/DELETE /api/timesheets/[id]`
- ✅ `PUT /api/timesheets/[id]/approve`
- ✅ `PUT /api/timesheets/[id]/reject`
- ✅ `GET /api/timesheets/[id]/export`
- ✅ `PUT /api/timesheets/entries/[id]`
- ✅ `POST /api/timesheets/generate`
- ✅ `GET /api/timesheets/export`

### Auth関連
- ✅ `POST /api/auth/signout`
- ✅ `POST /api/invitations/accept`

---

## 7. 更新履歴

| 日付 | バージョン | 内容 |
|-----|----------|------|
| 2026-01-16 | 1.0 | 初版作成 |
