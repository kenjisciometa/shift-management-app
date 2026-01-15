# TimeSheets 改修要件定義書

**作成日**: 2026-01-15
**バージョン**: 1.1
**ステータス**: Draft

---

## 1. 概要

### 1.1 改修目的
現行のTimeSheets機能を大規模に改修し、より効率的な勤怠管理を実現する。従業員ごとの勤怠データを一覧形式で表示し、直接編集・承認できるUIに変更する。

### 1.2 主な変更点
- 従業員名を左側に配置したテーブル形式への変更
- Submit（提出）機能の廃止とステータス直接編集への移行
- 柔軟なソート・フィルター機能の追加
- CSV出力機能の搭載
- ロールベースのアクセス制御（従業員は自分のデータのみ閲覧可能）

### 1.3 実装言語
- **すべての実装は英語で行う**（変数名、コメント、UI表示テキスト等）

---

## 2. 機能要件

### 2.1 アクセス制御

#### 2.1.1 ロール別アクセス権限

| Role | View Own Timesheets | View All Timesheets | Edit Own | Edit All | Approve/Reject |
|------|---------------------|---------------------|----------|----------|----------------|
| Employee | Yes | No | Yes (Pending only) | No | No |
| Manager | Yes | Yes | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes | Yes | Yes |
| Owner | Yes | Yes | Yes | Yes | Yes |

#### 2.1.2 動作仕様

**Employee（従業員）:**
- 自分のTimesheetsのみ表示される
- 自分のPendingステータスのエントリのみ編集可能
- Approve/Reject機能は非表示

**Manager/Admin/Owner:**
- 組織内の全従業員のTimesheetsを表示
- 全エントリの編集が可能
- Approve/Reject機能が使用可能
- Employeeフィルターで特定従業員を絞り込み可能

#### 2.1.3 実装

```typescript
// Check user role for access control
const canViewAllTimesheets = ["admin", "owner", "manager"].includes(profile.role);
const canApproveReject = ["admin", "owner", "manager"].includes(profile.role);

// Filter query based on role
if (!canViewAllTimesheets) {
  query = query.eq("user_id", user.id);
}
```

---

### 2.2 テーブル構成

#### 2.2.1 カラム定義

| # | Column Name | Display Name | Data Type | Description |
|---|-------------|--------------|-----------|-------------|
| 1 | name | Name | string | Employee full name |
| 2 | date | Date | date | Work date |
| 3 | locations | Locations | string | Work location(s), comma-separated if multiple |
| 4 | positions | Positions | string | Job position/role |
| 5 | clock_in_time | Clock In Time | time | Clock in timestamp |
| 6 | clock_out_time | Clock Out Time | time | Clock out timestamp |
| 7 | auto_clock_out | Auto Clock-out | boolean | Auto clock-out flag (Yes / No) |
| 8 | break_duration | Break Duration | duration | Total break time |
| 9 | break_start | Break Start | time | Break start time |
| 10 | break_end | Break End | time | Break end time |
| 11 | shift_duration | Shift Duration | duration | Actual work hours (excluding breaks) |
| 12 | schedule_shift_duration | Schedule Shift Duration | duration | Scheduled shift hours |
| 13 | difference | Difference | duration | Difference between actual and scheduled (+/-) |
| 14 | status | Status | enum | Status (Pending / Approved / Rejected) |
| 15 | actions | - | button | Edit button |

#### 2.2.2 カラム表示仕様

```
+----------+------------+-----------+-----------+----------+----------+-------------+--------+-------+-------+----------+----------+----------+---------+------+
| Name     | Date       | Locations | Positions | Clock In | Clock Out| Auto Clock  | Break  | Break | Break | Shift    | Schedule | Diff     | Status  | Edit |
|          |            |           |           | Time     | Time     | -out        | Dur.   | Start | End   | Duration | Duration |          |         |      |
+----------+------------+-----------+-----------+----------+----------+-------------+--------+-------+-------+----------+----------+----------+---------+------+
| John Doe | 2026/01/15 | Main Store| Manager   | 09:00    | 18:00    | No          | 1:00   | 12:00 | 13:00 | 8:00     | 8:00     | 0:00     | Pending | [Edit]|
+----------+------------+-----------+-----------+----------+----------+-------------+--------+-------+-------+----------+----------+----------+---------+------+
```

#### 2.2.3 ステータス表示

| Status | Color | Badge Style |
|--------|-------|-------------|
| Pending | Yellow/Amber | `bg-yellow-100 text-yellow-800` |
| Approved | Green | `bg-green-100 text-green-800` |
| Rejected | Red | `bg-red-100 text-red-800` |

---

### 2.3 Submit機能の廃止

