# シフト管理アプリ 開発要件定義書

**バージョン:** 1.2.1
**作成日:** 2026-01-08
**最終更新:** 2026-01-08
**プロジェクト名:** Shift Management App

---

## 1. プロジェクト概要

### 1.1 目的
従業員のシフト管理、勤怠管理、コミュニケーションを一元化し、管理者と従業員双方の業務効率化を実現するWebアプリケーションを開発する。

### 1.2 技術スタック

#### Web アプリケーション
| カテゴリ | 技術 |
|---------|------|
| フロントエンド | Next.js 14+ (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| ホスティング | Vercel (予定) |

#### モバイルアプリケーション（将来対応）
| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Flutter |
| 言語 | Dart |
| 状態管理 | Riverpod / Bloc (TBD) |

#### バックエンド共通
| カテゴリ | 技術 |
|---------|------|
| データベース | Supabase (PostgreSQL) |
| 認証 | Supabase Auth (Google OAuth, Email) |
| API | Supabase Edge Functions (Deno) |
| リアルタイム通信 | Supabase Realtime |
| ストレージ | Supabase Storage |

### 1.3 Supabase プロジェクト情報
| 項目 | 値 |
|------|-----|
| Project ID | `lnqftimrbtnysnibpvlv` |
| Organization | Sciometa Oy |
| Region | ap-northeast-1 (Tokyo) |

---

## 2. ユーザーロール

### 2.1 管理者 (Admin)
- 全機能へのフルアクセス
- 従業員の追加・編集・削除
- シフトの作成・編集・承認
- レポートの閲覧・ダウンロード
- システム設定の管理
- ジオフェンス設定の管理

### 2.2 マネージャー (Manager) - 推奨追加
- 担当チーム/部署のシフト管理
- 担当チームのレポート閲覧
- PTO申請の承認
- 限定的な従業員情報の編集

### 2.3 従業員 (Employee)
- 自身のシフト確認
- 打刻（出勤・退勤）
- PTO申請
- シフト交換リクエスト
- チャット機能の利用
- 自身のタイムシート確認

---

## 3. 機能要件

### 3.1 認証・ユーザー管理

#### 3.1.1 ログイン機能
- Google OAuth による認証
- メールアドレス・パスワードによる認証
- セッション管理（JWT）
- ログイン状態の永続化（Remember Me）
- パスワードリセット機能

#### 3.1.2 サインアップ機能
- メールアドレスによる新規登録
- メール認証（Email Verification）
- 招待リンクによる登録フロー

#### 3.1.3 従業員招待機能
- 管理者による従業員情報の事前登録
- 登録メールアドレスへの招待メール送信
- 招待リンクの有効期限管理
- 招待ステータスの追跡（Pending/Accepted/Expired）

---

### 3.2 GPS打刻・ジオフェンシング

#### 3.2.1 GPS打刻（Time Clock）
- リアルタイム位置情報取得
- 出勤・退勤の打刻
- 休憩開始・終了の打刻
- 打刻時の位置情報記録
- オフライン打刻対応（同期機能）

#### 3.2.2 ジオフェンシング
- 勤務地の座標・半径設定
- 複数勤務地の登録
- ジオフェンス内外の判定
- フェンス外打刻時のアラート・制限オプション
- 位置情報履歴の記録

---

### 3.3 シフトスケジューラー

#### 3.3.1 ドラッグ＆ドロップスケジューラー
- カレンダービュー（日/週/月）
- 従業員ごとのシフト表示
- ドラッグ＆ドロップでのシフト作成・移動
- シフトの複製機能
- シフトテンプレートの保存・適用
- 繰り返しシフトの設定

#### 3.3.2 シフト情報
- 開始・終了時刻
- 休憩時間
- 勤務地
- 担当業務・ポジション
- 必要スキル
- メモ・備考

#### 3.3.3 シフト公開・通知
- シフトの下書き・公開ステータス
- 公開時の従業員への通知
- シフト変更時の通知

---

### 3.4 PTO（有給休暇）管理

#### 3.4.1 PTO申請
- 休暇タイプの選択（有給/病欠/その他）
- 日付範囲の指定
- 理由・コメントの入力
- 添付ファイル（診断書等）

#### 3.4.2 PTO承認フロー
- 申請のレビュー
- 承認/却下/保留ステータス
- 承認者コメント
- 申請者への通知

#### 3.4.3 PTO残高管理
- 従業員ごとの有給残日数
- 年次付与の自動計算
- 繰越ルールの設定
- 残高アラート

---

### 3.5 タイムシート・リマインダー

#### 3.5.1 自動タイムシート生成
- 打刻データからの自動集計
- 日次/週次/月次のタイムシート
- 労働時間の自動計算
- 残業時間の自動算出
- タイムシートの承認フロー

#### 3.5.2 シフトリマインダー
- シフト開始前の通知（設定可能な時間）
- 未打刻アラート
- シフト終了時の退勤リマインダー
- プッシュ通知/メール通知の選択

---

### 3.6 タスク・フォーム・チェックリスト

#### 3.6.1 シフト固有タスク
- シフトへのタスク割り当て
- タスクの優先度設定
- 期限設定
- 完了ステータス管理

#### 3.6.2 カスタムフォーム
- フォームビルダー（管理者用）
- 必須/任意フィールドの設定
- フィールドタイプ（テキスト/数値/選択/日付/写真）
- フォーム提出履歴

#### 3.6.3 チェックリスト
- チェックリストテンプレート
- シフトへのチェックリスト割り当て
- 進捗トラッキング
- 完了報告

---

### 3.7 アプリ内チャット

#### 3.7.1 メッセージング
- 1対1チャット
- グループチャット
- チャンネル（部署/チーム別）
- メッセージの既読ステータス
- リアルタイム配信（Supabase Realtime）

#### 3.7.2 メッセージ機能
- テキストメッセージ
- 画像・ファイル添付
- メンション機能（@ユーザー名）
- メッセージ検索
- 通知設定（ミュート等）

#### 3.7.3 アナウンスメント
- 全体アナウンス機能
- 重要メッセージのピン留め
- 既読確認

---

### 3.8 レポート機能

#### 3.8.1 レポートタイプ
- 勤怠サマリーレポート
- 残業レポート
- PTO使用状況レポート
- シフト充足率レポート
- 従業員別勤務時間レポート
- 人件費レポート

#### 3.8.2 レポートフィルター
- 期間指定
- 部署/チーム別
- 従業員別
- 勤務地別

#### 3.8.3 エクスポート機能
- PDF形式
- Excel形式（CSV/XLSX）
- 定期レポートの自動生成・メール送信

---

## 4. API設計

### 4.1 アーキテクチャ概要

```
┌─────────────────┐     ┌─────────────────┐
│   Next.js Web   │     │  Flutter Mobile │
│   Application   │     │   Application   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Supabase Edge       │
         │   Functions (API)     │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   Supabase      │     │   Supabase      │
│   PostgreSQL    │     │   Storage       │
└─────────────────┘     └─────────────────┘
```

**設計方針:**
- すべてのビジネスロジックはSupabase Edge Functions経由で実行
- クライアント（Web/Mobile）は直接DBアクセスせず、API経由でデータ操作
- 認証はSupabase Auth（JWT）を使用
- リアルタイム機能はSupabase Realtimeを直接使用（チャット、通知）

### 4.2 認証API

#### Base URL
```
https://lnqftimrbtnysnibpvlv.supabase.co/functions/v1
```

#### 認証ヘッダー
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

#### エンドポイント一覧

| メソッド | エンドポイント | 説明 | 認証 |
|----------|----------------|------|------|
| POST | `/auth/signup` | メール/パスワードでサインアップ | 不要 |
| POST | `/auth/login` | メール/パスワードでログイン | 不要 |
| POST | `/auth/login/google` | Google OAuthログイン | 不要 |
| POST | `/auth/logout` | ログアウト | 必要 |
| POST | `/auth/refresh` | トークンリフレッシュ | 必要 |
| POST | `/auth/reset-password` | パスワードリセット要求 | 不要 |
| POST | `/auth/update-password` | パスワード更新 | 必要 |
| GET | `/auth/me` | 現在のユーザー情報取得 | 必要 |

---

### 4.3 ユーザー・従業員管理API

| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/users` | ユーザー一覧取得 | Admin/Manager |
| GET | `/users/:id` | ユーザー詳細取得 | Admin/Manager/Self |
| POST | `/users` | ユーザー作成 | Admin |
| PUT | `/users/:id` | ユーザー更新 | Admin/Self |
| DELETE | `/users/:id` | ユーザー削除（論理削除） | Admin |
| GET | `/users/:id/profile` | プロフィール取得 | Admin/Manager/Self |
| PUT | `/users/:id/profile` | プロフィール更新 | Admin/Self |

#### 招待API
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| POST | `/invitations` | 従業員招待送信 | Admin |
| GET | `/invitations` | 招待一覧取得 | Admin |
| GET | `/invitations/:token` | 招待情報取得（トークンで） | 不要 |
| POST | `/invitations/:token/accept` | 招待受諾 | 不要 |
| DELETE | `/invitations/:id` | 招待取消 | Admin |
| POST | `/invitations/:id/resend` | 招待再送信 | Admin |

---

### 4.4 組織・部署・勤務地API

#### 組織
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/organizations/:id` | 組織情報取得 | All |
| PUT | `/organizations/:id` | 組織情報更新 | Admin |

#### 部署
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/departments` | 部署一覧取得 | All |
| GET | `/departments/:id` | 部署詳細取得 | All |
| POST | `/departments` | 部署作成 | Admin |
| PUT | `/departments/:id` | 部署更新 | Admin |
| DELETE | `/departments/:id` | 部署削除 | Admin |

#### 勤務地（ジオフェンス）
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/locations` | 勤務地一覧取得 | All |
| GET | `/locations/:id` | 勤務地詳細取得 | All |
| POST | `/locations` | 勤務地作成 | Admin |
| PUT | `/locations/:id` | 勤務地更新 | Admin |
| DELETE | `/locations/:id` | 勤務地削除 | Admin |
| POST | `/locations/validate-position` | 位置がジオフェンス内か検証 | All |

---

### 4.5 シフト管理API

| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/shifts` | シフト一覧取得（フィルター対応） | All |
| GET | `/shifts/:id` | シフト詳細取得 | All |
| POST | `/shifts` | シフト作成 | Admin/Manager |
| PUT | `/shifts/:id` | シフト更新 | Admin/Manager |
| DELETE | `/shifts/:id` | シフト削除 | Admin/Manager |
| POST | `/shifts/bulk` | シフト一括作成 | Admin/Manager |
| PUT | `/shifts/bulk` | シフト一括更新 | Admin/Manager |
| POST | `/shifts/:id/publish` | シフト公開 | Admin/Manager |
| POST | `/shifts/:id/unpublish` | シフト非公開 | Admin/Manager |
| GET | `/shifts/my` | 自分のシフト取得 | All |

#### シフトテンプレート
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/shift-templates` | テンプレート一覧 | Admin/Manager |
| POST | `/shift-templates` | テンプレート作成 | Admin/Manager |
| PUT | `/shift-templates/:id` | テンプレート更新 | Admin/Manager |
| DELETE | `/shift-templates/:id` | テンプレート削除 | Admin/Manager |
| POST | `/shift-templates/:id/apply` | テンプレート適用 | Admin/Manager |

#### シフト交換
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/shift-swaps` | 交換リクエスト一覧 | Admin/Manager |
| GET | `/shift-swaps/my` | 自分の交換リクエスト | All |
| POST | `/shift-swaps` | 交換リクエスト作成 | Employee |
| PUT | `/shift-swaps/:id/approve` | 交換承認 | Admin/Manager |
| PUT | `/shift-swaps/:id/reject` | 交換却下 | Admin/Manager |
| DELETE | `/shift-swaps/:id` | 交換リクエスト取消 | Employee |

---

### 4.6 打刻・勤怠API

#### タイムクロック（打刻）
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| POST | `/time-clock/clock-in` | 出勤打刻 | All |
| POST | `/time-clock/clock-out` | 退勤打刻 | All |
| POST | `/time-clock/break-start` | 休憩開始 | All |
| POST | `/time-clock/break-end` | 休憩終了 | All |
| GET | `/time-clock/status` | 現在の打刻状態取得 | All |
| POST | `/time-clock/sync` | オフライン打刻同期 | All |

**リクエストボディ例（打刻）:**
```json
{
  "shift_id": "uuid",
  "latitude": 35.6762,
  "longitude": 139.6503,
  "accuracy": 10.5,
  "timestamp": "2026-01-08T09:00:00Z",
  "device_info": {
    "platform": "ios",
    "version": "17.0"
  }
}
```

#### タイムエントリー
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/time-entries` | 打刻記録一覧 | Admin/Manager |
| GET | `/time-entries/:id` | 打刻記録詳細 | Admin/Manager/Self |
| PUT | `/time-entries/:id` | 打刻記録修正 | Admin/Manager |
| GET | `/time-entries/my` | 自分の打刻記録 | All |

#### タイムシート
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/timesheets` | タイムシート一覧 | Admin/Manager |
| GET | `/timesheets/:id` | タイムシート詳細 | Admin/Manager/Self |
| GET | `/timesheets/my` | 自分のタイムシート | All |
| POST | `/timesheets/:id/submit` | タイムシート提出 | Employee |
| PUT | `/timesheets/:id/approve` | タイムシート承認 | Admin/Manager |
| PUT | `/timesheets/:id/reject` | タイムシート却下 | Admin/Manager |
| GET | `/timesheets/generate` | タイムシート生成 | Admin/Manager |

---

### 4.7 PTO（有給休暇）API

#### PTO申請
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/pto-requests` | PTO申請一覧 | Admin/Manager |
| GET | `/pto-requests/:id` | PTO申請詳細 | Admin/Manager/Self |
| POST | `/pto-requests` | PTO申請作成 | All |
| PUT | `/pto-requests/:id` | PTO申請更新 | Self(Pending only) |
| DELETE | `/pto-requests/:id` | PTO申請取消 | Self(Pending only) |
| PUT | `/pto-requests/:id/approve` | PTO承認 | Admin/Manager |
| PUT | `/pto-requests/:id/reject` | PTO却下 | Admin/Manager |
| GET | `/pto-requests/my` | 自分のPTO申請 | All |

**リクエストボディ例（PTO申請）:**
```json
{
  "type": "paid_leave",
  "start_date": "2026-02-01",
  "end_date": "2026-02-03",
  "reason": "Family vacation",
  "attachment_urls": []
}
```

#### PTO残高
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/pto-balances` | 全員のPTO残高 | Admin/Manager |
| GET | `/pto-balances/:user_id` | 特定ユーザーのPTO残高 | Admin/Manager/Self |
| PUT | `/pto-balances/:user_id` | PTO残高調整 | Admin |
| GET | `/pto-balances/my` | 自分のPTO残高 | All |

#### PTO設定
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/pto-policies` | PTOポリシー取得 | Admin |
| PUT | `/pto-policies` | PTOポリシー更新 | Admin |

---

### 4.8 タスク・チェックリストAPI

#### タスク
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/tasks` | タスク一覧 | All |
| GET | `/tasks/:id` | タスク詳細 | All |
| POST | `/tasks` | タスク作成 | Admin/Manager |
| PUT | `/tasks/:id` | タスク更新 | Admin/Manager |
| DELETE | `/tasks/:id` | タスク削除 | Admin/Manager |
| PUT | `/tasks/:id/complete` | タスク完了 | All |
| GET | `/tasks/my` | 自分のタスク | All |
| GET | `/shifts/:shift_id/tasks` | シフトのタスク | All |

#### チェックリスト
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/checklists` | チェックリスト一覧 | All |
| GET | `/checklists/:id` | チェックリスト詳細 | All |
| POST | `/checklists` | チェックリスト作成 | Admin/Manager |
| PUT | `/checklists/:id` | チェックリスト更新 | Admin/Manager |
| DELETE | `/checklists/:id` | チェックリスト削除 | Admin/Manager |
| PUT | `/checklists/:id/items/:item_id/toggle` | アイテム完了切替 | All |
| GET | `/shifts/:shift_id/checklists` | シフトのチェックリスト | All |

#### カスタムフォーム
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/forms` | フォーム一覧 | All |
| GET | `/forms/:id` | フォーム詳細 | All |
| POST | `/forms` | フォーム作成 | Admin |
| PUT | `/forms/:id` | フォーム更新 | Admin |
| DELETE | `/forms/:id` | フォーム削除 | Admin |
| POST | `/forms/:id/submit` | フォーム提出 | All |
| GET | `/forms/:id/submissions` | フォーム提出一覧 | Admin/Manager |

---

### 4.9 チャットAPI

#### チャンネル
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/chat/channels` | チャンネル一覧 | All |
| GET | `/chat/channels/:id` | チャンネル詳細 | Member |
| POST | `/chat/channels` | チャンネル作成 | Admin/Manager |
| PUT | `/chat/channels/:id` | チャンネル更新 | Admin/Manager |
| DELETE | `/chat/channels/:id` | チャンネル削除 | Admin |
| POST | `/chat/channels/:id/join` | チャンネル参加 | All |
| POST | `/chat/channels/:id/leave` | チャンネル退出 | All |
| GET | `/chat/channels/:id/members` | メンバー一覧 | Member |
| POST | `/chat/channels/:id/members` | メンバー追加 | Admin/Manager |
| DELETE | `/chat/channels/:id/members/:user_id` | メンバー削除 | Admin/Manager |

#### メッセージ
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/chat/channels/:id/messages` | メッセージ一覧 | Member |
| POST | `/chat/channels/:id/messages` | メッセージ送信 | Member |
| PUT | `/chat/messages/:id` | メッセージ編集 | Author |
| DELETE | `/chat/messages/:id` | メッセージ削除 | Author/Admin |
| POST | `/chat/messages/:id/read` | 既読マーク | Member |
| GET | `/chat/messages/search` | メッセージ検索 | All |

**リクエストボディ例（メッセージ送信）:**
```json
{
  "content": "Hello team!",
  "type": "text",
  "attachment_urls": [],
  "mentions": ["user_uuid_1", "user_uuid_2"]
}
```

#### ダイレクトメッセージ
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/chat/dm` | DM一覧 | All |
| POST | `/chat/dm` | DM開始/取得 | All |
| GET | `/chat/dm/:id/messages` | DMメッセージ一覧 | Participant |
| POST | `/chat/dm/:id/messages` | DMメッセージ送信 | Participant |

#### アナウンスメント
| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/announcements` | アナウンス一覧 | All |
| GET | `/announcements/:id` | アナウンス詳細 | All |
| POST | `/announcements` | アナウンス作成 | Admin/Manager |
| PUT | `/announcements/:id` | アナウンス更新 | Admin/Manager |
| DELETE | `/announcements/:id` | アナウンス削除 | Admin/Manager |
| POST | `/announcements/:id/read` | 既読マーク | All |

---

### 4.10 通知API

| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/notifications` | 通知一覧 | All |
| GET | `/notifications/unread-count` | 未読数取得 | All |
| PUT | `/notifications/:id/read` | 既読マーク | Self |
| PUT | `/notifications/read-all` | 全て既読 | Self |
| DELETE | `/notifications/:id` | 通知削除 | Self |
| GET | `/notifications/settings` | 通知設定取得 | Self |
| PUT | `/notifications/settings` | 通知設定更新 | Self |
| POST | `/notifications/register-device` | デバイストークン登録 | All |
| DELETE | `/notifications/unregister-device` | デバイストークン解除 | All |

---

### 4.11 レポートAPI

| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/reports/attendance` | 勤怠サマリーレポート | Admin/Manager |
| GET | `/reports/overtime` | 残業レポート | Admin/Manager |
| GET | `/reports/pto-usage` | PTO使用状況レポート | Admin/Manager |
| GET | `/reports/shift-coverage` | シフト充足率レポート | Admin/Manager |
| GET | `/reports/labor-cost` | 人件費レポート | Admin |
| GET | `/reports/employee/:id` | 従業員別レポート | Admin/Manager |
| POST | `/reports/export` | レポートエクスポート | Admin/Manager |
| GET | `/reports/download/:id` | エクスポートファイルDL | Admin/Manager |

**クエリパラメータ例:**
```
?start_date=2026-01-01
&end_date=2026-01-31
&department_id=uuid
&location_id=uuid
&format=pdf|csv|xlsx
```

---

### 4.12 ダッシュボードAPI

| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/dashboard/admin` | 管理者ダッシュボード | Admin/Manager |
| GET | `/dashboard/employee` | 従業員ダッシュボード | All |
| GET | `/dashboard/realtime-status` | リアルタイム出勤状況 | Admin/Manager |
| GET | `/dashboard/kpi` | KPIデータ | Admin/Manager |
| GET | `/dashboard/alerts` | アラート一覧 | Admin/Manager |

---

### 4.13 設定API

| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| GET | `/settings/organization` | 組織設定取得 | Admin |
| PUT | `/settings/organization` | 組織設定更新 | Admin |
| GET | `/settings/compliance` | コンプライアンス設定 | Admin |
| PUT | `/settings/compliance` | コンプライアンス設定更新 | Admin |
| GET | `/settings/geofence` | ジオフェンス設定 | Admin |
| PUT | `/settings/geofence` | ジオフェンス設定更新 | Admin |

---

### 4.14 ファイルアップロードAPI

| メソッド | エンドポイント | 説明 | 権限 |
|----------|----------------|------|------|
| POST | `/files/upload` | ファイルアップロード | All |
| GET | `/files/:id` | ファイル取得 | All |
| DELETE | `/files/:id` | ファイル削除 | Owner/Admin |
| POST | `/files/upload-avatar` | アバター画像アップロード | All |

---

### 4.15 APIレスポンス形式

#### 成功レスポンス
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

#### エラーレスポンス
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

#### HTTPステータスコード
| コード | 説明 |
|--------|------|
| 200 | 成功 |
| 201 | 作成成功 |
| 400 | リクエストエラー |
| 401 | 認証エラー |
| 403 | 権限エラー |
| 404 | リソース不存在 |
| 409 | 競合エラー |
| 422 | バリデーションエラー |
| 429 | レート制限 |
| 500 | サーバーエラー |

---

### 4.16 リアルタイムサブスクリプション

Supabase Realtimeを使用してリアルタイム更新を実現。

#### チャンネル一覧
| チャンネル | イベント | 説明 |
|------------|----------|------|
| `shifts:org_id` | INSERT/UPDATE/DELETE | シフト変更 |
| `time_entries:org_id` | INSERT/UPDATE | 打刻イベント |
| `chat:channel_id` | INSERT | 新規メッセージ |
| `notifications:user_id` | INSERT | 新規通知 |
| `announcements:org_id` | INSERT | 新規アナウンス |
| `presence:org_id` | PRESENCE | オンライン状態 |

#### Flutter実装例
```dart
final channel = supabase.channel('shifts:${orgId}');
channel
  .onPostgresChanges(
    event: PostgresChangeEvent.all,
    schema: 'public',
    table: 'shifts',
    filter: PostgresChangeFilter(
      type: PostgresChangeFilterType.eq,
      column: 'organization_id',
      value: orgId,
    ),
    callback: (payload) {
      // Handle shift changes
    },
  )
  .subscribe();
```

---

### 4.17 レート制限

| エンドポイントカテゴリ | 制限 |
|------------------------|------|
| 認証 | 10 req/min per IP |
| 一般API | 100 req/min per user |
| レポート生成 | 10 req/hour per user |
| ファイルアップロード | 30 req/hour per user |
| チャット | 60 messages/min per user |

---

## 5. 推奨追加機能

### 5.1 ダッシュボード
- 管理者ダッシュボード（KPI概要、アラート、クイックアクション）
- 従業員ダッシュボード（今日のシフト、タスク、通知）
- リアルタイム出勤状況

### 5.2 シフト交換リクエスト
- 従業員間のシフト交換申請
- 管理者承認フロー
- 交換候補の自動提案

### 5.3 労働法コンプライアンス
- 残業時間アラート
- 連続勤務日数警告
- 休憩時間の自動確認
- 労働基準法に基づくルール設定

### 5.4 カレンダー連携
- Google Calendar連携
- Outlook Calendar連携
- iCal形式エクスポート

### 5.5 PWA対応
- オフライン機能
- プッシュ通知
- ホーム画面への追加
- モバイルファースト設計

### 5.6 給与計算連携（将来機能）
- 給与計算システムへのデータエクスポート
- API連携

### 5.7 分析・インサイト
- シフトパターン分析
- 欠勤傾向分析
- 人員配置最適化提案

---

## 6. 非機能要件

### 6.1 パフォーマンス
- ページロード時間: 3秒以内
- API応答時間: 500ms以内
- 同時接続ユーザー: 1000人以上対応

### 6.2 セキュリティ
- HTTPS通信の強制
- Row Level Security (RLS) の実装
- XSS/CSRF対策
- 個人情報の暗号化
- アクセスログの記録
- 定期的なセキュリティ監査

### 6.3 可用性
- 稼働率: 99.9%以上
- 自動バックアップ（Supabase標準）
- 障害時の通知システム

### 6.4 ユーザビリティ
- レスポンシブデザイン（PC/タブレット/スマートフォン）
- アクセシビリティ対応（WCAG 2.1 AA準拠）
- 直感的なUI/UX

---

## 7. データベース設計

### 7.1 ER図（概要）

```
┌─────────────────┐       ┌─────────────────┐
│  organizations  │───1:N─│   departments   │
└────────┬────────┘       └────────┬────────┘
         │1:N                      │1:N
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│    locations    │       │     profiles    │───1:1───┐
└─────────────────┘       └─────────────────┘         │
         │                         │                   ▼
         │                         │1:N       ┌─────────────────┐
         │                         ▼          │      users      │
         │                ┌─────────────────┐ │  (Supabase Auth)│
         │                │     shifts      │ └─────────────────┘
         │                └────────┬────────┘
         │                         │
         └────────────────────N:1──┘
                                   │1:N
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  time_entries   │       │      tasks      │       │   checklists    │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

### 7.2 テーブル定義

#### 7.2.1 organizations（組織）
| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | 組織ID |
| name | VARCHAR(255) | NOT NULL | 組織名 |
| slug | VARCHAR(100) | UNIQUE, NOT NULL | URLスラッグ |
| logo_url | TEXT | | ロゴ画像URL |
| timezone | VARCHAR(50) | DEFAULT 'Asia/Tokyo' | タイムゾーン |
| locale | VARCHAR(10) | DEFAULT 'en' | ロケール |
| settings | JSONB | DEFAULT '{}' | 組織設定（JSON） |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新日時 |

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  timezone VARCHAR(50) DEFAULT 'Asia/Tokyo',
  locale VARCHAR(10) DEFAULT 'en',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
```

---

#### 7.2.2 profiles（ユーザープロフィール）
| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| id | UUID | PK, FK(auth.users) | ユーザーID |
| organization_id | UUID | FK(organizations), NOT NULL | 所属組織ID |
| department_id | UUID | FK(departments) | 所属部署ID |
| employee_code | VARCHAR(50) | | 従業員番号 |
| first_name | VARCHAR(100) | NOT NULL | 名 |
| last_name | VARCHAR(100) | NOT NULL | 姓 |
| display_name | VARCHAR(200) | | 表示名 |
| email | VARCHAR(255) | NOT NULL | メールアドレス |
| phone | VARCHAR(20) | | 電話番号 |
| avatar_url | TEXT | | アバター画像URL |
| role | VARCHAR(20) | DEFAULT 'employee' | ロール（admin/manager/employee） |
| hourly_rate | DECIMAL(10,2) | | 時給 |
| employment_type | VARCHAR(20) | | 雇用形態（full_time/part_time/contract） |
| hire_date | DATE | | 入社日 |
| status | VARCHAR(20) | DEFAULT 'active' | ステータス（active/inactive/suspended） |
| notification_settings | JSONB | DEFAULT '{}' | 通知設定 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新日時 |

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  employee_code VARCHAR(50),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee')),
  hourly_rate DECIMAL(10,2),
  employment_type VARCHAR(20) CHECK (employment_type IN ('full_time', 'part_time', 'contract')),
  hire_date DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  notification_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_organization ON profiles(organization_id);
CREATE INDEX idx_profiles_department ON profiles(department_id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_status ON profiles(status);
```

---

#### 7.2.3 departments（部署）
| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | 部署ID |
| organization_id | UUID | FK(organizations), NOT NULL | 組織ID |
| parent_id | UUID | FK(departments) | 親部署ID |
| name | VARCHAR(100) | NOT NULL | 部署名 |
| code | VARCHAR(20) | | 部署コード |
| description | TEXT | | 説明 |
| manager_id | UUID | FK(profiles) | 部署マネージャーID |
| sort_order | INTEGER | DEFAULT 0 | 並び順 |
| is_active | BOOLEAN | DEFAULT TRUE | 有効フラグ |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新日時 |

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20),
  description TEXT,
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

CREATE INDEX idx_departments_organization ON departments(organization_id);
CREATE INDEX idx_departments_parent ON departments(parent_id);
```

---

#### 7.2.4 locations（勤務地）
| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | 勤務地ID |
| organization_id | UUID | FK(organizations), NOT NULL | 組織ID |
| name | VARCHAR(100) | NOT NULL | 勤務地名 |
| address | TEXT | | 住所 |
| latitude | DECIMAL(10,8) | NOT NULL | 緯度 |
| longitude | DECIMAL(11,8) | NOT NULL | 経度 |
| radius_meters | INTEGER | DEFAULT 100 | ジオフェンス半径（メートル） |
| geofence_enabled | BOOLEAN | DEFAULT TRUE | ジオフェンス有効フラグ |
| allow_clock_outside | BOOLEAN | DEFAULT FALSE | フェンス外打刻許可 |
| timezone | VARCHAR(50) | | タイムゾーン（組織設定を上書き） |
| is_active | BOOLEAN | DEFAULT TRUE | 有効フラグ |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新日時 |

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  radius_meters INTEGER DEFAULT 100,
  geofence_enabled BOOLEAN DEFAULT TRUE,
  allow_clock_outside BOOLEAN DEFAULT FALSE,
  timezone VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_locations_organization ON locations(organization_id);
CREATE INDEX idx_locations_coordinates ON locations(latitude, longitude);
```

---

#### 7.2.5 shifts（シフト）
| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | シフトID |
| organization_id | UUID | FK(organizations), NOT NULL | 組織ID |
| user_id | UUID | FK(profiles), NOT NULL | 従業員ID |
| location_id | UUID | FK(locations) | 勤務地ID |
| department_id | UUID | FK(departments) | 部署ID |
| start_time | TIMESTAMPTZ | NOT NULL | 開始日時 |
| end_time | TIMESTAMPTZ | NOT NULL | 終了日時 |
| break_minutes | INTEGER | DEFAULT 0 | 休憩時間（分） |
| position | VARCHAR(100) | | ポジション/役割 |
| notes | TEXT | | メモ |
| color | VARCHAR(7) | | 表示色（#RRGGBB） |
| status | VARCHAR(20) | DEFAULT 'draft' | ステータス |
| is_published | BOOLEAN | DEFAULT FALSE | 公開フラグ |
| published_at | TIMESTAMPTZ | | 公開日時 |
| repeat_rule | JSONB | | 繰り返しルール |
| repeat_parent_id | UUID | FK(shifts) | 繰り返し元シフトID |
| created_by | UUID | FK(profiles) | 作成者ID |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新日時 |

```sql
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  position VARCHAR(100),
  notes TEXT,
  color VARCHAR(7),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  repeat_rule JSONB,
  repeat_parent_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT shifts_time_check CHECK (end_time > start_time)
);

CREATE INDEX idx_shifts_organization ON shifts(organization_id);
CREATE INDEX idx_shifts_user ON shifts(user_id);
CREATE INDEX idx_shifts_location ON shifts(location_id);
CREATE INDEX idx_shifts_time ON shifts(start_time, end_time);
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_shifts_published ON shifts(is_published);
```

---

#### 7.2.6 time_entries（打刻記録）
| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | 打刻ID |
| organization_id | UUID | FK(organizations), NOT NULL | 組織ID |
| user_id | UUID | FK(profiles), NOT NULL | ユーザーID |
| shift_id | UUID | FK(shifts) | 関連シフトID |
| entry_type | VARCHAR(20) | NOT NULL | 打刻種別 |
| timestamp | TIMESTAMPTZ | NOT NULL | 打刻日時 |
| latitude | DECIMAL(10,8) | | 緯度 |
| longitude | DECIMAL(11,8) | | 経度 |
| accuracy_meters | DECIMAL(10,2) | | GPS精度（メートル） |
| location_id | UUID | FK(locations) | 打刻場所ID |
| is_inside_geofence | BOOLEAN | | ジオフェンス内フラグ |
| device_info | JSONB | | デバイス情報 |
| ip_address | INET | | IPアドレス |
| notes | TEXT | | メモ |
| is_manual | BOOLEAN | DEFAULT FALSE | 手動入力フラグ |
| approved_by | UUID | FK(profiles) | 承認者ID |
| approved_at | TIMESTAMPTZ | | 承認日時 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新日時 |

```sql
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
  timestamp TIMESTAMPTZ NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  accuracy_meters DECIMAL(10,2),
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  is_inside_geofence BOOLEAN,
  device_info JSONB,
  ip_address INET,
  notes TEXT,
  is_manual BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_time_entries_organization ON time_entries(organization_id);
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_shift ON time_entries(shift_id);
CREATE INDEX idx_time_entries_timestamp ON time_entries(timestamp);
CREATE INDEX idx_time_entries_type ON time_entries(entry_type);
```

---

#### 7.2.7 pto_requests（PTO申請）
| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | 申請ID |
| organization_id | UUID | FK(organizations), NOT NULL | 組織ID |
| user_id | UUID | FK(profiles), NOT NULL | ユーザーID |
| pto_type | VARCHAR(50) | NOT NULL | PTO種別 |
| start_date | DATE | NOT NULL | 開始日 |
| end_date | DATE | NOT NULL | 終了日 |
| total_days | DECIMAL(5,2) | NOT NULL | 合計日数 |
| reason | TEXT | | 理由 |
| status | VARCHAR(20) | DEFAULT 'pending' | ステータス |
| reviewed_by | UUID | FK(profiles) | 承認者ID |
| reviewed_at | TIMESTAMPTZ | | 承認日時 |
| review_comment | TEXT | | 承認コメント |
| attachment_urls | JSONB | DEFAULT '[]' | 添付ファイルURL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新日時 |

```sql
CREATE TABLE pto_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pto_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(5,2) NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  attachment_urls JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT pto_requests_date_check CHECK (end_date >= start_date)
);

