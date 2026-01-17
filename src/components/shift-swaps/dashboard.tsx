"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { apiPut } from "@/lib/api-client";
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
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  MapPin,
} from "lucide-react";
import { SwapRequestDialog } from "./request-dialog";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type ShiftInfo = {
  id: string;
  start_time: string;
  end_time: string;
  locations: { id: string; name: string } | null;
  positions: { id: string; name: string; color: string } | null;
};

type PersonInfo = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
};

type SwapRequest = Database["public"]["Tables"]["shift_swaps"]["Row"] & {
  requester_shift: ShiftInfo | null;
  target_shift: ShiftInfo | null;
  requester?: PersonInfo | null;
  target?: PersonInfo | null;
};

interface ShiftSwapsDashboardProps {
  profile: Profile;
  mySwapRequests: SwapRequest[];
  incomingRequests: SwapRequest[];
  pendingForAdmin: SwapRequest[];
  myShifts: ShiftInfo[];
  teamMembers: PersonInfo[];
  isAdmin: boolean;
}

const statusColors: Record<string, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled:
    "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export function ShiftSwapsDashboard({
  profile,
  mySwapRequests,
  incomingRequests,
  pendingForAdmin,
  myShifts,
  teamMembers,
  isAdmin,
}: ShiftSwapsDashboardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (swapId: string) => {
    setProcessingId(swapId);
    try {
      const response = await apiPut(`/api/shift-swaps/${swapId}/approve`, {});
      if (!response.success) {
        throw new Error(response.error || "Failed to approve swap request");
      }

      toast.success("Swap request approved");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to approve swap request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (swapId: string) => {
    setProcessingId(swapId);
    try {
      const response = await apiPut(`/api/shift-swaps/${swapId}/reject`, {});
      if (!response.success) {
        throw new Error(response.error || "Failed to reject swap request");
      }

      toast.success("Swap request rejected");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to reject swap request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (swapId: string) => {
    setProcessingId(swapId);
    try {
      const response = await apiPut(`/api/shift-swaps/${swapId}/cancel`, {});
      if (!response.success) {
        throw new Error(response.error || "Failed to cancel swap request");
      }

      toast.success("Swap request cancelled");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to cancel swap request");
    } finally {
      setProcessingId(null);
    }
  };

  const formatShiftTime = (shift: ShiftInfo | null) => {
    if (!shift) return "N/A";
    const start = parseISO(shift.start_time);
    const end = parseISO(shift.end_time);
    return `${format(start, "MMM d")} ${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
  };

  const getDisplayName = (person: PersonInfo | null | undefined) => {
    if (!person) return "Unknown";
    if (person.display_name) return person.display_name;
    return `${person.first_name} ${person.last_name}`;
  };

  const getInitials = (person: PersonInfo | null | undefined) => {
    if (!person) return "?";
    return `${person.first_name[0]}${person.last_name[0]}`.toUpperCase();
  };

  const renderShiftCard = (shift: ShiftInfo | null, label: string) => (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      {shift ? (
        <>
          <div className="flex items-center gap-1 text-sm">
            <Clock className="h-3 w-3" />
            {formatShiftTime(shift)}
          </div>
          {shift.locations && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {shift.locations.name}
            </div>
          )}
          {shift.positions && (
            <div className="text-xs text-muted-foreground">{shift.positions.name}</div>
          )}
        </>
      ) : (
        <div className="text-sm text-muted-foreground">No shift selected</div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Create Request Button */}
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Request Shift Swap
        </Button>
      </div>

      <Tabs defaultValue="my-requests">
        <TabsList>
          <TabsTrigger value="my-requests">My Requests</TabsTrigger>
          {incomingRequests.length > 0 && (
            <TabsTrigger value="incoming" className="relative">
              Incoming
              <Badge
                variant="destructive"
                className="ml-2 h-5 w-5 rounded-full p-0 text-xs"
              >
                {incomingRequests.length}
              </Badge>
            </TabsTrigger>
          )}
          {isAdmin && pendingForAdmin.length > 0 && (
            <TabsTrigger value="admin" className="relative">
              Pending Approval
              <Badge
                variant="destructive"
                className="ml-2 h-5 w-5 rounded-full p-0 text-xs"
              >
                {pendingForAdmin.length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        {/* My Requests Tab */}
        <TabsContent value="my-requests" className="mt-4">
          {mySwapRequests.length > 0 ? (
            <div className="space-y-4">
              {mySwapRequests.map((swap) => (
                <Card key={swap.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Swap with</span>
                            {swap.target && (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage
                                    src={swap.target.avatar_url || undefined}
                                  />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(swap.target)}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{getDisplayName(swap.target)}</span>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {renderShiftCard(swap.requester_shift, "My Shift")}
                            {renderShiftCard(swap.target_shift, "Their Shift")}
                          </div>
                          {swap.reason && (
                            <div className="text-sm text-muted-foreground">
                              Reason: {swap.reason}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[swap.status || "pending"]}>
                          {swap.status?.charAt(0).toUpperCase()}
                          {swap.status?.slice(1)}
                        </Badge>
                        {swap.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancel(swap.id)}
                            disabled={processingId === swap.id}
                          >
                            {processingId === swap.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Cancel"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <ArrowLeftRight className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No swap requests</p>
                <Button
                  variant="link"
                  onClick={() => setDialogOpen(true)}
                  className="mt-2"
                >
                  Create your first swap request
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Incoming Requests Tab */}
        <TabsContent value="incoming" className="mt-4">
          {incomingRequests.length > 0 ? (
            <div className="space-y-4">
              {incomingRequests.map((swap) => (
                <Card key={swap.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <Avatar>
                          <AvatarImage
                            src={swap.requester?.avatar_url || undefined}
                          />
                          <AvatarFallback>
                            {getInitials(swap.requester)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-2">
                          <div className="font-medium">
                            {getDisplayName(swap.requester)} wants to swap shifts
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {renderShiftCard(swap.requester_shift, "Their Shift")}
                            {renderShiftCard(swap.target_shift, "Your Shift")}
                          </div>
                          {swap.reason && (
                            <div className="text-sm text-muted-foreground">
                              Reason: {swap.reason}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(swap.id)}
                          disabled={processingId === swap.id}
                        >
                          {processingId === swap.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(swap.id)}
                          disabled={processingId === swap.id}
                        >
                          {processingId === swap.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No incoming requests</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Admin Approval Tab */}
        {isAdmin && (
          <TabsContent value="admin" className="mt-4">
            {pendingForAdmin.length > 0 ? (
              <div className="space-y-4">
                {pendingForAdmin.map((swap) => (
                  <Card key={swap.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage
                                  src={swap.requester?.avatar_url || undefined}
                                />
                                <AvatarFallback className="text-xs">
                                  {getInitials(swap.requester)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">
                                {getDisplayName(swap.requester)}
                              </span>
                            </div>
                            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage
                                  src={swap.target?.avatar_url || undefined}
                                />
                                <AvatarFallback className="text-xs">
                                  {getInitials(swap.target)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">
                                {getDisplayName(swap.target)}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {renderShiftCard(
                              swap.requester_shift,
                              `${getDisplayName(swap.requester)}'s Shift`
                            )}
                            {renderShiftCard(
                              swap.target_shift,
                              `${getDisplayName(swap.target)}'s Shift`
                            )}
                          </div>
                          {swap.reason && (
                            <div className="text-sm text-muted-foreground">
                              Reason: {swap.reason}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(swap.id)}
                            disabled={processingId === swap.id}
                          >
                            {processingId === swap.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4 mr-1" />
                            )}
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(swap.id)}
                            disabled={processingId === swap.id}
                          >
                            {processingId === swap.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                            )}
                            Approve
                          </Button>
                        </div>
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
                    No pending swap requests
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Swap Request Dialog */}
      <SwapRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        profile={profile}
        myShifts={myShifts}
        teamMembers={teamMembers}
      />
    </div>
  );
}
