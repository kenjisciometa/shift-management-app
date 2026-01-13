"use client";

import { useRouter } from "next/navigation";
import { format, parseISO, differenceInMinutes, eachDayOfInterval, isSameDay } from "date-fns";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Printer,
  FileText,
  Clock,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Timesheet = Database["public"]["Tables"]["timesheets"]["Row"] & {
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  profiles_timesheets_reviewed_by_fkey: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
  } | null;
};
type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"] & {
  locations: { id: string; name: string } | null;
};

interface TimesheetDetailProps {
  timesheet: Timesheet;
  timeEntries: TimeEntry[];
  profile: Profile;
  isAdmin: boolean;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  submitted:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const statusIcons: Record<string, typeof CheckCircle2> = {
  draft: AlertCircle,
  submitted: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

export function TimesheetDetail({
  timesheet,
  timeEntries,
  profile,
  isAdmin,
}: TimesheetDetailProps) {
  const router = useRouter();

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const formatTime = (date: Date | string) => {
    return format(typeof date === "string" ? parseISO(date) : date, "h:mm a");
  };

  const getDisplayName = (p: Timesheet["profiles"]) => {
    if (!p) return "Unknown";
    if (p.display_name) return p.display_name;
    return `${p.first_name} ${p.last_name}`;
  };

  const getInitials = (p: Timesheet["profiles"]) => {
    if (!p) return "?";
    return `${p.first_name[0]}${p.last_name[0]}`.toUpperCase();
  };

  // Calculate daily breakdown from time entries
  const dailyBreakdown = (() => {
    const breakdown: Record<
      string,
      {
        date: Date;
        clockIn: Date | null;
        clockOut: Date | null;
        breaks: Array<{ start: Date; end: Date; duration: number }>;
        totalWorkMinutes: number;
        totalBreakMinutes: number;
        location: string | null;
      }
    > = {};

    let currentClockIn: Date | null = null;
    let currentBreakStart: Date | null = null;
    const dayBreaks: Record<string, Array<{ start: Date; end: Date }>> = {};

    timeEntries.forEach((entry) => {
      const entryTime = parseISO(entry.timestamp);
      const dateKey = format(entryTime, "yyyy-MM-dd");

      if (!breakdown[dateKey]) {
        breakdown[dateKey] = {
          date: entryTime,
          clockIn: null,
          clockOut: null,
          breaks: [],
          totalWorkMinutes: 0,
          totalBreakMinutes: 0,
          location: entry.locations?.name || null,
        };
        dayBreaks[dateKey] = [];
      }

      switch (entry.entry_type) {
        case "clock_in":
          currentClockIn = entryTime;
          breakdown[dateKey].clockIn = entryTime;
          breakdown[dateKey].location = entry.locations?.name || breakdown[dateKey].location;
          break;
        case "clock_out":
          if (currentClockIn) {
            breakdown[dateKey].clockOut = entryTime;
            const workMinutes = differenceInMinutes(entryTime, currentClockIn);
            const breakMinutes = dayBreaks[dateKey].reduce(
              (sum, b) => sum + differenceInMinutes(b.end, b.start),
              0
            );
            breakdown[dateKey].totalWorkMinutes = workMinutes - breakMinutes;
            breakdown[dateKey].totalBreakMinutes = breakMinutes;
            currentClockIn = null;
          }
          break;
        case "break_start":
          currentBreakStart = entryTime;
          break;
        case "break_end":
          if (currentBreakStart) {
            dayBreaks[dateKey].push({
              start: currentBreakStart,
              end: entryTime,
            });
            breakdown[dateKey].breaks.push({
              start: currentBreakStart,
              end: entryTime,
              duration: differenceInMinutes(entryTime, currentBreakStart),
            });
            currentBreakStart = null;
          }
          break;
      }
    });

    return Object.values(breakdown).sort((a, b) =>
      a.date.getTime() - b.date.getTime()
    );
  })();

  const handlePrint = () => {
    window.print();
  };

  const StatusIcon = statusIcons[timesheet.status || "draft"] || AlertCircle;

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Timesheets
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Timesheet Summary Card */}
      <Card className="print:shadow-none print:border-0">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Timesheet Details
              </CardTitle>
              <CardDescription className="mt-1">
                {format(parseISO(timesheet.period_start), "MMM d")} -{" "}
                {format(parseISO(timesheet.period_end), "MMM d, yyyy")}
              </CardDescription>
            </div>
            <Badge className={statusColors[timesheet.status || "draft"]}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {timesheet.status?.charAt(0).toUpperCase()}
              {timesheet.status?.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                Employee
              </div>
              <div className="flex items-center gap-2">
                {timesheet.profiles && (
                  <>
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={timesheet.profiles.avatar_url || undefined}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(timesheet.profiles)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {getDisplayName(timesheet.profiles)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Total Hours
              </div>
              <div className="text-lg font-semibold">
                {formatHours(Number(timesheet.total_hours || 0))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Break Hours</div>
              <div className="text-lg font-semibold">
                {formatHours(Number(timesheet.break_hours || 0))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Overtime</div>
              <div className="text-lg font-semibold text-orange-500">
                {formatHours(Number(timesheet.overtime_hours || 0))}
              </div>
            </div>
          </div>

          {/* Approval Information */}
          {(timesheet.status === "approved" ||
            timesheet.status === "rejected") && (
            <div className="mt-6 pt-6 border-t">
              <div className="space-y-2">
                <div className="text-sm font-medium">Review Information</div>
                <div className="grid gap-2 md:grid-cols-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Reviewed by: </span>
                    <span className="font-medium">
                      {timesheet.profiles_timesheets_reviewed_by_fkey
                        ? `${timesheet.profiles_timesheets_reviewed_by_fkey.first_name} ${timesheet.profiles_timesheets_reviewed_by_fkey.last_name}`
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reviewed at: </span>
                    <span className="font-medium">
                      {timesheet.reviewed_at
                        ? format(
                            parseISO(timesheet.reviewed_at),
                            "MMM d, yyyy h:mm a"
                          )
                        : "N/A"}
                    </span>
                  </div>
                </div>
                {timesheet.review_comment && (
                  <div className="mt-2">
                    <span className="text-sm text-muted-foreground">
                      Comment:{" "}
                    </span>
                    <p className="text-sm mt-1 p-2 bg-muted rounded-md">
                      {timesheet.review_comment}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submission Information */}
          {timesheet.submitted_at && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm">
                <span className="text-muted-foreground">Submitted at: </span>
                <span className="font-medium">
                  {format(
                    parseISO(timesheet.submitted_at),
                    "MMM d, yyyy h:mm a"
                  )}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Breakdown */}
      <Card className="print:shadow-none print:border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Daily Breakdown
          </CardTitle>
          <CardDescription>
            Detailed work hours for each day in this period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dailyBreakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead className="text-right">Work Hours</TableHead>
                    <TableHead className="text-right">Break Hours</TableHead>
                    <TableHead className="text-right">Breaks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyBreakdown.map((day, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {format(day.date, "EEE, MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{day.location || "-"}</TableCell>
                      <TableCell>
                        {day.clockIn ? formatTime(day.clockIn) : "-"}
                      </TableCell>
                      <TableCell>
                        {day.clockOut ? formatTime(day.clockOut) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatHours(day.totalWorkMinutes / 60)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatHours(day.totalBreakMinutes / 60)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {day.breaks.length > 0
                          ? `${day.breaks.length} break${day.breaks.length > 1 ? "s" : ""}`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No time entries found for this period</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-0 {
            border: none !important;
          }
          .print\\:space-y-4 > * + * {
            margin-top: 1rem !important;
          }
        }
      `}</style>
    </div>
  );
}