#### 2.3.1 現行フローの変更

**現行フロー（廃止）:**
```
Draft → Submit → Pending → Approved/Rejected
```

**新フロー:**
```
Pending → Approved/Rejected
```

#### 2.3.2 動作仕様

- 従業員が打刻した時点でステータスは自動的に`Pending`となる
- 管理者・マネージャーがテーブル上で直接ステータスを変更
- 編集ボタンからモーダルを開き、詳細編集・承認・却下を行う

#### 2.3.3 削除対象機能

- Timesheet submit button
- Timesheet submit API (`/api/timesheets/[id]/submit`)
- Submit-related notifications
- `submitted_at` field usage (data will be retained)

---

### 2.4 ソート機能

#### 2.4.1 デフォルトソート
- **Name (alphabetical order A-Z)**

#### 2.4.2 ソートオプション

| Sort Field | Ascending | Descending |
|------------|-----------|------------|
| Name | A → Z | Z → A |
| Date | Oldest → Newest | Newest → Oldest |
| Positions | A → Z | Z → A |
| Clock In Time | Earliest → Latest | Latest → Earliest |
| Shift Duration | Shortest → Longest | Longest → Shortest |
| Status | Pending → Approved → Rejected | Rejected → Approved → Pending |

#### 2.4.3 UI仕様

```
┌─────────────────────────────────────────┐
│ Sort by: [Name ▼]  [↑ Asc] [↓ Desc]     │
└─────────────────────────────────────────┘
```

- Dropdown to select sort field
- Toggle buttons for ascending/descending order
- Column header click for direct sorting

---

### 2.5 フィルター機能

#### 2.5.1 期間フィルター（ドロップダウンリスト形式）

| Filter Option | Description |
|---------------|-------------|
| Day | Show data for selected single day |
| Week | Show data for selected week (Sunday or Monday start) |
| Month | Show data for selected month |
| Quarter | Show data for selected quarter (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec) |
| Year | Show data for selected year |
| Custom | Specify custom date range (start - end) |

#### 2.5.2 UI配置

```
┌──────────────────────────────────────────────────────────────────┐
│ Period: [Month        ▼]              │ 📅 January 2026         │
└──────────────────────────────────────────────────────────────────┘
```

- 左側: 期間選択ドロップダウンリスト
- 右側: 現在選択中の日付/期間を表示
- 日付表示部分をクリックでカレンダーポップアップを表示

#### 2.5.3 カレンダーポップアップ仕様

- **Day**: Date picker (single day selection)
- **Week**: Week-based calendar selection
- **Month**: Month picker
- **Quarter**: Quarter selection UI
- **Year**: Year picker
- **Custom**: Date range picker (From - To)

#### 2.5.4 追加フィルター

| Filter Field | Description | Visibility |
|--------------|-------------|------------|
| Employee | Filter by specific employee | Manager/Admin/Owner only |
| Location | Filter by work location | All roles |
| Position | Filter by job position | All roles |
| Status | Filter by status (Pending/Approved/Rejected) | All roles |

---

### 2.6 CSV出力機能

#### 2.6.1 出力対象
- 現在表示されているフィルター・ソート条件に基づくデータ

#### 2.6.2 出力カラム

```csv
Name,Date,Locations,Positions,Clock In Time,Clock Out Time,Auto Clock-out,Break Duration,Break Start,Break End,Shift Duration,Schedule Shift Duration,Difference,Status
```

#### 2.6.3 UI配置

```
┌─────────────────────────────────────────────────────────┐
│ [Export CSV]                                            │
└─────────────────────────────────────────────────────────┘
```

- Placed at the top-right of the table
- Click to immediately start download

#### 2.6.4 ファイル名規則

```
timesheets_{filter_type}_{date_range}_{export_date}.csv
```

Examples:
- `timesheets_month_2026-01_20260115.csv`
- `timesheets_custom_20260101-20260115_20260115.csv`

---

## 3. 画面設計

### 3.1 全体レイアウト

