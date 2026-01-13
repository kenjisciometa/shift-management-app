"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, startOfYear, endOfYear } from "date-fns";
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Palmtree,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  CalendarDays,
  List,
  Filter,
  RefreshCw,
} from "lucide-react";
import { PTORequestDialog } from "./request-dialog";
import { PTOCalendar } from "./calendar";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type PTOBalance = Database["public"]["Tables"]["pto_balances"]["Row"] & {
  pto_policies: {
    id: string;
    name: string;
    pto_type: string;
    annual_allowance: number | null;
  } | null;
};
type PTORequest = Database["public"]["Tables"]["pto_requests"]["Row"];
type PTOPolicy = Database["public"]["Tables"]["pto_policies"]["Row"];

type PendingRequest = PTORequest & {
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

interface PTODashboardProps {
  profile: Profile;
  balances: PTOBalance[];
  requests: PTORequest[];
  pendingRequests: PendingRequest[];
  teamRequests: PendingRequest[];
  policies: PTOPolicy[];
  isAdmin: boolean;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const ptoTypeLabels: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick Leave",
  personal: "Personal",
  bereavement: "Bereavement",
  jury_duty: "Jury Duty",
  other: "Other",
};

export function PTODashboard({
  profile,
  balances: initialBalances,
  requests: initialRequests,
  pendingRequests: initialPendingRequests,
  teamRequests,
  policies,
  isAdmin,
}: PTODashboardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState(initialBalances);
  const [requests, setRequests] = useState(initialRequests);
  const [pendingRequests, setPendingRequests] = useState(initialPendingRequests);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [reviewRequestId, setReviewRequestId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");

  // Fetch data from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (dateRangeStart) {
        params.set("start_date", dateRangeStart);
      }
      if (dateRangeEnd) {
        params.set("end_date", dateRangeEnd);
      }

      // Fetch requests
      const requestsResponse = await fetch(`/api/pto/requests?${params.toString()}`);
      const requestsData = await requestsResponse.json();
      if (requestsData.success) {
        setRequests(requestsData.data || []);
      }

      // Fetch balances
      const balanceResponse = await fetch("/api/pto/balance");
      const balanceData = await balanceResponse.json();
      if (balanceData.success) {
        setBalances(balanceData.data || []);
      }

      // Fetch pending requests (admin only)
      if (isAdmin) {
        const pendingResponse = await fetch("/api/pto/requests?status=pending");
        const pendingData = await pendingResponse.json();
        if (pendingData.success) {
          setPendingRequests(pendingData.data || []);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to refresh data");
    } finally {
      setLoading(false);
    }
  };

  // Filter requests based on status and date range
  const filteredRequests = requests.filter((request) => {
    if (statusFilter !== "all" && request.status !== statusFilter) {
      return false;
    }
    if (dateRangeStart && request.end_date < dateRangeStart) {
      return false;
    }
    if (dateRangeEnd && request.start_date > dateRangeEnd) {
      return false;
    }
    return true;
  });

  const openReviewDialog = (requestId: string, action: "approve" | "reject") => {
    setReviewRequestId(requestId);
    setReviewAction(action);
    setReviewComment("");
    setReviewDialogOpen(true);
  };

  const handleReviewSubmit = async () => {
    if (!reviewRequestId || !reviewAction) return;

    setProcessingId(reviewRequestId);
    setReviewDialogOpen(false);

    try {
      const response = await fetch(`/api/pto/requests/${reviewRequestId}/${reviewAction}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ review_comment: reviewComment || null }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${reviewAction} request`);
      }

      toast.success(`Request ${reviewAction}d`);
      setReviewRequestId(null);
      setReviewAction(null);
      setReviewComment("");
      fetchData();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : `Failed to ${reviewAction} request`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (requestId: string) => {
    openReviewDialog(requestId, "approve");
  };

  const handleReject = async (requestId: string) => {
    openReviewDialog(requestId, "reject");
  };

  const getDisplayName = (p: PendingRequest["profiles"]) => {
    if (!p) return "Unknown";
    if (p.display_name) return p.display_name;
    return `${p.first_name} ${p.last_name}`;
  };

  const getInitials = (p: PendingRequest["profiles"]) => {
    if (!p) return "?";
    return `${p.first_name[0]}${p.last_name[0]}`.toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {balances.length > 0 ? (
          balances.map((balance) => {
            const total = Number(balance.entitled_days) + Number(balance.carryover_days) + Number(balance.adjustment_days);
            const used = Number(balance.used_days);
            const pending = Number(balance.pending_days);
            const available = total - used - pending;
            const usagePercent = total > 0 ? ((used + pending) / total) * 100 : 0;

            return (
              <Card key={balance.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Palmtree className="h-5 w-5 text-green-500" />
                    {ptoTypeLabels[balance.pto_type] || balance.pto_type}
                  </CardTitle>
                  <CardDescription>
                    {balance.pto_policies?.name || "Balance"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-3xl font-bold">{available.toFixed(1)}</div>
                      <div className="text-sm text-muted-foreground">days available</div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>{used.toFixed(1)} used</div>
                      {pending > 0 && <div>{pending.toFixed(1)} pending</div>}
                    </div>
                  </div>
                  <Progress value={usagePercent} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    {total.toFixed(1)} total days for {balance.year}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Palmtree className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No PTO balances configured</p>
              <p className="text-sm text-muted-foreground">
                Contact your administrator to set up PTO policies
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* View Toggle and Request Button */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            Calendar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Request Time Off
        </Button>
      </div>

      {/* Filters (List View Only) */}
      {viewMode === "list" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-start">Start Date</Label>
                <Input
                  id="date-start"
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-end">End Date</Label>
                <Input
                  id="date-end"
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  min={dateRangeStart}
                />
              </div>
            </div>
            {(statusFilter !== "all" || dateRangeStart || dateRangeEnd) && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setDateRangeStart("");
                    setDateRangeEnd("");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" ? (
        <Tabs defaultValue="my-calendar">
          <TabsList>
            <TabsTrigger value="my-calendar">My PTO</TabsTrigger>
            <TabsTrigger value="team-calendar">Team Calendar</TabsTrigger>
          </TabsList>
          <TabsContent value="my-calendar" className="mt-4">
            <div className="border rounded-lg h-[600px]">
              <PTOCalendar requests={requests} isTeamView={false} />
            </div>
          </TabsContent>
          <TabsContent value="team-calendar" className="mt-4">
            <div className="border rounded-lg h-[600px]">
              <PTOCalendar requests={teamRequests} isTeamView={true} />
            </div>
          </TabsContent>
        </Tabs>
      ) : (
      /* List View - Tabs for My Requests / Pending Approvals */
      <Tabs defaultValue="my-requests">
        <TabsList>
          <TabsTrigger value="my-requests">My Requests</TabsTrigger>
          {isAdmin && pendingRequests.length > 0 && (
            <TabsTrigger value="pending" className="relative">
              Pending Approvals
              <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                {pendingRequests.length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my-requests" className="mt-4">
          {filteredRequests.length > 0 ? (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {ptoTypeLabels[request.pto_type] || request.pto_type}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(parseISO(request.start_date), "MMM d, yyyy")}
                          {request.start_date !== request.end_date && (
                            <> - {format(parseISO(request.end_date), "MMM d, yyyy")}</>
                          )}
                        </div>
                        {request.reason && (
                          <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {request.reason}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">{Number(request.total_days).toFixed(1)} days</div>
                      </div>
                      <Badge className={statusColors[request.status || "pending"]}>
                        {request.status?.charAt(0).toUpperCase()}
                        {request.status?.slice(1)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {requests.length === 0
                    ? "No time off requests"
                    : "No requests match the current filters"}
                </p>
                {requests.length === 0 && (
                  <Button variant="link" onClick={() => setDialogOpen(true)}>
                    Request time off
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="pending" className="mt-4">
            {pendingRequests.length > 0 ? (
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src={request.profiles?.avatar_url || undefined} />
                          <AvatarFallback>{getInitials(request.profiles)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{getDisplayName(request.profiles)}</div>
                          <div className="text-sm">
                            {ptoTypeLabels[request.pto_type] || request.pto_type}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(parseISO(request.start_date), "MMM d, yyyy")}
                            {request.start_date !== request.end_date && (
                              <> - {format(parseISO(request.end_date), "MMM d, yyyy")}</>
                            )}
                          </div>
                          {request.reason && (
                            <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                              {request.reason}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium mr-2">
                          {Number(request.total_days).toFixed(1)} days
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(request.id)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(request.id)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
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
                  <p className="text-muted-foreground">No pending requests</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
      )}

      {/* Request Dialog */}
      <PTORequestDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            // Refresh data when dialog closes
            fetchData();
          }
        }}
        profile={profile}
        balances={balances}
        policies={policies}
      />

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Approve" : "Reject"} PTO Request
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve"
                ? "Add an optional comment before approving this request."
                : "Please provide a reason for rejecting this request."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="review-comment">
                Comment {reviewAction === "reject" && "(recommended)"}
              </Label>
              <Textarea
                id="review-comment"
                placeholder={
                  reviewAction === "approve"
                    ? "Add a comment (optional)..."
                    : "Explain why this request is being rejected..."
                }
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialogOpen(false);
                setReviewComment("");
              }}
              disabled={processingId === reviewRequestId}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReviewSubmit}
              variant={reviewAction === "reject" ? "destructive" : "default"}
              disabled={processingId === reviewRequestId}
            >
              {processingId === reviewRequestId && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {reviewAction === "approve" ? "Approve" : "Reject"} Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
