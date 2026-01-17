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
import { apiGet } from "@/lib/api-client";
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

  interface DashboardReportData {
    shifts: {
      count: number;
      changePercent: number;
      dailyCounts: { day: string; shifts: number }[];
    };
    workHours: number;
    pto: {
      approvedDays: number;
      breakdown: { type: string; days: number }[];
    };
    tasks: {
      completionRate: number;
      completed: number;
      total: number;
    };
  }

  const fetchFilteredData = useCallback(async (startDate: Date, endDate: Date) => {
    setLoading(true);

    try {
      const response = await apiGet<DashboardReportData>("/api/reports/dashboard", {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to fetch report data");
      }

      const data = response.data;

      // Update state with API response
      setFilteredShifts(data.shifts.count);
      setFilteredShiftChange(data.shifts.changePercent);
      setFilteredDailyShifts(data.shifts.dailyCounts);
      setFilteredWorkHours(data.workHours);
      setFilteredPTODays(data.pto.approvedDays);
      setFilteredPTOBreakdown(data.pto.breakdown);
      setFilteredTaskRate(data.tasks.completionRate);
      setFilteredCompletedTasks(data.tasks.completed);
      setFilteredTotalTasks(data.tasks.total);
    } catch (error) {
      console.error("Error fetching filtered data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

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
