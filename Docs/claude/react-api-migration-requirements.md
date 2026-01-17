# React API統一化 改修要件定義書

## 概要

ReactフロントエンドをSupabase直接接続からAPI経由に統一するための改修要件を定義する。

### 目的
- ReactとFlutterでAPI層を共有し、ビジネスロジックを集約
- RLS (Row Level Security) 問題の回避
- セキュリティの向上とコードの一貫性確保

### 現状
| クライアント | 接続方式 |
|-------------|---------|
| React (Web) | Supabase Client直接接続 |
| Flutter (Mobile) | API経由 |

### 目標
| クライアント | 接続方式 |
|-------------|---------|
| React (Web) | API経由 |
| Flutter (Mobile) | API経由 |

---

## 現状分析

### 既存API一覧 (77エンドポイント)

#### Dashboard API
- `GET /api/dashboard/summary` - ダッシュボード概要
- `GET /api/dashboard/today-shifts` - 本日のシフト

#### Time Clock API
- `GET /api/time-clock/status` - 打刻状態取得
- `POST /api/time-clock/clock-in` - 出勤打刻
- `POST /api/time-clock/clock-out` - 退勤打刻
- `POST /api/time-clock/break-start` - 休憩開始
- `POST /api/time-clock/break-end` - 休憩終了
- `GET /api/time-entries` - 打刻履歴

#### Shifts API
- `GET /api/shifts` - シフト一覧
- `POST /api/shifts` - シフト作成
- `GET /api/shifts/my` - 自分のシフト
- `POST /api/shifts/publish` - シフト公開
- `GET /api/shifts/[id]` - シフト詳細
- `PUT /api/shifts/[id]` - シフト更新
- `DELETE /api/shifts/[id]` - シフト削除

#### Shift Swaps API
- `GET /api/shift-swaps` - シフト交換一覧
- `POST /api/shift-swaps` - シフト交換申請
- `GET /api/shift-swaps/settings` - 交換設定取得
- `PUT /api/shift-swaps/settings` - 交換設定更新
- `GET /api/shift-swaps/[id]` - 交換詳細
- `PUT /api/shift-swaps/[id]/approve` - 交換承認
- `PUT /api/shift-swaps/[id]/reject` - 交換却下

#### Team API
- `GET /api/team/members` - メンバー一覧
- `GET /api/team/members/[id]` - メンバー詳細
- `PUT /api/team/members/[id]` - メンバー更新
- `DELETE /api/team/members/[id]` - メンバー削除
- `GET /api/team/invitations` - 招待一覧
- `POST /api/team/invitations` - 招待作成
- `DELETE /api/team/invitations/[id]` - 招待削除
- `GET /api/team/positions` - ポジション一覧

#### Chat API
- `GET /api/chat/rooms` - チャットルーム一覧
- `POST /api/chat/rooms` - チャットルーム作成
- `GET /api/chat/rooms/[id]` - チャットルーム詳細
- `GET /api/chat/rooms/[id]/messages` - メッセージ一覧
- `POST /api/chat/rooms/[id]/messages` - メッセージ送信
- `GET /api/chat/rooms/[id]/participants` - 参加者一覧
- `POST /api/chat/rooms/[id]/participants` - 参加者追加
- `POST /api/chat/rooms/[id]/read` - 既読処理

#### Profile API
- `GET /api/profile` - プロフィール取得
- `PUT /api/profile` - プロフィール更新
- `POST /api/profile/avatar` - アバターアップロード
- `GET /api/profile/locations` - 所属ロケーション
- `GET /api/profile/department` - 所属部署

#### Tasks API
- `GET /api/tasks` - タスク一覧
- `POST /api/tasks` - タスク作成
- `GET /api/tasks/[id]` - タスク詳細
- `PUT /api/tasks/[id]` - タスク更新
- `DELETE /api/tasks/[id]` - タスク削除
- `PUT /api/tasks/[id]/status` - ステータス更新
- `POST /api/tasks/[id]/assignments` - 担当者割り当て

#### Organization API
- `GET /api/organization` - 組織情報取得
- `PUT /api/organization` - 組織情報更新
- `GET /api/organization/locations` - ロケーション一覧
- `POST /api/organization/locations` - ロケーション作成
- `PUT /api/organization/locations/[id]` - ロケーション更新
- `DELETE /api/organization/locations/[id]` - ロケーション削除
- `GET /api/organization/departments` - 部署一覧
- `POST /api/organization/departments` - 部署作成
- `PUT /api/organization/departments/[id]` - 部署更新
- `DELETE /api/organization/departments/[id]` - 部署削除
- `GET /api/organization/positions` - 職種一覧
- `POST /api/organization/positions` - 職種作成
- `PUT /api/organization/positions/[id]` - 職種更新
- `DELETE /api/organization/positions/[id]` - 職種削除

