"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, differenceInMinutes, isSameDay, startOfWeek, endOfWeek, subWeeks, addWeeks } from "date-fns";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  Calendar,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Timesheet = Database["public"]["Tables"]["timesheets"]["Row"];
type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"] & {
  locations: { id: string; name: string } | null;
};

type PendingTimesheet = Timesheet & {
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

interface TimesheetsDashboardProps {
  profile: Profile;
  timesheets: Timesheet[];
  timeEntries: TimeEntry[];
  pendingTimesheets: PendingTimesheet[];
  isAdmin: boolean;
  currentWeekStart: Date;
  currentWeekEnd: Date;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  submitted:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function TimesheetsDashboard({
  profile,
  timesheets,
  timeEntries,
  pendingTimesheets,
  isAdmin,
  currentWeekStart,
  currentWeekEnd,
}: TimesheetsDashboardProps) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] =
    useState<PendingTimesheet | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate work hours from time entries
  const calculatedHours = useMemo(() => {
    const dailyHours: Record<string, { regular: number; break: number }> = {};
    let clockInTime: Date | null = null;
    let breakStartTime: Date | null = null;
    let totalBreakMinutes = 0;

    timeEntries.forEach((entry) => {
      const entryTime = parseISO(entry.timestamp);
      const dateKey = format(entryTime, "yyyy-MM-dd");

      if (!dailyHours[dateKey]) {
        dailyHours[dateKey] = { regular: 0, break: 0 };
      }

      switch (entry.entry_type) {
        case "clock_in":
          clockInTime = entryTime;
          totalBreakMinutes = 0;
          break;
        case "clock_out":
          if (clockInTime) {
            const workMinutes =
              differenceInMinutes(entryTime, clockInTime) - totalBreakMinutes;
            dailyHours[dateKey].regular += workMinutes / 60;
            dailyHours[dateKey].break += totalBreakMinutes / 60;
            clockInTime = null;
            totalBreakMinutes = 0;
          }
          break;
        case "break_start":
          breakStartTime = entryTime;
          break;
        case "break_end":
          if (breakStartTime) {
            totalBreakMinutes += differenceInMinutes(entryTime, breakStartTime);
            breakStartTime = null;
          }
          break;
      }
    });

    const totalRegular = Object.values(dailyHours).reduce(
      (sum, d) => sum + d.regular,
      0
    );
    const totalBreak = Object.values(dailyHours).reduce(
      (sum, d) => sum + d.break,
      0
    );
    const overtimeHours = Math.max(0, totalRegular - 40);

    return {
      dailyHours,
      totalRegular,
      totalBreak,
      overtimeHours,
    };
  }, [timeEntries]);

  const handleGenerateTimesheet = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/timesheets/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          period_start: format(currentWeekStart, "yyyy-MM-dd"),
          period_end: format(currentWeekEnd, "yyyy-MM-dd"),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate timesheet");
      }

      toast.success("Timesheet generated successfully");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to generate timesheet");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitTimesheet = async () => {
    setProcessingId("submit");
    try {
      // First, generate or get the timesheet
      let timesheetId: string | null = null;

      // Check if timesheet already exists
      const checkResponse = await fetch(
        `/api/timesheets?period_start=${format(currentWeekStart, "yyyy-MM-dd")}&period_end=${format(currentWeekEnd, "yyyy-MM-dd")}&user_id=${profile.id}`
      );
      const checkData = await checkResponse.json();

      if (checkData.data && checkData.data.length > 0) {
        timesheetId = checkData.data[0].id;
      } else {
        // Generate timesheet from time entries
        const generateResponse = await fetch("/api/timesheets/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            period_start: format(currentWeekStart, "yyyy-MM-dd"),
            period_end: format(currentWeekEnd, "yyyy-MM-dd"),
          }),
        });

        const generateData = await generateResponse.json();

        if (!generateResponse.ok) {
          throw new Error(generateData.error || "Failed to generate timesheet");
        }

        timesheetId = generateData.data.id;
      }

      if (!timesheetId) {
        throw new Error("Failed to create timesheet");
      }

      // Submit the timesheet
      const submitResponse = await fetch(`/api/timesheets/${timesheetId}/submit`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const submitData = await submitResponse.json();

      if (!submitResponse.ok) {
        throw new Error(submitData.error || "Failed to submit timesheet");
      }

      toast.success("Timesheet submitted for approval");
      setSubmitDialogOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to submit timesheet");
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (timesheetId: string) => {
    setProcessingId(timesheetId);
    try {
      const response = await fetch(`/api/timesheets/${timesheetId}/approve`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          review_comment: reviewComment || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve timesheet");
      }

      toast.success("Timesheet approved");
      setDetailDialogOpen(false);
      setSelectedTimesheet(null);
      setReviewComment("");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to approve timesheet");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (timesheetId: string) => {
    if (!reviewComment.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setProcessingId(timesheetId);
    try {
      const response = await fetch(`/api/timesheets/${timesheetId}/reject`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          review_comment: reviewComment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject timesheet");
      }

      toast.success("Timesheet rejected");
      setDetailDialogOpen(false);
      setSelectedTimesheet(null);
      setReviewComment("");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to reject timesheet");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      toast.success("Data refreshed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const getDisplayName = (p: PendingTimesheet["profiles"]) => {
    if (!p) return "Unknown";
    if (p.display_name) return p.display_name;
    return `${p.first_name} ${p.last_name}`;
  };

  const getInitials = (p: PendingTimesheet["profiles"]) => {
    if (!p) return "?";
    return `${p.first_name[0]}${p.last_name[0]}`.toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Current Period Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Current Period
                </CardTitle>
                <CardDescription>
                  {format(currentWeekStart, "MMM d")} -{" "}
                  {format(currentWeekEnd, "MMM d, yyyy")}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const prevWeek = subWeeks(currentWeekStart, 1);
                    const prevWeekEnd = endOfWeek(prevWeek, { weekStartsOn: 0 });
                    router.push(`/timesheets?period_start=${format(prevWeek, "yyyy-MM-dd")}&period_end=${format(prevWeekEnd, "yyyy-MM-dd")}`);
                    router.refresh();
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
                    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
                    router.push(`/timesheets?period_start=${format(weekStart, "yyyy-MM-dd")}&period_end=${format(weekEnd, "yyyy-MM-dd")}`);
                    router.refresh();
                  }}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextWeek = addWeeks(currentWeekStart, 1);
                    const nextWeekEnd = endOfWeek(nextWeek, { weekStartsOn: 0 });
                    router.push(`/timesheets?period_start=${format(nextWeek, "yyyy-MM-dd")}&period_end=${format(nextWeekEnd, "yyyy-MM-dd")}`);
                    router.refresh();
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Regular Hours</div>
              <div className="text-2xl font-bold">
                {formatHours(calculatedHours.totalRegular)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Break Hours</div>
              <div className="text-2xl font-bold">
                {formatHours(calculatedHours.totalBreak)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Overtime</div>
              <div className="text-2xl font-bold text-orange-500">
                {formatHours(calculatedHours.overtimeHours)}
              </div>
            </div>
            <div className="flex items-end justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleGenerateTimesheet}
                disabled={isGenerating || calculatedHours.totalRegular === 0}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
              <Button
                onClick={() => setSubmitDialogOpen(true)}
                disabled={calculatedHours.totalRegular === 0}
              >
                <Send className="h-4 w-4 mr-2" />
                Submit Timesheet
              </Button>
            </div>
          </div>

          {/* Daily breakdown */}
          {Object.keys(calculatedHours.dailyHours).length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium mb-3">Daily Breakdown</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Regular Hours</TableHead>
                    <TableHead className="text-right">Break Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(calculatedHours.dailyHours)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, hours]) => (
                      <TableRow key={date}>
                        <TableCell>
                          {format(parseISO(date), "EEE, MMM d")}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatHours(hours.regular)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatHours(hours.break)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for My Timesheets / Pending Approvals */}
      <Tabs defaultValue="my-timesheets">
        <TabsList>
          <TabsTrigger value="my-timesheets">My Timesheets</TabsTrigger>
          {isAdmin && pendingTimesheets.length > 0 && (
            <TabsTrigger value="pending" className="relative">
              Pending Approvals
              <Badge
                variant="destructive"
                className="ml-2 h-5 w-5 rounded-full p-0 text-xs"
              >
                {pendingTimesheets.length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my-timesheets" className="mt-4">
          {timesheets.length > 0 ? (
            <div className="space-y-4">
              {timesheets.map((timesheet) => (
                <Card
                  key={timesheet.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/timesheets/${timesheet.id}`)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {format(parseISO(timesheet.period_start), "MMM d")} -{" "}
                          {format(parseISO(timesheet.period_end), "MMM d, yyyy")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatHours(Number(timesheet.total_hours || 0))}{" "}
                          total
                          {Number(timesheet.overtime_hours || 0) > 0 && (
                            <span className="text-orange-500">
                              {" "}
                              ({formatHours(Number(timesheet.overtime_hours))}{" "}
                              overtime)
                            </span>
                          )}
                        </div>
                        {timesheet.review_comment && (
                          <div className="text-sm text-muted-foreground italic mt-1">
                            &quot;{timesheet.review_comment}&quot;
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge className={statusColors[timesheet.status || "draft"]}>
                      {timesheet.status?.charAt(0).toUpperCase()}
                      {timesheet.status?.slice(1)}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No timesheets yet</p>
                <p className="text-sm text-muted-foreground">
                  Submit your first timesheet when ready
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="pending" className="mt-4">
            {pendingTimesheets.length > 0 ? (
              <div className="space-y-4">
                {pendingTimesheets.map((timesheet) => (
                  <Card key={timesheet.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage
                            src={timesheet.profiles?.avatar_url || undefined}
                          />
                          <AvatarFallback>
                            {getInitials(timesheet.profiles)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {getDisplayName(timesheet.profiles)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(parseISO(timesheet.period_start), "MMM d")}{" "}
                            -{" "}
                            {format(
                              parseISO(timesheet.period_end),
                              "MMM d, yyyy"
                            )}
                          </div>
                          <div className="text-sm">
                            {formatHours(Number(timesheet.total_hours || 0))}{" "}
                            total
                            {Number(timesheet.overtime_hours || 0) > 0 && (
                              <span className="text-orange-500">
                                {" "}
                                ({formatHours(Number(timesheet.overtime_hours))}{" "}
                                overtime)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/timesheets/${timesheet.id}`);
                          }}
                        >
                          View Details
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTimesheet(timesheet);
                            setDetailDialogOpen(true);
                          }}
                        >
                          Review
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No pending timesheets to approve
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Submit Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Timesheet</DialogTitle>
            <DialogDescription>
              Submit your timesheet for{" "}
              {format(currentWeekStart, "MMM d")} -{" "}
              {format(currentWeekEnd, "MMM d, yyyy")} for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Regular Hours:</span>
                <span className="font-medium">
                  {formatHours(calculatedHours.totalRegular)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Break Hours:</span>
                <span className="font-medium">
                  {formatHours(calculatedHours.totalBreak)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overtime:</span>
                <span className="font-medium text-orange-500">
                  {formatHours(calculatedHours.overtimeHours)}
                </span>
              </div>
            </div>
            {calculatedHours.totalRegular === 0 && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  No time entries found for this period. Make sure to clock in
                  and out before submitting.
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSubmitDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitTimesheet}
              disabled={
                processingId === "submit" || calculatedHours.totalRegular === 0
              }
            >
              {processingId === "submit" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Timesheet</DialogTitle>
            <DialogDescription>
              {selectedTimesheet && (
                <>
                  {getDisplayName(selectedTimesheet.profiles)} -{" "}
                  {format(parseISO(selectedTimesheet.period_start), "MMM d")} -{" "}
                  {format(parseISO(selectedTimesheet.period_end), "MMM d, yyyy")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedTimesheet && (
            <div className="py-4 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Regular Hours:</span>
                  <span className="font-medium">
                    {formatHours(Number(selectedTimesheet.total_hours || 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Break Hours:</span>
                  <span className="font-medium">
                    {formatHours(Number(selectedTimesheet.break_hours || 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overtime:</span>
                  <span className="font-medium text-orange-500">
                    {formatHours(Number(selectedTimesheet.overtime_hours || 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted:</span>
                  <span className="font-medium">
                    {selectedTimesheet.submitted_at
                      ? format(
                          parseISO(selectedTimesheet.submitted_at),
                          "MMM d, yyyy h:mm a"
                        )
                      : "-"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">Comment (required for rejection)</Label>
                <Textarea
                  id="comment"
                  placeholder="Add a comment..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDetailDialogOpen(false);
                setSelectedTimesheet(null);
                setReviewComment("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                selectedTimesheet && handleReject(selectedTimesheet.id)
              }
              disabled={processingId === selectedTimesheet?.id}
            >
              {processingId === selectedTimesheet?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject
            </Button>
            <Button
              onClick={() =>
                selectedTimesheet && handleApprove(selectedTimesheet.id)
              }
              disabled={processingId === selectedTimesheet?.id}
            >
              {processingId === selectedTimesheet?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
