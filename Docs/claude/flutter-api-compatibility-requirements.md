# Flutter API互換性対応 要件定義書

## 概要

shift-management-appのAPIをFlutterアプリからも利用可能にするための改修要件。
ReactRestaurantPOSの実装パターンを参考に、Bearer token認証とCookie認証の両方に対応する。

## 背景

### 現状
- Next.js App RouterのAPI Routesを使用
- Cookie-based認証（`@supabase/ssr`）のみ対応
- React Server Componentsからの利用を前提とした設計

### 目標
- Flutter/Dartアプリからの同一API利用を可能にする
- 既存のReact Webアプリの動作を維持する
- ReactRestaurantPOSと同一の認証パターンを採用

---

## 参考実装

**ReactRestaurantPOS**
- `src/app/api/shared/auth.ts` - 統合認証ヘルパー
- `src/app/api/shared/rbac.ts` - ロールベースアクセス制御

---

## 機能要件

### 1. 統合認証ヘルパーの実装

#### 1.1 新規ファイル作成
**ファイル**: `src/app/api/shared/auth.ts`

```typescript
export async function authenticateAndAuthorize(
  request: NextRequest,
  permissionOptions?: PermissionCheckOptions
): Promise<{
  error: NextResponse | null;
  user: User | null;
  supabase: SupabaseClient | null;
  permission?: PermissionCheckResult;
}>
```

#### 1.2 認証フロー

```
1. Authorization headerをチェック
   ├─ Bearer token あり → Token認証 (Flutter)
   │   └─ supabase.auth.getUser(token) で検証
   │   └─ RLS対応クライアントを作成
   │
   └─ Bearer token なし → Cookie認証 (React)
       └─ cookies() からセッション取得
       └─ RLS対応クライアントを作成

2. ユーザー検証成功後
   └─ permissionOptions があれば権限チェック
   └─ { error: null, user, supabase } を返却
```

#### 1.3 Bearer Token認証の実装詳細

```typescript
// Authorization headerからトークン取得
const authHeader = request.headers.get('authorization');
if (authHeader && authHeader.startsWith('Bearer ')) {
  const token = authHeader.substring(7);

  // トークン検証
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (!error && user) {
    // RLS対応クライアント作成
    const supabaseWithRLS = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return [{ name: 'sb-access-token', value: token }];
          },
          setAll() { /* no-op */ }
        },
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    );

    return { error: null, user, supabase: supabaseWithRLS };
  }
}
```

### 2. RBAC (Role-Based Access Control)

#### 2.1 新規ファイル作成
**ファイル**: `src/app/api/shared/rbac.ts`

#### 2.2 リソース定義

```typescript
export type Resource =
  | 'shifts'
  | 'timesheets'
  | 'pto'
  | 'shift_swaps'
  | 'schedules'
  | 'employees'
  | 'settings'
  | 'organizations'
  | 'locations'
  | 'positions';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'approve';
```

#### 2.3 ロール権限マッピング

| Role | shifts | timesheets | pto | shift_swaps | settings | employees |
|------|--------|------------|-----|-------------|----------|-----------|
| owner | 全権限 | 全権限 | 全権限 | 全権限 | 全権限 | 全権限 |
| admin | 全権限 | 全権限 | 全権限 | 全権限 | 全権限 | 全権限 |
| manager | CRUD+approve | CRUD+approve | CRUD+approve | CRUD+approve | read | read |
| employee | read (自分) | read/update (自分) | create/read (自分) | create/read (自分) | - | - |

### 3. 既存APIルートの改修

#### 3.1 対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/app/api/timesheets/route.ts` | `authenticateAndAuthorize`に置換 |
| `src/app/api/timesheets/[id]/route.ts` | 同上 |
| `src/app/api/timesheets/[id]/approve/route.ts` | 同上 |
| `src/app/api/timesheets/[id]/reject/route.ts` | 同上 |
| `src/app/api/timesheets/[id]/submit/route.ts` | 同上 |
| `src/app/api/timesheets/[id]/export/route.ts` | 同上 |
| `src/app/api/timesheets/entries/[id]/route.ts` | 同上 |
| `src/app/api/timesheets/generate/route.ts` | 同上 |
| `src/app/api/timesheets/export/route.ts` | 同上 |
| `src/app/api/pto/requests/route.ts` | 同上 |
| `src/app/api/pto/requests/[id]/route.ts` | 同上 |
| `src/app/api/pto/requests/[id]/approve/route.ts` | 同上 |
| `src/app/api/pto/requests/[id]/reject/route.ts` | 同上 |
| `src/app/api/pto/balance/route.ts` | 同上 |
| `src/app/api/pto/balance/initialize/route.ts` | 同上 |
| `src/app/api/pto/policies/route.ts` | 同上 |
| `src/app/api/auth/signout/route.ts` | Bearer時はJSONレスポンス |
| `src/app/api/invitations/accept/route.ts` | 同上 |