#### Settings API
- `GET /api/settings/notifications` - 通知設定取得
- `PUT /api/settings/notifications` - 通知設定更新
- `GET /api/settings/organization/schedule` - スケジュール設定取得
- `PUT /api/settings/organization/schedule` - スケジュール設定更新
- `GET /api/settings/organization/shift-swap` - シフト交換設定取得
- `PUT /api/settings/organization/shift-swap` - シフト交換設定更新

#### Reports API
- `GET /api/reports/summary` - レポート概要
- `GET /api/reports/work-hours` - 労働時間レポート
- `GET /api/reports/shift-coverage` - シフトカバー率
- `GET /api/reports/pto-breakdown` - PTO内訳
- `GET /api/reports/attendance` - 出勤レポート

#### Audit Logs API
- `GET /api/audit-logs` - 監査ログ一覧
- `GET /api/audit-logs/[id]` - 監査ログ詳細

#### Forms API
- `GET /api/forms/templates` - テンプレート一覧
- `POST /api/forms/templates` - テンプレート作成
- `GET /api/forms/templates/[id]` - テンプレート詳細
- `PUT /api/forms/templates/[id]` - テンプレート更新
- `DELETE /api/forms/templates/[id]` - テンプレート削除
- `GET /api/forms/submissions` - 提出一覧
- `POST /api/forms/submissions` - フォーム提出
- `GET /api/forms/submissions/[id]` - 提出詳細

#### Notifications API
- `GET /api/notifications` - 通知一覧
- `POST /api/notifications` - 通知作成
- `GET /api/notifications/[id]` - 通知詳細
- `PUT /api/notifications/[id]` - 通知更新
- `DELETE /api/notifications/[id]` - 通知削除
- `POST /api/notifications/read-all` - 全て既読

#### PTO API
- `GET /api/pto/balance` - PTO残高
- `POST /api/pto/balance/initialize` - PTO残高初期化
- `GET /api/pto/policies` - PTOポリシー一覧
- `GET /api/pto/requests` - PTO申請一覧
- `POST /api/pto/requests` - PTO申請
- `GET /api/pto/requests/[id]` - PTO申請詳細
- `PUT /api/pto/requests/[id]/approve` - PTO承認
- `PUT /api/pto/requests/[id]/reject` - PTO却下

#### Timesheets API
- `GET /api/timesheets` - タイムシート一覧
- `POST /api/timesheets/generate` - タイムシート生成
- `GET /api/timesheets/export` - エクスポート
- `GET /api/timesheets/[id]` - タイムシート詳細
- `PUT /api/timesheets/[id]/submit` - タイムシート提出
- `PUT /api/timesheets/[id]/approve` - タイムシート承認
- `PUT /api/timesheets/[id]/reject` - タイムシート却下
- `GET /api/timesheets/[id]/export` - 個別エクスポート
- `PUT /api/timesheets/entries/[id]` - エントリー更新

#### Invitations API
- `POST /api/invitations/accept` - 招待承諾

#### Auth API
- `POST /api/auth/signout` - サインアウト

---

## 改修対象コンポーネント

### Phase 1: 高優先度（即時対応必要）

#### 1.1 シフト交換コンポーネント
**ファイル**: `src/components/shift-swaps/shift-swaps-container.tsx`
**現状**: Supabase直接接続で複雑なクエリ実行
**操作**:
- `shift_swaps` SELECT/UPDATE
- `shifts` SELECT/UPDATE (user_id変更)
- `profiles` SELECT (リレーション)

