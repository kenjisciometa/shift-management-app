"use client";

import { useState, useMemo } from "react";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, differenceInMinutes } from "date-fns";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Download, Clock, Calendar, Users } from "lucide-react";
import { toast } from "sonner";

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

interface WorkHoursReportProps {
  timeEntries: TimeEntry[];
  organizationId: string;
}

type DateRange = "this_week" | "last_week" | "this_month" | "last_month" | "all";

interface UserWorkData {
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  sessions: {
    date: string;
    clockIn: string;
    clockOut: string | null;
    duration: number;
    location: string | null;
  }[];
}

export function WorkHoursReport({
  timeEntries,
  organizationId,
}: WorkHoursReportProps) {
  const [dateRange, setDateRange] = useState<DateRange>("this_month");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

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
      default:
        return null;
    }
  };

  // Filter and process time entries
  const workData = useMemo(() => {
    const bounds = getDateBounds(dateRange);
    let filtered = timeEntries;

    if (bounds) {
      filtered = timeEntries.filter((entry) => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= bounds.start && entryDate <= bounds.end;
      });
    }

    // Group by user and calculate work hours
    const userMap = new Map<string, UserWorkData>();

    // Sort entries by timestamp
    const sorted = [...filtered].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Track sessions per user
    const userSessions = new Map<string, { clockIn: TimeEntry | null }>();

    sorted.forEach((entry) => {
      const profile = entry.profiles;
      if (!profile) return;

      const userId = entry.user_id;
      const name = profile.display_name || `${profile.first_name} ${profile.last_name}`;

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          name,
          avatarUrl: profile.avatar_url,
          totalMinutes: 0,
          regularMinutes: 0,
          overtimeMinutes: 0,
          sessions: [],
        });
      }

      if (!userSessions.has(userId)) {
        userSessions.set(userId, { clockIn: null });
      }

      const userData = userMap.get(userId)!;
      const session = userSessions.get(userId)!;

      if (entry.entry_type === "clock_in") {
        session.clockIn = entry;
      } else if (entry.entry_type === "clock_out" && session.clockIn) {
        const clockInTime = new Date(session.clockIn.timestamp);
        const clockOutTime = new Date(entry.timestamp);
        const duration = differenceInMinutes(clockOutTime, clockInTime);

        userData.sessions.push({
          date: format(clockInTime, "yyyy-MM-dd"),
          clockIn: format(clockInTime, "HH:mm"),
          clockOut: format(clockOutTime, "HH:mm"),
          duration,
          location: session.clockIn.locations?.name || null,
        });

        userData.totalMinutes += duration;
        // Assume 8 hours (480 minutes) per day is regular
        userData.regularMinutes += Math.min(duration, 480);
        if (duration > 480) {
          userData.overtimeMinutes += duration - 480;
        }

        session.clockIn = null;
      }
    });

    // Handle unclosed sessions (still clocked in)
    userSessions.forEach((session, userId) => {
      if (session.clockIn) {
        const userData = userMap.get(userId);
        if (userData) {
          const clockInTime = new Date(session.clockIn.timestamp);
          userData.sessions.push({
            date: format(clockInTime, "yyyy-MM-dd"),
            clockIn: format(clockInTime, "HH:mm"),
            clockOut: null,
            duration: 0,
            location: session.clockIn.locations?.name || null,
          });
        }
      }
    });

    return Array.from(userMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [timeEntries, dateRange]);

  // Format minutes to hours and minutes
  const formatDuration = (minutes: number) => {
    if (minutes === 0) return "0h";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  // Calculate totals
  const totals = useMemo(() => {
    return workData.reduce(
      (acc, user) => ({
        totalMinutes: acc.totalMinutes + user.totalMinutes,
        regularMinutes: acc.regularMinutes + user.regularMinutes,
        overtimeMinutes: acc.overtimeMinutes + user.overtimeMinutes,
        employeeCount: acc.employeeCount + 1,
      }),
      { totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0, employeeCount: 0 }
    );
  }, [workData]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Employee",
      "Date",
      "Clock In",
      "Clock Out",
      "Duration (hours)",
      "Location",
    ];

    const rows: string[][] = [];

    workData.forEach((user) => {
      user.sessions.forEach((session) => {
        rows.push([
          user.name,
          session.date,
          session.clockIn,
          session.clockOut || "In Progress",
          (session.duration / 60).toFixed(2),
          session.location || "N/A",
        ]);
      });
    });

    // Add summary rows
    rows.push([]);
    rows.push(["Summary"]);
    rows.push(["Total Employees", String(totals.employeeCount)]);
    rows.push(["Total Hours", (totals.totalMinutes / 60).toFixed(2)]);
    rows.push(["Regular Hours", (totals.regularMinutes / 60).toFixed(2)]);
    rows.push(["Overtime Hours", (totals.overtimeMinutes / 60).toFixed(2)]);

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
      `work-hours-report-${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Report exported successfully");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Work Hours Report</h2>
          <p className="text-sm text-muted-foreground">
            Detailed breakdown of employee work hours
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="last_week">Last Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportToCSV} disabled={workData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Employees
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.employeeCount}</div>
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
            <div className="text-2xl font-bold">
              {formatDuration(totals.totalMinutes)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Regular Hours
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(totals.regularMinutes)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overtime
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {formatDuration(totals.overtimeMinutes)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Work Hours</CardTitle>
          <CardDescription>
            Click on an employee to see detailed sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Total Hours</TableHead>
                  <TableHead className="text-right">Regular</TableHead>
                  <TableHead className="text-right">Overtime</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workData.map((user) => (
                  <>
                    <TableRow
                      key={user.userId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setExpandedUser(
                          expandedUser === user.userId ? null : user.userId
                        )
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatDuration(user.totalMinutes)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDuration(user.regularMinutes)}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.overtimeMinutes > 0 ? (
                          <span className="text-orange-500">
                            {formatDuration(user.overtimeMinutes)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{user.sessions.length}</Badge>
                      </TableCell>
                    </TableRow>
                    {expandedUser === user.userId && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30 p-4">
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium mb-3">
                              Session Details
                            </h4>
                            <div className="grid gap-2">
                              {user.sessions.map((session, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-sm bg-background rounded-lg p-3"
                                >
                                  <div className="flex items-center gap-4">
                                    <span className="font-medium">
                                      {format(
                                        parseISO(session.date),
                                        "MMM d, yyyy"
                                      )}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {session.clockIn} -{" "}
                                      {session.clockOut || (
                                        <Badge variant="outline" className="text-xs">
                                          In Progress
                                        </Badge>
                                      )}
                                    </span>
                                    {session.location && (
                                      <Badge variant="outline" className="text-xs">
                                        {session.location}
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="font-medium">
                                    {session.clockOut
                                      ? formatDuration(session.duration)
                                      : "-"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-10">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No work hours recorded</p>
              <p className="text-sm text-muted-foreground">
                Time entries will appear here once employees clock in
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
