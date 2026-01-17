"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, differenceInMinutes, setHours, setMinutes } from "date-fns";
import type { Database } from "@/types/database.types";
import { apiPut } from "@/lib/api-client";
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
  Download,
  Pencil,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Timesheet = Database["public"]["Tables"]["timesheets"]["Row"] & {
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  profiles_timesheets_reviewed_by_fkey?: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
  } | null;
};
type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"] & {
  locations: { id: string; name: string } | null;
};

type Shift = {
  id: string;
  start_time: string;
  end_time: string;
  break_minutes: number | null;
};

interface TimesheetDetailProps {
  timesheet: Timesheet;
  timeEntries: TimeEntry[];
  shifts: Shift[];
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
  timeEntries: initialTimeEntries,
  shifts,
  profile,
  isAdmin,
}: TimesheetDetailProps) {
  const router = useRouter();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(initialTimeEntries);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{
    entryId: string;
    type: "clock_in" | "clock_out";
    currentTime: Date;
    dateKey: string;
  } | null>(null);
  const [editTime, setEditTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);

  // Check if user can edit time entries
  const canEditTime = profile.allow_time_edit || isAdmin;
  // Only allow editing own timesheet unless admin
  const canEditThisTimesheet = isAdmin || (timesheet.user_id === profile.id && canEditTime);

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
        clockInEntryId: string | null;
        clockOutEntryId: string | null;
        breaks: Array<{ start: Date; end: Date; duration: number }>;
        totalWorkMinutes: number;
        totalBreakMinutes: number;
        scheduledMinutes: number;
        differenceMinutes: number;
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
        // Find scheduled shift for this day
        const dayShift = shifts.find((shift) => {
          const shiftDate = shift.start_time.split("T")[0];
          return shiftDate === dateKey;
        });

        let scheduledMinutes = 0;
        if (dayShift) {
          const shiftStart = new Date(dayShift.start_time).getTime();
          const shiftEnd = new Date(dayShift.end_time).getTime();
          const shiftBreakMinutes = dayShift.break_minutes || 0;
          scheduledMinutes = Math.round((shiftEnd - shiftStart) / 60000) - shiftBreakMinutes;
        }

        breakdown[dateKey] = {
          date: entryTime,
          clockIn: null,
          clockOut: null,
          clockInEntryId: null,
          clockOutEntryId: null,
          breaks: [],
          totalWorkMinutes: 0,
          totalBreakMinutes: 0,
          scheduledMinutes,
          differenceMinutes: 0,
          location: entry.locations?.name || null,
        };
        dayBreaks[dateKey] = [];
      }

      switch (entry.entry_type) {
        case "clock_in":
          currentClockIn = entryTime;
          breakdown[dateKey].clockIn = entryTime;
          breakdown[dateKey].clockInEntryId = entry.id;
          breakdown[dateKey].location = entry.locations?.name || breakdown[dateKey].location;
          break;
        case "clock_out":
          if (currentClockIn) {
            breakdown[dateKey].clockOut = entryTime;
            breakdown[dateKey].clockOutEntryId = entry.id;
            const workMinutes = differenceInMinutes(entryTime, currentClockIn);
            const breakMinutes = dayBreaks[dateKey].reduce(
              (sum, b) => sum + differenceInMinutes(b.end, b.start),
              0
            );
            breakdown[dateKey].totalWorkMinutes = workMinutes - breakMinutes;
            breakdown[dateKey].totalBreakMinutes = breakMinutes;
            breakdown[dateKey].differenceMinutes = breakdown[dateKey].totalWorkMinutes - breakdown[dateKey].scheduledMinutes;
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

  // Calculate actual totals from time entries (not stored values)
  const calculatedTotals = (() => {
    const totalWorkMinutes = dailyBreakdown.reduce(
      (sum, day) => sum + day.totalWorkMinutes,
      0
    );
    const totalBreakMinutes = dailyBreakdown.reduce(
      (sum, day) => sum + day.totalBreakMinutes,
      0
    );
    const totalScheduledMinutes = dailyBreakdown.reduce(
      (sum, day) => sum + day.scheduledMinutes,
      0
    );
    const totalDifferenceMinutes = totalWorkMinutes - totalScheduledMinutes;
    // Overtime is calculated as hours exceeding 40 per week
    const regularHoursLimit = 40 * 60; // 40 hours in minutes
    const overtimeMinutes = Math.max(0, totalWorkMinutes - regularHoursLimit);

    return {
      totalHours: totalWorkMinutes / 60,
      breakHours: totalBreakMinutes / 60,
      overtimeHours: overtimeMinutes / 60,
      scheduledHours: totalScheduledMinutes / 60,
      differenceHours: totalDifferenceMinutes / 60,
    };
  })();

  // Handle opening the edit dialog
  const handleEditTime = (
    entryId: string,
    type: "clock_in" | "clock_out",
    currentTime: Date,
    dateKey: string
  ) => {
    setEditingEntry({ entryId, type, currentTime, dateKey });
    setEditTime(format(currentTime, "HH:mm"));
    setEditDialogOpen(true);
  };

  // Handle saving the edited time
  const handleSaveTime = async () => {
    if (!editingEntry || !editTime) return;

    setIsSaving(true);
    try {
      const [hours, minutes] = editTime.split(":").map(Number);
      const newTimestamp = setMinutes(setHours(editingEntry.currentTime, hours), minutes);

      const response = await apiPut(`/api/time-entries/${editingEntry.entryId}`, {
        timestamp: newTimestamp.toISOString(),
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to update time entry");
      }

      // Update local state
      setTimeEntries((prev) =>
        prev.map((entry) =>
          entry.id === editingEntry.entryId
            ? { ...entry, timestamp: newTimestamp.toISOString() }
            : entry
        )
      );

      toast.success(`${editingEntry.type === "clock_in" ? "Clock In" : "Clock Out"} time updated`);
      setEditDialogOpen(false);
      setEditingEntry(null);
    } catch (error) {
      console.error("Error updating time entry:", error);
      toast.error("Failed to update time entry");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle resubmitting a rejected timesheet
  const handleResubmit = async () => {
    setIsResubmitting(true);
    try {
      const response = await fetch(`/api/timesheets/${timesheet.id}/submit`, {
        method: "PUT",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resubmit timesheet");
      }

      toast.success("Timesheet resubmitted for approval");
      router.refresh();
    } catch (error) {
      console.error("Error resubmitting timesheet:", error);
      toast.error(error instanceof Error ? error.message : "Failed to resubmit timesheet");
    } finally {
      setIsResubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const exportToCSV = () => {
    const headers = [
      "Date",
      "Day",
      "Location",
      "Clock In",
      "Clock Out",
      "Scheduled Hours",
      "Actual Hours",
      "Difference",
      "Break Hours",
    ];

    const rows = dailyBreakdown.map((day) => [
      format(day.date, "yyyy-MM-dd"),
      format(day.date, "EEEE"),
      day.location || "N/A",
      day.clockIn ? formatTime(day.clockIn) : "N/A",
      day.clockOut ? formatTime(day.clockOut) : "N/A",
      day.scheduledMinutes > 0 ? formatHours(day.scheduledMinutes / 60) : "N/A",
      formatHours(day.totalWorkMinutes / 60),
      day.scheduledMinutes > 0 ? `${day.differenceMinutes > 0 ? "+" : ""}${formatHours(day.differenceMinutes / 60)}` : "N/A",
      formatHours(day.totalBreakMinutes / 60),
    ]);

    // Add summary rows
    rows.push([]);
    rows.push(["Summary"]);
    rows.push([
      "Employee",
      getDisplayName(timesheet.profiles),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    rows.push([
      "Period",
      `${format(parseISO(timesheet.period_start), "MMM d")} - ${format(parseISO(timesheet.period_end), "MMM d, yyyy")}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    rows.push([
      "Scheduled Hours",
      formatHours(calculatedTotals.scheduledHours),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    rows.push([
      "Actual Hours",
      formatHours(calculatedTotals.totalHours),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    rows.push([
      "Difference",
      `${calculatedTotals.differenceHours > 0 ? "+" : ""}${formatHours(calculatedTotals.differenceHours)}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    rows.push([
      "Break Hours",
      formatHours(calculatedTotals.breakHours),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    rows.push([
      "Overtime Hours",
      formatHours(calculatedTotals.overtimeHours),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    rows.push(["Status", timesheet.status || "N/A", "", "", "", "", "", "", ""]);

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
      `timesheet-${format(parseISO(timesheet.period_start), "yyyy-MM-dd")}-${format(parseISO(timesheet.period_end), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Timesheet exported to CSV");
  };

  const exportToPDF = async () => {
    try {
      // Open PDF in new window for printing/saving
      const pdfWindow = window.open(
        `/api/timesheets/${timesheet.id}/export?format=pdf`,
        "_blank"
      );
      
      if (!pdfWindow) {
        toast.error("Please allow popups to export PDF");
        return;
      }

      toast.success("Opening PDF...");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export PDF. Please try again.");
    }
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
          {/* Resubmit button for rejected timesheets */}
          {timesheet.status === "rejected" && timesheet.user_id === profile.id && (
            <Button
              onClick={handleResubmit}
              disabled={isResubmitting}
            >
              {isResubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Resubmit
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV}>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF}>
                <FileText className="h-4 w-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
              <div className="text-sm text-muted-foreground">Scheduled</div>
              <div className="text-lg font-semibold text-muted-foreground">
                {formatHours(calculatedTotals.scheduledHours)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Actual Hours
              </div>
              <div className="text-lg font-semibold">
                {formatHours(calculatedTotals.totalHours)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Difference</div>
              <div className={`text-lg font-semibold ${calculatedTotals.differenceHours > 0 ? "text-green-600" : calculatedTotals.differenceHours < 0 ? "text-red-600" : ""}`}>
                {calculatedTotals.differenceHours > 0 ? "+" : ""}{formatHours(calculatedTotals.differenceHours)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Break Hours</div>
              <div className="text-lg font-semibold">
                {formatHours(calculatedTotals.breakHours)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Overtime</div>
              <div className="text-lg font-semibold text-orange-500">
                {formatHours(calculatedTotals.overtimeHours)}
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
                    <TableHead className="text-right">Scheduled</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Diff</TableHead>
                    <TableHead className="text-right">Break</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyBreakdown.map((day, index) => {
                    const dateKey = format(day.date, "yyyy-MM-dd");
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {format(day.date, "EEE, MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{day.location || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {day.clockIn ? formatTime(day.clockIn) : "-"}
                            {canEditThisTimesheet && day.clockIn && day.clockInEntryId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 print:hidden"
                                onClick={() =>
                                  handleEditTime(
                                    day.clockInEntryId!,
                                    "clock_in",
                                    day.clockIn!,
                                    dateKey
                                  )
                                }
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {day.clockOut ? formatTime(day.clockOut) : "-"}
                            {canEditThisTimesheet && day.clockOut && day.clockOutEntryId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 print:hidden"
                                onClick={() =>
                                  handleEditTime(
                                    day.clockOutEntryId!,
                                    "clock_out",
                                    day.clockOut!,
                                    dateKey
                                  )
                                }
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {day.scheduledMinutes > 0 ? formatHours(day.scheduledMinutes / 60) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatHours(day.totalWorkMinutes / 60)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${day.differenceMinutes > 0 ? "text-green-600" : day.differenceMinutes < 0 ? "text-red-600" : ""}`}>
                          {day.scheduledMinutes > 0 ? (
                            <>
                              {day.differenceMinutes > 0 ? "+" : ""}
                              {formatHours(day.differenceMinutes / 60)}
                            </>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatHours(day.totalBreakMinutes / 60)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      {/* Edit Time Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              Edit {editingEntry?.type === "clock_in" ? "Clock In" : "Clock Out"} Time
            </DialogTitle>
            <DialogDescription>
              Update the time for this entry. Changes will be reflected in the timesheet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-time">Time</Label>
              <Input
                id="edit-time"
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
              />
            </div>
            {editingEntry && (
              <p className="text-sm text-muted-foreground">
                Date: {format(editingEntry.currentTime, "EEEE, MMMM d, yyyy")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTime} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