**必要な追加API**:
| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/shift-swaps/[id]/accept` | PUT | 対象者の承諾 |
| `/api/shift-swaps/[id]/cancel` | PUT | 申請キャンセル |
| `/api/shift-swaps/[id]/apply` | PUT | スケジュールへの反映 |

**改修内容**:
- `fetchData()` → `GET /api/shift-swaps` 使用
- `handleApprove()` → `PUT /api/shift-swaps/[id]/approve` 使用
- `handleReject()` → `PUT /api/shift-swaps/[id]/reject` 使用
- `handleTargetAccept()` → 新規API `PUT /api/shift-swaps/[id]/accept`
- `handleCancel()` → 新規API `PUT /api/shift-swaps/[id]/cancel`
- `handleApplyToSchedule()` → 新規API `PUT /api/shift-swaps/[id]/apply`

---

#### 1.2 シフト交換リクエストダイアログ
**ファイル**: `src/components/shift-swaps/request-dialog.tsx`
**現状**: 交換申請をSupabase直接INSERT
**操作**:
- `shifts` SELECT
- `shift_swaps` INSERT
- `profiles` SELECT

**改修内容**:
- シフト取得 → `GET /api/shifts/my` or `GET /api/shifts`
- 交換申請 → `POST /api/shift-swaps`
- チームメンバー取得 → `GET /api/team/members`

---

#### 1.3 タイムクロックウィジェット
**ファイル**: `src/components/time-clock/widget.tsx`
**現状**: 打刻をSupabase直接INSERT
**操作**:
- `time_entries` INSERT
- `shifts` SELECT

**改修内容**:
- 出勤 → `POST /api/time-clock/clock-in`
- 退勤 → `POST /api/time-clock/clock-out`
- 休憩開始 → `POST /api/time-clock/break-start`
- 休憩終了 → `POST /api/time-clock/break-end`
- 状態取得 → `GET /api/time-clock/status`

---

#### 1.4 通知ドロップダウン
**ファイル**: `src/components/notifications/dropdown.tsx`
**現状**: Supabaseリアルタイムサブスクリプション使用
**操作**:
- `notifications` SELECT/UPDATE
- Realtime: INSERT監視

**必要な追加API**:
| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/notifications/unread-count` | GET | 未読数取得 |

**改修内容**:
- 通知一覧 → `GET /api/notifications`
- 既読更新 → `PUT /api/notifications/[id]`
- 全て既読 → `POST /api/notifications/read-all`
- リアルタイム → **Server-Sent Events (SSE) または Polling**

**注意**: リアルタイム通知はSSE/WebSocketまたはポーリングで実現

---

### Phase 2: 中優先度

#### 2.1 チャットコンポーネント
**ファイル**: `src/components/chat/room.tsx`, `src/components/chat/new-chat-dialog.tsx`
**操作**:
- `chat_rooms` SELECT/INSERT
- `chat_messages` SELECT/INSERT
- `chat_participants` SELECT/INSERT/UPDATE

**改修内容**:
- ルーム作成 → `POST /api/chat/rooms`
- メッセージ送信 → `POST /api/chat/rooms/[id]/messages`
- 既読更新 → `POST /api/chat/rooms/[id]/read`
- リアルタイム → **SSE/WebSocketまたはPolling**

---

#### 2.2 タスク管理コンポーネント
**ファイル**: `src/components/tasks/dashboard.tsx`, `src/components/tasks/task-dialog.tsx`
**操作**:
- `tasks` SELECT/INSERT/UPDATE/DELETE
- `task_assignments` SELECT/INSERT/DELETE

**必要な追加API**:
| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/tasks/[id]/assignments` | DELETE | 担当者削除 |

**改修内容**:
- 既存API使用で対応可能
- 担当者削除APIを追加

---

#### 2.3 PTOコンポーネント
**ファイル**: `src/components/pto/policy-manager.tsx`, `src/components/pto/balance-initialize-dialog.tsx`
**操作**:
- `pto_policies` SELECT/UPDATE/DELETE
- `pto_balances` SELECT/INSERT/UPDATE

**必要な追加API**:
| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/pto/policies` | POST | ポリシー作成 |
| `/api/pto/policies/[id]` | GET | ポリシー詳細 |
| `/api/pto/policies/[id]` | PUT | ポリシー更新 |
| `/api/pto/policies/[id]` | DELETE | ポリシー削除 |

**改修内容**:
- ポリシーCRUD APIを追加
- コンポーネントをAPI経由に変更

---

#### 2.4 チーム管理コンポーネント
**ファイル**: `src/components/team/dashboard.tsx`, `src/components/team/invite-dialog.tsx`
**操作**:
- `profiles` SELECT/UPDATE
- `employee_invitations` SELECT/INSERT/DELETE
- `departments` SELECT
- `positions` SELECT
- `locations` SELECT

**改修内容**:
- 既存API (`/api/team/*`) を使用
- 招待作成 → `POST /api/team/invitations`

---

### Phase 3: 低優先度

#### 3.1 レポートダッシュボード
**ファイル**: `src/components/reports/dashboard.tsx`
**操作**:
- `shifts` SELECT
- `time_entries` SELECT
- `pto_requests` SELECT
- `tasks` SELECT

