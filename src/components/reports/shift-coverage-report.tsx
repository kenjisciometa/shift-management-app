"use client";

import { useState, useMemo } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
  eachDayOfInterval,
  parseISO,
  isSameDay,
  differenceInHours,
} from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, Calendar, Users, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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

interface ShiftCoverageReportProps {
  shifts: Shift[];
  organizationId: string;
}

type DateRange = "this_week" | "last_week" | "this_month" | "last_month";
type ViewMode = "daily" | "location";

interface DailyCoverage {
  date: Date;
  totalShifts: number;
  filledShifts: number;
  unfilledShifts: number;
  totalHours: number;
  coveragePercent: number;
}

interface LocationCoverage {
  locationId: string;
  locationName: string;
  totalShifts: number;
  filledShifts: number;
  unfilledShifts: number;
  totalHours: number;
  coveragePercent: number;
}

export function ShiftCoverageReport({
  shifts,
  organizationId,
}: ShiftCoverageReportProps) {
  const [dateRange, setDateRange] = useState<DateRange>("this_week");
  const [viewMode, setViewMode] = useState<ViewMode>("daily");

  // Get date range boundaries
  const getDateBounds = (range: DateRange) => {
    const now = new Date();
    switch (range) {
      case "this_week":
        return {
          start: startOfWeek(now, { weekStartsOn: 0 }),
          end: endOfWeek(now, { weekStartsOn: 0 }),
        };
      case "last_week":
        return {
          start: startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }),
          end: endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }),
        };
      case "this_month":
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
      case "last_month":
        return {
          start: startOfMonth(subMonths(now, 1)),
          end: endOfMonth(subMonths(now, 1)),
        };
    }
  };

  // Filter and calculate coverage data
  const coverageData = useMemo(() => {
    const bounds = getDateBounds(dateRange);
    const filtered = shifts.filter((shift) => {
      const shiftDate = new Date(shift.start_time);
      return shiftDate >= bounds.start && shiftDate <= bounds.end;
    });

    if (viewMode === "daily") {
      const days = eachDayOfInterval({ start: bounds.start, end: bounds.end });
      const dailyData: DailyCoverage[] = days.map((date) => {
        const dayShifts = filtered.filter((shift) =>
          isSameDay(parseISO(shift.start_time), date)
        );

        const filledShifts = dayShifts.filter(
          (s) => s.user_id && s.status !== "cancelled"
        ).length;
        const unfilledShifts = dayShifts.filter(
          (s) => !s.user_id || s.status === "open"
        ).length;
        const totalShifts = dayShifts.length;

        const totalHours = dayShifts.reduce((sum, shift) => {
          return (
            sum +
            differenceInHours(parseISO(shift.end_time), parseISO(shift.start_time))
          );
        }, 0);

        return {
          date,
          totalShifts,
          filledShifts,
          unfilledShifts,
          totalHours,
          coveragePercent: totalShifts > 0 ? (filledShifts / totalShifts) * 100 : 100,
        };
      });

      return { type: "daily" as const, data: dailyData };
    } else {
      const locationMap = new Map<string, LocationCoverage>();

      filtered.forEach((shift) => {
        const locationId = shift.locations?.id || "no-location";
        const locationName = shift.locations?.name || "No Location";

        if (!locationMap.has(locationId)) {
          locationMap.set(locationId, {
            locationId,
            locationName,
            totalShifts: 0,
            filledShifts: 0,
            unfilledShifts: 0,
            totalHours: 0,
            coveragePercent: 0,
          });
        }

        const loc = locationMap.get(locationId)!;
        loc.totalShifts += 1;

        if (shift.user_id && shift.status !== "cancelled") {
          loc.filledShifts += 1;
        } else if (!shift.user_id || shift.status === "open") {
          loc.unfilledShifts += 1;
        }

        loc.totalHours += differenceInHours(
          parseISO(shift.end_time),
          parseISO(shift.start_time)
        );
      });

      // Calculate coverage percentages
      locationMap.forEach((loc) => {
        loc.coveragePercent =
          loc.totalShifts > 0 ? (loc.filledShifts / loc.totalShifts) * 100 : 100;
      });

      return {
        type: "location" as const,
        data: Array.from(locationMap.values()).sort(
          (a, b) => b.totalShifts - a.totalShifts
        ),
      };
    }
  }, [shifts, dateRange, viewMode]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const bounds = getDateBounds(dateRange);
    const filtered = shifts.filter((shift) => {
      const shiftDate = new Date(shift.start_time);
      return shiftDate >= bounds.start && shiftDate <= bounds.end;
    });

    const totalShifts = filtered.length;
    const filledShifts = filtered.filter(
      (s) => s.user_id && s.status !== "cancelled"
    ).length;
    const unfilledShifts = filtered.filter(
      (s) => !s.user_id || s.status === "open"
    ).length;
    const totalHours = filtered.reduce((sum, shift) => {
      return (
        sum + differenceInHours(parseISO(shift.end_time), parseISO(shift.start_time))
      );
    }, 0);
    const coveragePercent =
      totalShifts > 0 ? (filledShifts / totalShifts) * 100 : 100;

    return {
      totalShifts,
      filledShifts,
      unfilledShifts,
      totalHours,
      coveragePercent,
    };
  }, [shifts, dateRange]);

  // Export to CSV
  const exportToCSV = () => {
    let headers: string[];
    let rows: string[][];

    if (coverageData.type === "daily") {
      headers = [
        "Date",
        "Day",
        "Total Shifts",
        "Filled",
        "Unfilled",
        "Total Hours",
        "Coverage %",
      ];
      rows = coverageData.data.map((day) => [
        format(day.date, "yyyy-MM-dd"),
        format(day.date, "EEEE"),
        String(day.totalShifts),
        String(day.filledShifts),
        String(day.unfilledShifts),
        String(day.totalHours),
        `${day.coveragePercent.toFixed(1)}%`,
      ]);
    } else {
      headers = [
        "Location",
        "Total Shifts",
        "Filled",
        "Unfilled",
        "Total Hours",
        "Coverage %",
      ];
      rows = coverageData.data.map((loc) => [
        loc.locationName,
        String(loc.totalShifts),
        String(loc.filledShifts),
        String(loc.unfilledShifts),
        String(loc.totalHours),
        `${loc.coveragePercent.toFixed(1)}%`,
      ]);
    }

    // Add summary
    rows.push([]);
    rows.push(["Summary"]);
    rows.push(["Total Shifts", String(summary.totalShifts)]);
    rows.push(["Filled Shifts", String(summary.filledShifts)]);
    rows.push(["Unfilled Shifts", String(summary.unfilledShifts)]);
    rows.push(["Total Hours", String(summary.totalHours)]);
    rows.push(["Overall Coverage", `${summary.coveragePercent.toFixed(1)}%`]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `shift-coverage-report-${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Report exported successfully");
  };

  const getCoverageColor = (percent: number) => {
    if (percent >= 90) return "text-green-500";
    if (percent >= 70) return "text-yellow-500";
    return "text-red-500";
  };

  const getCoverageBadge = (percent: number) => {
    if (percent >= 90)
      return { variant: "default" as const, icon: CheckCircle, label: "Good" };
    if (percent >= 70)
      return { variant: "secondary" as const, icon: AlertCircle, label: "Fair" };
    return { variant: "destructive" as const, icon: XCircle, label: "Low" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Shift Coverage Report</h2>
          <p className="text-sm text-muted-foreground">
            Analyze shift coverage and staffing levels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="View by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">By Day</SelectItem>
              <SelectItem value="location">By Location</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={dateRange}
            onValueChange={(v) => setDateRange(v as DateRange)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="last_week">Last Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Shifts
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalShifts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Filled
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {summary.filledShifts}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unfilled
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {summary.unfilledShifts}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Hours
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalHours}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coverage
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getCoverageColor(summary.coveragePercent)}`}>
              {summary.coveragePercent.toFixed(0)}%
            </div>
            <Progress value={summary.coveragePercent} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Coverage Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {viewMode === "daily" ? "Daily Coverage" : "Coverage by Location"}
          </CardTitle>
          <CardDescription>
            {viewMode === "daily"
              ? "Shift coverage breakdown by day"
              : "Shift coverage breakdown by location"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coverageData.type === "daily" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Filled</TableHead>
                  <TableHead className="text-right">Unfilled</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coverageData.data.map((day) => {
                  const badge = getCoverageBadge(day.coveragePercent);
                  return (
                    <TableRow key={day.date.toISOString()}>
                      <TableCell className="font-medium">
                        {format(day.date, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{format(day.date, "EEEE")}</TableCell>
                      <TableCell className="text-right">{day.totalShifts}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {day.filledShifts}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {day.unfilledShifts}
                      </TableCell>
                      <TableCell className="text-right">{day.totalHours}h</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={getCoverageColor(day.coveragePercent)}>
                            {day.coveragePercent.toFixed(0)}%
                          </span>
                          <Badge variant={badge.variant} className="text-xs">
                            {badge.label}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Filled</TableHead>
                  <TableHead className="text-right">Unfilled</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coverageData.data.map((loc) => {
                  const badge = getCoverageBadge(loc.coveragePercent);
                  return (
                    <TableRow key={loc.locationId}>
                      <TableCell className="font-medium">
                        {loc.locationName}
                      </TableCell>
                      <TableCell className="text-right">{loc.totalShifts}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {loc.filledShifts}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {loc.unfilledShifts}
                      </TableCell>
                      <TableCell className="text-right">{loc.totalHours}h</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={getCoverageColor(loc.coveragePercent)}>
                            {loc.coveragePercent.toFixed(0)}%
                          </span>
                          <Badge variant={badge.variant} className="text-xs">
                            {badge.label}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {coverageData.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No shifts found</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