**Manager/Admin/Owner View:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ Timesheets                                                    [Export CSV] │
├────────────────────────────────────────────────────────────────────────────┤
│ Period: [Month ▼]                                    │ 📅 January 2026     │
├────────────────────────────────────────────────────────────────────────────┤
│ Sort by: [Name ▼] [↑][↓]  Employee: [All ▼] Status: [All ▼] Location: [All▼]│
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌──────┬──────┬─────────┬─────────┬────────┬─────────┬──────┬─────┬─────┐ │
│ │ Name │ Date │Location │Position │Clock In│Clock Out│ ...  │Status│Edit│ │
│ ├──────┼──────┼─────────┼─────────┼────────┼─────────┼──────┼─────┼─────┤ │
│ │ ...  │ ...  │ ...     │ ...     │ ...    │ ...     │ ...  │ ... │ [✏]│ │
│ └──────┴──────┴─────────┴─────────┴────────┴─────────┴──────┴─────┴─────┘ │
│                                                                            │
│ Showing 1-50 of 234 entries                              [< 1 2 3 4 5 >]   │
└────────────────────────────────────────────────────────────────────────────┘
```

**Employee View:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ My Timesheets                                                 [Export CSV] │
├────────────────────────────────────────────────────────────────────────────┤
│ Period: [Month ▼]                                    │ 📅 January 2026     │
├────────────────────────────────────────────────────────────────────────────┤
│ Sort by: [Date ▼] [↑][↓]                    Status: [All ▼] Location: [All▼]│
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌──────┬─────────┬─────────┬────────┬─────────┬──────┬─────┬─────────────┐ │
│ │ Date │Location │Position │Clock In│Clock Out│ ...  │Status│    Edit    │ │
│ ├──────┼─────────┼─────────┼────────┼─────────┼──────┼─────┼─────────────┤ │
│ │ ...  │ ...     │ ...     │ ...    │ ...     │ ...  │ ... │ [✏ Pending]│ │
│ └──────┴─────────┴─────────┴────────┴─────────┴──────┴─────┴─────────────┘ │
│                                                                            │
│ Showing 1-20 of 45 entries                                  [< 1 2 3 >]    │
└────────────────────────────────────────────────────────────────────────────┘
```

Note: Employee view hides the Name column (only shows own data) and Employee filter

### 3.2 編集モーダル

**Manager/Admin/Owner Edit Modal:**

```
┌─────────────────────────────────────────────────────────┐
│ Edit Time Entry                                    [×]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Employee: John Doe                                      │
│ Date: 2026/01/15                                        │
│                                                         │
│ Clock In Time:  [09:00  ▼]                              │
│ Clock Out Time: [18:00  ▼]                              │
│                                                         │
│ Break Start:    [12:00  ▼]                              │
│ Break End:      [13:00  ▼]                              │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ Status: ◉ Pending  ○ Approved  ○ Rejected              │
│                                                         │
│ Comment: [                                         ]    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                        [Cancel]  [Save Changes]         │
└─────────────────────────────────────────────────────────┘
```

**Employee Edit Modal (Pending entries only):**

```
┌─────────────────────────────────────────────────────────┐
│ Edit Time Entry                                    [×]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Date: 2026/01/15                                        │
│                                                         │
│ Clock In Time:  [09:00  ▼]                              │
│ Clock Out Time: [18:00  ▼]                              │
│                                                         │
│ Break Start:    [12:00  ▼]                              │
│ Break End:      [13:00  ▼]                              │
│                                                         │
│ Note: Changes require manager approval                  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                        [Cancel]  [Save Changes]         │
└─────────────────────────────────────────────────────────┘
```

Note: Employee cannot change status - only time values for Pending entries

---

## 4. API設計

### 4.1 新規/更新API

#### GET /api/timesheets
Get timesheet list with filtering and sorting

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter | string | No | day/week/month/quarter/year/custom |
| start_date | string | No | Start date (ISO 8601 format) |
| end_date | string | No | End date (ISO 8601 format) |
| sort_by | string | No | Sort field (name/date/position, etc.) |
| sort_order | string | No | asc/desc |
| status | string | No | pending/approved/rejected |
| employee_id | string | No | Employee ID (admin/manager only) |
| location_id | string | No | Work location ID |
| page | number | No | Page number |
| limit | number | No | Items per page |

**Response (role-based filtering applied):**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "totalPages": 5
  }
}
```

#### PUT /api/timesheets/[id]
Update timesheet data (including status change)

**Request Body:**
```json
{
  "clock_in_time": "09:00",
  "clock_out_time": "18:00",
  "break_start": "12:00",
  "break_end": "13:00",
  "status": "approved",
  "review_comment": "Approved"
}
```

**Authorization:**
- Employee: Can only update own Pending entries, cannot change status
- Manager/Admin/Owner: Can update any entry and change status

#### GET /api/timesheets/export
Export to CSV

**Query Parameters:**
- Same filter parameters as GET /api/timesheets

### 4.2 廃止API

| API | Reason |
|-----|--------|
| PUT /api/timesheets/[id]/submit | Submit feature removed |

---

## 5. データベース変更

### 5.1 スキーマ変更

#### timesheetsテーブル
- `submitted_at`: Retain existing data, not used for new entries
- `status`: Change default value from `draft` to `pending`

#### time_entriesテーブル
No changes

### 5.2 マイグレーション

```sql
-- Change default status from 'draft' to 'pending'
ALTER TABLE timesheets
ALTER COLUMN status SET DEFAULT 'pending';