**必要な追加API**:
| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/reports/dashboard` | GET | ダッシュボード用集計データ |

**改修内容**:
- 複合クエリをAPI側で処理
- フロントは集計済みデータを受け取る

---

#### 3.2 組織設定コンポーネント
**ファイル**: `src/components/organization/settings.tsx`
**操作**:
- `organizations` SELECT/UPDATE
- `locations` DELETE
- `departments` DELETE
- Storage: `organization-logos`

**必要な追加API**:
| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/organization/logo` | POST | ロゴアップロード |
| `/api/organization/logo` | DELETE | ロゴ削除 |

**改修内容**:
- ストレージ操作をAPI経由に
- 既存API使用で他は対応可能

---

#### 3.3 スケジュールカレンダー
**ファイル**: `src/components/schedule/calendar.tsx`
**操作**:
- `shifts` SELECT/INSERT/UPDATE/DELETE
- `shift_templates` SELECT

**必要な追加API**:
| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/shifts/templates` | GET | テンプレート一覧 |
| `/api/shifts/templates` | POST | テンプレート作成 |
| `/api/shifts/templates/[id]` | PUT | テンプレート更新 |
| `/api/shifts/templates/[id]` | DELETE | テンプレート削除 |
| `/api/shifts/bulk` | POST | 一括作成 |
| `/api/shifts/bulk` | DELETE | 一括削除 |

**改修内容**:
- シフトテンプレートAPI追加
- 一括操作API追加

---

#### 3.4 タイムシートコンポーネント
**ファイル**: `src/components/timesheets/timesheets-container.tsx`, `src/components/timesheets/detail.tsx`
**操作**:
- `time_entries` SELECT/UPDATE
- `shifts` SELECT

**改修内容**:
- 既存API (`/api/timesheets/*`) を使用
- エントリー更新 → `PUT /api/timesheets/entries/[id]`

---

#### 3.5 フォーム管理コンポーネント
**ファイル**: `src/components/forms/builder-dialog.tsx`, `src/components/forms/fill-dialog.tsx`
**操作**:
- `form_templates` SELECT/INSERT/UPDATE/DELETE
- `form_submissions` SELECT/INSERT

**改修内容**:
- 既存API (`/api/forms/*`) を使用

---

#### 3.6 プロフィール設定
**ファイル**: `src/components/profile/settings.tsx`
**操作**:
- `profiles` SELECT/UPDATE
- Storage: avatar

**改修内容**:
- プロフィール取得 → `GET /api/profile`
- プロフィール更新 → `PUT /api/profile`
- アバター更新 → `POST /api/profile/avatar`

---

#### 3.7 設定コンポーネント
**ファイル**: `src/components/settings/team-settings.tsx`, `src/components/settings/shift-swap-settings.tsx`
**操作**:
- `organizations` (settings column) UPDATE

**改修内容**:
- 既存API (`/api/settings/*`) を使用

---

#### 3.8 プッシュ通知Hook
**ファイル**: `src/hooks/use-push-notifications.ts`
**操作**:
- `push_subscriptions` UPSERT/DELETE

**必要な追加API**:
| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/push-subscriptions` | POST | 購読登録 |
| `/api/push-subscriptions` | DELETE | 購読解除 |

---

## 新規API追加一覧

### Phase 1で追加が必要なAPI

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/shift-swaps/[id]/accept` | PUT | 対象者によるシフト交換承諾 |
| `/api/shift-swaps/[id]/cancel` | PUT | シフト交換申請キャンセル |
| `/api/shift-swaps/[id]/apply` | PUT | 承認済み交換をスケジュールに反映 |
| `/api/notifications/unread-count` | GET | 未読通知数取得 |

### Phase 2で追加が必要なAPI

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/tasks/[id]/assignments` | DELETE | タスク担当者削除 |
| `/api/pto/policies` | POST | PTOポリシー作成 |
| `/api/pto/policies/[id]` | GET | PTOポリシー詳細 |
| `/api/pto/policies/[id]` | PUT | PTOポリシー更新 |
| `/api/pto/policies/[id]` | DELETE | PTOポリシー削除 |

### Phase 3で追加が必要なAPI

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/reports/dashboard` | GET | レポートダッシュボード集計 |
| `/api/organization/logo` | POST | 組織ロゴアップロード |
| `/api/organization/logo` | DELETE | 組織ロゴ削除 |
| `/api/shifts/templates` | GET | シフトテンプレート一覧 |
| `/api/shifts/templates` | POST | シフトテンプレート作成 |
| `/api/shifts/templates/[id]` | PUT | シフトテンプレート更新 |
| `/api/shifts/templates/[id]` | DELETE | シフトテンプレート削除 |
| `/api/shifts/bulk` | POST | シフト一括作成 |
| `/api/shifts/bulk` | DELETE | シフト一括削除 |
| `/api/push-subscriptions` | POST | プッシュ購読登録 |
| `/api/push-subscriptions` | DELETE | プッシュ購読解除 |

---

## リアルタイム機能の対応方針

### 現状のリアルタイム機能
1. **通知**: `notifications` テーブルのINSERT監視
2. **チャット**: `chat_messages` テーブルの変更監視

### 対応オプション

#### オプション1: Server-Sent Events (SSE)
- サーバーからクライアントへの一方向ストリーミング
- 軽量で実装が比較的簡単
- 通知やチャットメッセージの配信に適している

#### オプション2: WebSocket
- 双方向通信
- より複雑だが高機能
- チャットに最適

#### オプション3: Polling
- 定期的にAPIを呼び出し
- 最もシンプル
- リアルタイム性が低下するがトレードオフとして許容可能

### 推奨アプローチ
1. **通知**: Polling (10秒間隔) または SSE
2. **チャット**: SSE または Polling (5秒間隔)

---

## フロントエンド共通実装

### API呼び出しユーティリティ
`src/lib/api-client.ts` を作成し、共通のfetch処理を実装:

```typescript
// 実装予定の機能
- 認証トークン自動付与
- エラーハンドリング
- レスポンス型定義
- リトライロジック
```

### 認証トークン管理
- Supabase sessionからaccess_tokenを取得
- AuthorizationヘッダーにBearer tokenとして付与
- Cookieも併用（SSRサポート）

---

## 実装順序

### Step 1: API追加 (Phase 1)
1. `/api/shift-swaps/[id]/accept`
2. `/api/shift-swaps/[id]/cancel`
3. `/api/shift-swaps/[id]/apply`
4. `/api/notifications/unread-count`

### Step 2: APIクライアント作成
1. `src/lib/api-client.ts` 作成
2. 型定義追加

### Step 3: コンポーネント改修 (Phase 1)
1. `shift-swaps/shift-swaps-container.tsx`
2. `shift-swaps/request-dialog.tsx`
3. `time-clock/widget.tsx`
4. `notifications/dropdown.tsx`

### Step 4: API追加 (Phase 2)
1. Tasks API拡張
2. PTO Policies API

### Step 5: コンポーネント改修 (Phase 2)
1. Chat components
2. Tasks components
3. PTO components
4. Team components

### Step 6: API追加 (Phase 3)
1. Reports dashboard API
2. Organization logo API
3. Shift templates API
4. Push subscriptions API

### Step 7: コンポーネント改修 (Phase 3)
1. Reports dashboard
2. Organization settings
3. Schedule calendar
4. Timesheets
5. Forms
6. Profile settings
7. Settings components
8. Push notifications hook

---

## テスト計画

### 単体テスト
- 各API エンドポイントのテスト
- 正常系・異常系のレスポンス確認

### 統合テスト
- コンポーネントからAPI呼び出しのE2Eテスト
- 認証フローのテスト

### 回帰テスト
- 既存機能が正常に動作することを確認
- FlutterアプリへのAPI影響確認

---

## リスクと対策

| リスク | 影響度 | 対策 |
|-------|-------|------|
| パフォーマンス低下 | 中 | APIレスポンスキャッシュ、SWR/React Query活用 |
| リアルタイム性低下 | 中 | SSE実装、適切なPolling間隔設定 |
| 改修漏れ | 高 | 段階的リリース、十分なテスト |
| 認証トークン管理 | 中 | 共通ユーティリティで一元管理 |

---

## 完了基準

1. すべてのReactコンポーネントがAPI経由でデータアクセス
2. Supabase Clientの直接使用がAPI層のみに限定
3. 既存機能が正常に動作
4. TypeScriptコンパイルエラーなし
5. 本番環境での動作確認完了

---

## スケジュール目安

| Phase | 内容 | 工数目安 |
|-------|------|---------|
| Phase 1 | 高優先度コンポーネント | 3-4日 |
| Phase 2 | 中優先度コンポーネント | 3-4日 |
| Phase 3 | 低優先度コンポーネント | 4-5日 |
| テスト・修正 | 全体テストと修正 | 2-3日 |
| **合計** | | **12-16日** |

---

## 改訂履歴

| 日付 | バージョン | 変更内容 |
|------|----------|---------|
| 2026-01-16 | 1.0 | 初版作成 |
