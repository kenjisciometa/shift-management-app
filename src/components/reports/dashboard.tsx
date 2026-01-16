"use client";

import { useState, useEffect, useCallback } from "react";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  format,
} from "date-fns";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Users,
  Calendar as CalendarIcon,
  Clock,
  Palmtree,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  BarChart3,
  Loader2,
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
} from "recharts";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

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

type FilterPreset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "this_year" | "custom";

const ptoTypeLabels: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick Leave",
  personal: "Personal",
  bereavement: "Bereavement",
  jury_duty: "Jury Duty",
  other: "Other",
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];

function getDateRangeFromPreset(preset: FilterPreset): { start: Date; end: Date } {
  const now = new Date();

  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday":
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case "this_week":
      return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
    case "last_week":
      const lastWeek = subWeeks(now, 1);
      return { start: startOfWeek(lastWeek, { weekStartsOn: 0 }), end: endOfWeek(lastWeek, { weekStartsOn: 0 }) };
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month":
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case "this_year":
      return { start: startOfYear(now), end: endOfYear(now) };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

const filterPresetLabels: Record<FilterPreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  last_week: "Last Week",
  this_month: "This Month",
  last_month: "Last Month",
  this_year: "This Year",
  custom: "Custom",
};

export function ReportsDashboard({
  totalEmployees,
  totalShiftsThisMonth: initialShifts,
  shiftChangePercent: initialShiftChange,
  totalWorkHours: initialWorkHours,
  approvedPTODays: initialPTODays,
  pendingPTOCount,
  taskCompletionRate: initialTaskRate,
  completedTasks: initialCompletedTasks,
  totalTasks: initialTotalTasks,
  dailyShiftCounts: initialDailyShifts,
  ptoBreakdown: initialPTOBreakdown,
  timeEntries,
  shifts,
  organizationId,
}: ReportsDashboardProps) {
  const supabase = createClient();
  const [filterPreset, setFilterPreset] = useState<FilterPreset>("this_month");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(false);

  // Filtered data states
  const [filteredShifts, setFilteredShifts] = useState(initialShifts);
  const [filteredShiftChange, setFilteredShiftChange] = useState(initialShiftChange);
  const [filteredWorkHours, setFilteredWorkHours] = useState(initialWorkHours);
  const [filteredPTODays, setFilteredPTODays] = useState(initialPTODays);
  const [filteredTaskRate, setFilteredTaskRate] = useState(initialTaskRate);
  const [filteredCompletedTasks, setFilteredCompletedTasks] = useState(initialCompletedTasks);
  const [filteredTotalTasks, setFilteredTotalTasks] = useState(initialTotalTasks);
  const [filteredDailyShifts, setFilteredDailyShifts] = useState(initialDailyShifts);
  const [filteredPTOBreakdown, setFilteredPTOBreakdown] = useState(initialPTOBreakdown);

  const fetchFilteredData = useCallback(async (startDate: Date, endDate: Date) => {
    setLoading(true);

    try {
      const [
        shiftsResult,
        timeEntriesResult,
        ptoResult,
        tasksResult,
      ] = await Promise.all([
        // Shifts in date range
        supabase
          .from("shifts")
          .select("id, user_id, start_time, end_time, status")
          .eq("organization_id", organizationId)
          .gte("start_time", startDate.toISOString())
          .lte("start_time", endDate.toISOString()),
        // Time entries in date range
        supabase
          .from("time_entries")
          .select("id, user_id, entry_type, timestamp")
          .eq("organization_id", organizationId)
          .gte("timestamp", startDate.toISOString())
          .lte("timestamp", endDate.toISOString())
          .order("timestamp"),
        // PTO requests in date range
        supabase
          .from("pto_requests")
          .select("id, user_id, pto_type, total_days, status, start_date")
          .eq("organization_id", organizationId)
          .gte("start_date", format(startDate, "yyyy-MM-dd"))
          .lte("start_date", format(endDate, "yyyy-MM-dd")),
        // Tasks created in date range
        supabase
          .from("tasks")
          .select("id, status, created_at")
          .eq("organization_id", organizationId)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString()),
      ]);

      // Calculate shifts
      const shiftsData = shiftsResult.data || [];
      setFilteredShifts(shiftsData.length);

      // Calculate shift change (compare with previous period of same length)
      const periodLength = endDate.getTime() - startDate.getTime();
      const prevStart = new Date(startDate.getTime() - periodLength);
      const prevEnd = new Date(startDate.getTime() - 1);

      const prevShiftsResult = await supabase
        .from("shifts")
        .select("id")
        .eq("organization_id", organizationId)
        .gte("start_time", prevStart.toISOString())
        .lte("start_time", prevEnd.toISOString());

      const prevShiftsCount = prevShiftsResult.data?.length || 0;
      const changePercent = prevShiftsCount > 0
        ? ((shiftsData.length - prevShiftsCount) / prevShiftsCount) * 100
        : 0;
      setFilteredShiftChange(changePercent);

      // Calculate work hours
      const entries = timeEntriesResult.data || [];
      let workHours = 0;
      const userSessions: Record<string, { clockIn?: Date; totalHours: number }> = {};

      entries.forEach((entry) => {
        if (!userSessions[entry.user_id]) {
          userSessions[entry.user_id] = { totalHours: 0 };
        }

        if (entry.entry_type === "clock_in") {
          userSessions[entry.user_id].clockIn = new Date(entry.timestamp);
        } else if (entry.entry_type === "clock_out" && userSessions[entry.user_id].clockIn) {
          const clockIn = userSessions[entry.user_id].clockIn!;
          const clockOut = new Date(entry.timestamp);
          const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
          userSessions[entry.user_id].totalHours += hours;
          userSessions[entry.user_id].clockIn = undefined;
        }
      });

      Object.values(userSessions).forEach((session) => {
        workHours += session.totalHours;
      });
      setFilteredWorkHours(Math.round(workHours * 10) / 10);

      // Calculate PTO
      const ptoData = ptoResult.data || [];
      const approvedPTO = ptoData
        .filter((r) => r.status === "approved")
        .reduce((sum, r) => sum + Number(r.total_days), 0);
      setFilteredPTODays(approvedPTO);

      // PTO breakdown
      const ptoByType: Record<string, number> = {};
      ptoData.forEach((req) => {
        if (!ptoByType[req.pto_type]) {
          ptoByType[req.pto_type] = 0;
        }
        ptoByType[req.pto_type] += Number(req.total_days);
      });
      setFilteredPTOBreakdown(
        Object.entries(ptoByType).map(([type, days]) => ({ type, days }))
      );

      // Calculate tasks
      const tasksData = tasksResult.data || [];
      const completed = tasksData.filter((t) => t.status === "completed").length;
      const total = tasksData.length;
      setFilteredCompletedTasks(completed);
      setFilteredTotalTasks(total);
      setFilteredTaskRate(total > 0 ? Math.round((completed / total) * 100) : 0);

      // Calculate daily shifts
      const days: { day: string; shifts: number }[] = [];
      const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const maxDays = Math.min(dayCount, 7); // Show max 7 days

      for (let i = 0; i < maxDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dayStr = format(date, "yyyy-MM-dd");
        const count = shiftsData.filter((s) => {
          const shiftDate = format(new Date(s.start_time), "yyyy-MM-dd");
          return shiftDate === dayStr;
        }).length;
        days.push({
          day: format(date, "EEE"),
          shifts: count,
        });
      }
      setFilteredDailyShifts(days);

    } catch (error) {
      console.error("Error fetching filtered data:", error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, supabase]);

  useEffect(() => {
    if (filterPreset === "custom" && customDateRange?.from && customDateRange?.to) {
      fetchFilteredData(customDateRange.from, customDateRange.to);
    } else if (filterPreset !== "custom") {
      const { start, end } = getDateRangeFromPreset(filterPreset);
      fetchFilteredData(start, end);
    }
  }, [filterPreset, customDateRange, fetchFilteredData]);

  const handlePresetChange = (value: FilterPreset) => {
    setFilterPreset(value);
    if (value !== "custom") {
      setCustomDateRange(undefined);
    }
  };

  const currentDateRange = filterPreset === "custom" && customDateRange?.from && customDateRange?.to
    ? `${format(customDateRange.from, "MMM d, yyyy")} - ${format(customDateRange.to, "MMM d, yyyy")}`
    : filterPresetLabels[filterPreset];

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
            <CalendarIcon className="h-4 w-4 mr-2" />
            Shift Coverage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="space-y-6">
            {/* Date Filter */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Period:</span>
                <span className="font-medium">{currentDateRange}</span>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <div className="flex items-center gap-2">
                <Select value={filterPreset} onValueChange={(v) => handlePresetChange(v as FilterPreset)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                    <SelectItem value="last_week">Last Week</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="this_year">This Year</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>

                {filterPreset === "custom" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange?.from ? (
                          customDateRange.to ? (
                            <>
                              {format(customDateRange.from, "LLL dd, y")} -{" "}
                              {format(customDateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(customDateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={customDateRange?.from}
                        selected={customDateRange}
                        onSelect={setCustomDateRange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

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

              {/* Shifts */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Shifts
                  </CardTitle>
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{filteredShifts}</div>
                  <div className="flex items-center text-xs">
                    {filteredShiftChange > 0 ? (
                      <>
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-green-500">
                          +{filteredShiftChange.toFixed(1)}%
                        </span>
                      </>
                    ) : filteredShiftChange < 0 ? (
                      <>
                        <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                        <span className="text-red-500">
                          {filteredShiftChange.toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No change</span>
                    )}
                    <span className="text-muted-foreground ml-1">vs prev period</span>
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
                  <div className="text-2xl font-bold">{filteredWorkHours}</div>
                  <p className="text-xs text-muted-foreground">In selected period</p>
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
                  <div className="text-2xl font-bold">{filteredPTODays}</div>
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
                          strokeDasharray={`${filteredTaskRate * 2.51} 251`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-bold">{filteredTaskRate}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {filteredCompletedTasks} / {filteredTotalTasks}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Tasks completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Shifts Bar Chart */}
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Shifts Distribution</CardTitle>
                  <CardDescription>Daily distribution of shifts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredDailyShifts}>
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
            {filteredPTOBreakdown.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">PTO Breakdown</CardTitle>
                    <CardDescription>Days taken by type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={filteredPTOBreakdown}
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
                            {filteredPTOBreakdown.map((_, index) => (
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
                      {filteredPTOBreakdown.map((item, index) => (
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
                      {filteredPTOBreakdown.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No PTO taken in this period
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
