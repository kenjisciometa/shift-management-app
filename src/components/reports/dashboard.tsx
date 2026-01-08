"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Calendar,
  Clock,
  Palmtree,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  BarChart3,
  FileText,
} from "lucide-react";
import { WorkHoursReport } from "./work-hours-report";
import { ShiftCoverageReport } from "./shift-coverage-report";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface TimeEntry {
  id: string;
  user_id: string;
  entry_type: string;
  timestamp: string;
  profiles?: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  locations?: {
    id: string;
    name: string;
  } | null;
}

interface Shift {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  status: string | null;
  profiles?: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  locations?: {
    id: string;
    name: string;
  } | null;
}

interface ReportsDashboardProps {
  totalEmployees: number;
  totalShiftsThisMonth: number;
  shiftChangePercent: number;
  totalWorkHours: number;
  approvedPTODays: number;
  pendingPTOCount: number;
  taskCompletionRate: number;
  completedTasks: number;
  totalTasks: number;
  dailyShiftCounts: { day: string; shifts: number }[];
  ptoBreakdown: { type: string; days: number }[];
  timeEntries: TimeEntry[];
  shifts: Shift[];
  organizationId: string;
}

const ptoTypeLabels: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick Leave",
  personal: "Personal",
  bereavement: "Bereavement",
  jury_duty: "Jury Duty",
  other: "Other",
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];

export function ReportsDashboard({
  totalEmployees,
  totalShiftsThisMonth,
  shiftChangePercent,
  totalWorkHours,
  approvedPTODays,
  pendingPTOCount,
  taskCompletionRate,
  completedTasks,
  totalTasks,
  dailyShiftCounts,
  ptoBreakdown,
  timeEntries,
  shifts,
  organizationId,
}: ReportsDashboardProps) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="work-hours">
            <Clock className="h-4 w-4 mr-2" />
            Work Hours
          </TabsTrigger>
          <TabsTrigger value="shift-coverage">
            <Calendar className="h-4 w-4 mr-2" />
            Shift Coverage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Employees
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground">Active team members</p>
          </CardContent>
        </Card>

        {/* Shifts This Month */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Shifts This Month
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShiftsThisMonth}</div>
            <div className="flex items-center text-xs">
              {shiftChangePercent > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-green-500">
                    +{shiftChangePercent.toFixed(1)}%
                  </span>
                </>
              ) : shiftChangePercent < 0 ? (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  <span className="text-red-500">
                    {shiftChangePercent.toFixed(1)}%
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">No change</span>
              )}
              <span className="text-muted-foreground ml-1">vs last month</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Work Hours */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Work Hours
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWorkHours}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        {/* PTO Taken */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              PTO Days Taken
            </CardTitle>
            <Palmtree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedPTODays}</div>
            <div className="flex items-center text-xs">
              {pendingPTOCount > 0 && (
                <>
                  <AlertCircle className="h-3 w-3 text-yellow-500 mr-1" />
                  <span className="text-yellow-500">
                    {pendingPTOCount} pending
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Completion */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Task Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20">
                <svg className="h-20 w-20 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    className="text-muted stroke-current"
                    strokeWidth="10"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                  />
                  <circle
                    className="text-primary stroke-current"
                    strokeWidth="10"
                    strokeLinecap="round"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                    strokeDasharray={`${taskCompletionRate * 2.51} 251`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold">{taskCompletionRate}%</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {completedTasks} / {totalTasks}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Tasks completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shifts This Week Bar Chart */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Shifts This Week</CardTitle>
            <CardDescription>Daily distribution of shifts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyShiftCounts}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="shifts"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PTO Breakdown */}
      {ptoBreakdown.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">PTO Breakdown</CardTitle>
              <CardDescription>Days taken by type this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ptoBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${ptoTypeLabels[name as string] || name} ${((percent || 0) * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="days"
                      nameKey="type"
                    >
                      {ptoBreakdown.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        `${value} days`,
                        ptoTypeLabels[name as string] || name,
                      ]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">PTO Summary</CardTitle>
              <CardDescription>Breakdown by leave type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ptoBreakdown.map((item, index) => (
                  <div key={item.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm">
                        {ptoTypeLabels[item.type] || item.type}
                      </span>
                    </div>
                    <Badge variant="secondary">{item.days} days</Badge>
                  </div>
                ))}
                {ptoBreakdown.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No PTO taken this month
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
          </div>
        </TabsContent>

        <TabsContent value="work-hours" className="mt-6">
          <WorkHoursReport
            timeEntries={timeEntries}
            organizationId={organizationId}
          />
        </TabsContent>

        <TabsContent value="shift-coverage" className="mt-6">
          <ShiftCoverageReport
            shifts={shifts}
            organizationId={organizationId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