#### 3.2 変更パターン

**Before:**
```typescript
import { getAuthData, getCachedSupabase } from "@/lib/auth";

export async function GET(request: Request) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await getCachedSupabase();
  // ...
}
```

**After:**
```typescript
import { authenticateAndAuthorize } from "@/app/api/shared/auth";

export async function GET(request: NextRequest) {
  const { error, user, supabase } = await authenticateAndAuthorize(request);
  if (error) return error;

  // supabaseはRLS対応済み
  // ...
}
```

### 4. サインアウトAPIの特別対応

**ファイル**: `src/app/api/auth/signout/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Flutter: JSONレスポンス
    // クライアント側でトークンを破棄
    return NextResponse.json({ success: true, message: 'Signed out' });
  }

  // React: リダイレクト（従来通り）
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${requestUrl.origin}/login`);
}
```

---

## 非機能要件

### セキュリティ

1. **トークン検証**
   - 全てのリクエストで`supabase.auth.getUser(token)`による検証必須
   - 期限切れトークンは401エラー

2. **RLS (Row Level Security)**
   - Bearer token使用時もRLSが正しく機能すること
   - `auth.uid()`がトークンのユーザーIDを返すこと

3. **CORS設定**
   - Flutterアプリのオリジンを許可（必要に応じて）

### パフォーマンス

1. **キャッシュ**
   - 組織情報のキャッシュ（TTL: 1時間）
   - ReactRestaurantPOSの`orgContextCache`パターンを参考

### 互換性

1. **既存React機能の維持**
   - Cookie認証が引き続き動作すること
   - 既存のフロントエンドコードの変更不要

2. **APIレスポンス形式**
   - 統一形式: `{ success: boolean, data?: T, error?: string }`

---

## 実装タスク

### Phase 1: 認証基盤 (優先度: 高)

- [ ] `src/app/api/shared/auth.ts` 作成
- [ ] `src/app/api/shared/rbac.ts` 作成
- [ ] 既存`src/lib/auth.ts`との共存確認

### Phase 2: APIルート改修 (優先度: 高)

- [ ] Timesheets API (9ファイル)
- [ ] PTO API (7ファイル)
- [ ] Auth API (1ファイル)
- [ ] Invitations API (1ファイル)

### Phase 3: テスト (優先度: 高)

- [ ] Bearer token認証テスト
- [ ] Cookie認証テスト（既存動作確認）
- [ ] RLS動作確認
- [ ] 権限チェックテスト

### Phase 4: ドキュメント (優先度: 中)

- [ ] API仕様書更新
- [ ] Flutter SDKサンプルコード

---

## Flutter側の実装要件

### 認証フロー

```dart
// Supabase認証
final response = await supabase.auth.signInWithPassword(
  email: email,
  password: password,
);

// アクセストークン取得
final accessToken = supabase.auth.currentSession?.accessToken;

// API呼び出し
final response = await http.get(
  Uri.parse('$apiBaseUrl/api/timesheets'),
  headers: {
    'Authorization': 'Bearer $accessToken',
    'Content-Type': 'application/json',
  },
);
```

### トークンリフレッシュ

```dart
// Supabase SDKが自動でリフレッシュ
// onAuthStateChangeでトークン更新を監視
supabase.auth.onAuthStateChange.listen((data) {
  final newToken = data.session?.accessToken;
  // HTTPクライアントのヘッダーを更新
});
```

---

## 参考資料

- ReactRestaurantPOS実装: `/ReactRestaurantPOS/src/app/api/shared/`
- Supabase Auth Helpers: https://supabase.com/docs/guides/auth/server-side
- Next.js Route Handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-01-16 | 1.0 | 初版作成 |