-- Update any existing draft timesheets to pending
UPDATE timesheets
SET status = 'pending'
WHERE status = 'draft';
```

### 5.3 RLSポリシー更新

```sql
-- Update RLS policy for timesheets table
-- Employees can only view their own timesheets
-- Managers/Admins/Owners can view all timesheets in their organization

CREATE POLICY "Users can view own timesheets" ON timesheets
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = timesheets.organization_id
    AND profiles.role IN ('admin', 'owner', 'manager')
  )
);

CREATE POLICY "Users can update own pending timesheets" ON timesheets
FOR UPDATE
USING (
  (auth.uid() = user_id AND status = 'pending')
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = timesheets.organization_id
    AND profiles.role IN ('admin', 'owner', 'manager')
  )
);
```

---

## 6. 実装計画

### 6.1 Phase 1: Access Control & Table UI
- Implement role-based access control
- Create new table component
- Column definitions and data display
- Responsive design

### 6.2 Phase 2: Filter Feature
- Period filter dropdown implementation
- Calendar popup implementation
- Additional filters (Status, Location, Employee)

### 6.3 Phase 3: Sort Feature
- Sort UI implementation
- Column header sorting
- Sort state persistence

### 6.4 Phase 4: Edit Feature
- Edit modal creation
- Status change functionality (admin/manager only)
- API integration
- Employee edit restrictions

### 6.5 Phase 5: CSV Export
- Export feature implementation
- File generation logic

### 6.6 Phase 6: Legacy Feature Removal
- Remove submit functionality
- Related code cleanup
- Testing & verification

---

## 7. 影響範囲

### 7.1 変更対象ファイル

| File Path | Changes |
|-----------|---------|
| `src/app/timesheets/page.tsx` | Complete page redesign |
| `src/components/timesheets/` | New component creation |
| `src/app/api/timesheets/` | API updates with role-based filtering |
| `src/types/database.types.ts` | Type definition updates (if needed) |
| `src/lib/supabase/` | RLS policy updates |

### 7.2 削除対象ファイル

| File Path | Reason |
|-----------|--------|
| `src/app/api/timesheets/[id]/submit/route.ts` | Submit feature removed |
| `src/components/timesheets/detail.tsx` | Merged into new UI |

### 7.3 影響を受ける機能

- Notification system (remove timesheet submission notifications)
- Dashboard (update pending timesheet display)
- Reports (verify data source compatibility)

---

## 8. 非機能要件

### 8.1 パフォーマンス
- Table display: Under 1 second for 1000 entries or less
- Pagination: Default 50 items per page
- Consider virtual scrolling for large datasets

### 8.2 アクセシビリティ
- Keyboard navigation support
- Screen reader compatibility
- Proper ARIA labels

### 8.3 レスポンシブ対応
- Mobile: Consider card-based layout
- Tablet: Horizontal scroll support
- Desktop: Full table display

---

## 9. 承認

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Project Manager | | | |
| Development Lead | | | |
| QA Lead | | | |

---

## 付録

### A. 用語集

| Term | Description |
|------|-------------|
| Time Entry | A single clock in/out record |
| Timesheet | Summary of work hours for a specific period |
| Auto Clock-out | System-triggered automatic clock out |
| Shift Duration | Actual work hours (clock in to clock out minus breaks) |

### B. 参照ドキュメント

- Current Timesheets feature specification
- Supabase database schema
- UI component library (shadcn/ui)

### C. 実装コード例

#### Period Filter Dropdown Component
```typescript
// src/components/timesheets/period-filter.tsx
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PeriodType = "day" | "week" | "month" | "quarter" | "year" | "custom";

interface PeriodFilterProps {
  value: PeriodType;
  onValueChange: (value: PeriodType) => void;
}

const periodOptions = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
];

export function PeriodFilter({ value, onValueChange }: PeriodFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Period:</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          {periodOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

#### Role-based Access Hook
```typescript
// src/hooks/use-timesheet-access.ts
import { useProfile } from "@/hooks/use-profile";

export function useTimesheetAccess() {
  const { profile } = useProfile();

  const canViewAllTimesheets = ["admin", "owner", "manager"].includes(
    profile?.role ?? ""
  );

  const canApproveReject = ["admin", "owner", "manager"].includes(
    profile?.role ?? ""
  );

  const canEditAllTimesheets = ["admin", "owner", "manager"].includes(
    profile?.role ?? ""
  );

  return {
    canViewAllTimesheets,
    canApproveReject,
    canEditAllTimesheets,
    isEmployee: profile?.role === "employee",
  };
}
```
