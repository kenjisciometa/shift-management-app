"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
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
  balances,
  requests,
  pendingRequests,
  teamRequests,
  policies,
  isAdmin,
}: PTODashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from("pto_requests")
        .update({
          status: "approved",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("Request approved");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to approve request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from("pto_requests")
        .update({
          status: "rejected",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("Request rejected");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to reject request");
    } finally {
      setProcessingId(null);
    }
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
      <div className="flex items-center justify-between">
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
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Request Time Off
        </Button>
      </div>

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
          {requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((request) => (
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
                <p className="text-muted-foreground">No time off requests</p>
                <Button variant="link" onClick={() => setDialogOpen(true)}>
                  Request time off
                </Button>
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
        onOpenChange={setDialogOpen}
        profile={profile}
        balances={balances}
        policies={policies}
      />
    </div>
  );
}