CREATE INDEX idx_pto_requests_organization ON pto_requests(organization_id);
CREATE INDEX idx_pto_requests_user ON pto_requests(user_id);
CREATE INDEX idx_pto_requests_dates ON pto_requests(start_date, end_date);
CREATE INDEX idx_pto_requests_status ON pto_requests(status);
```

---

#### 7.2.8 notifications（通知）
| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | 通知ID |
| organization_id | UUID | FK(organizations), NOT NULL | 組織ID |
| user_id | UUID | FK(profiles), NOT NULL | ユーザーID |
| type | VARCHAR(50) | NOT NULL | 通知種別 |
| title | VARCHAR(255) | NOT NULL | タイトル |
| body | TEXT | | 本文 |
| data | JSONB | | 追加データ |
| is_read | BOOLEAN | DEFAULT FALSE | 既読フラグ |
| read_at | TIMESTAMPTZ | | 既読日時 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at DESC);
```

---

#### 7.2.9 invitations（招待）
| カラム名 | データ型 | 制約 | 説明 |
|----------|----------|------|------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | 招待ID |
| organization_id | UUID | FK(organizations), NOT NULL | 組織ID |
| email | VARCHAR(255) | NOT NULL | 招待先メール |
| role | VARCHAR(20) | DEFAULT 'employee' | ロール |
| department_id | UUID | FK(departments) | 部署ID |
| token | VARCHAR(100) | UNIQUE, NOT NULL | 招待トークン |
| status | VARCHAR(20) | DEFAULT 'pending' | ステータス |
| invited_by | UUID | FK(profiles), NOT NULL | 招待者ID |
| accepted_at | TIMESTAMPTZ | | 受諾日時 |
| expires_at | TIMESTAMPTZ | NOT NULL | 有効期限 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |

```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee')),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  token VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invitations_organization ON invitations(organization_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status);
```

---

### 7.3 RLS（Row Level Security）ポリシー

Supabaseでは、各テーブルにRLSポリシーを設定してデータアクセスを制御します。

#### 7.3.1 基本ポリシー例

```sql
-- profilesテーブルのRLS有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 同じ組織のデータのみ閲覧可能
CREATE POLICY "Users can view profiles in same organization"
  ON profiles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 自分のプロフィールのみ更新可能
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

---

### 7.4 トリガー関数

#### 7.4.1 updated_at自動更新

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルにトリガーを設定
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 8. 画面一覧

### 8.1 認証関連
| 画面名 | パス | 説明 |
|--------|------|------|
| ログイン | `/login` | ログイン画面 |
| サインアップ | `/signup` | 新規登録画面 |
| パスワードリセット | `/reset-password` | パスワードリセット画面 |
| 招待受諾 | `/invite/[token]` | 招待リンクからの登録画面 |

### 8.2 ダッシュボード
| 画面名 | パス | 説明 |
|--------|------|------|
| ダッシュボード | `/dashboard` | メインダッシュボード |

### 8.3 シフト管理
| 画面名 | パス | 説明 |
|--------|------|------|
| シフトスケジューラー | `/shifts` | シフト一覧・作成画面 |
| シフト詳細 | `/shifts/[id]` | シフト詳細・編集画面 |
| マイシフト | `/my-shifts` | 従業員用シフト確認画面 |

### 8.4 勤怠管理
| 画面名 | パス | 説明 |
|--------|------|------|
| タイムクロック | `/time-clock` | 打刻画面 |
| タイムシート | `/timesheets` | タイムシート一覧 |
| タイムシート詳細 | `/timesheets/[id]` | タイムシート詳細 |

### 8.5 PTO管理
| 画面名 | パス | 説明 |
|--------|------|------|
| PTO申請 | `/pto/request` | PTO申請画面 |
| PTO一覧 | `/pto` | PTO申請一覧 |
| PTO残高 | `/pto/balance` | 残高確認画面 |

### 8.6 管理画面
| 画面名 | パス | 説明 |
|--------|------|------|
| 従業員管理 | `/admin/employees` | 従業員一覧・管理画面 |
| 従業員詳細 | `/admin/employees/[id]` | 従業員詳細・編集画面 |
| 勤務地管理 | `/admin/locations` | 勤務地・ジオフェンス設定 |
| 部署管理 | `/admin/departments` | 部署管理画面 |
| システム設定 | `/admin/settings` | システム設定画面 |

---

## 9. 開発フェーズ

### Phase 1: 基盤構築
- [ ] Next.jsプロジェクトセットアップ
- [ ] Supabase連携設定
- [ ] 認証システム実装（Google OAuth、Email）
- [ ] 基本UIコンポーネント作成
- [ ] データベーススキーマ設計・実装

### Phase 2: コア機能
- [ ] ダッシュボード実装
- [ ] 従業員管理機能
- [ ] シフトスケジューラー（ドラッグ＆ドロップ）
- [ ] GPS打刻・ジオフェンシング

### Phase 3: 勤怠・PTO
- [ ] タイムシート機能
- [ ] PTO申請・承認フロー
- [ ] リマインダー・通知機能

### Phase 4: タスク・コミュニケーション
- [ ] タスク・チェックリスト機能
- [ ] アプリ内チャット
- [ ] アナウンスメント機能

### Phase 5: レポート・最適化
- [ ] レポート機能
- [ ] エクスポート機能
- [ ] パフォーマンス最適化
- [ ] PWA対応

### Phase 6: 追加機能・ローンチ
- [ ] シフト交換機能
- [ ] カレンダー連携
- [ ] 本番環境デプロイ

---

## 10. 開発ガイドライン

### 10.1 コーディング規約
- コード: 英語
- コメント: 英語
- コミットメッセージ: 英語
- ESLint + Prettier 使用
- TypeScript strict mode

### 10.2 ブランチ戦略
```
main          - 本番環境
develop       - 開発環境
feature/*     - 機能開発
bugfix/*      - バグ修正
hotfix/*      - 緊急修正
```

### 10.3 命名規則
- コンポーネント: PascalCase (`ShiftScheduler.tsx`)
- 関数: camelCase (`getShiftById()`)
- 定数: UPPER_SNAKE_CASE (`MAX_SHIFT_HOURS`)
- CSS クラス: kebab-case (`shift-card`)
- データベーステーブル: snake_case (`time_entries`)

---

## 11. 付録

### 11.1 用語集
| 用語 | 説明 |
|------|------|
| シフト | 従業員の勤務予定 |
| タイムエントリー | 打刻記録 |
| PTO | Paid Time Off（有給休暇） |
| ジオフェンス | 地理的な境界エリア |
| タイムシート | 勤務時間の集計表 |

### 11.2 参考リンク
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

**更新履歴**
| バージョン | 日付 | 内容 |
|------------|------|------|
| 1.0.0 | 2026-01-08 | 初版作成 |
| 1.1.0 | 2026-01-08 | API設計セクション追加、Flutter対応技術スタック追加 |
| 1.2.0 | 2026-01-08 | データベーステーブル構造詳細、RLSポリシー、トリガー関数追加 |
| 1.2.1 | 2026-01-08 | 多言語対応を削除（英語のみ対応）、localeデフォルト値を'en'に変更 |
