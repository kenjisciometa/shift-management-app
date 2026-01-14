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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Users,
  UserPlus,
  MoreHorizontal,
  Loader2,
  Mail,
  Clock,
  XCircle,
  Briefcase,
  MapPin,
  UsersRound,
  DollarSign,
  Settings,
} from "lucide-react";
import { InviteDialog } from "./invite-dialog";
import { EmployeeDialog } from "./employee-dialog";
import { PositionDialog } from "@/components/organization/position-dialog";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type TeamMember = Database["public"]["Tables"]["profiles"]["Row"] & {
  departments: { id: string; name: string } | null;
  user_positions?: { position_id: string; positions: Position | null }[];
};

type Invitation = Database["public"]["Tables"]["employee_invitations"]["Row"] & {
  departments: { id: string; name: string } | null;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
  } | null;
};

type Department = {
  id: string;
  name: string;
};

type Position = Database["public"]["Tables"]["positions"]["Row"];

interface TeamDashboardProps {
  profile: Profile;
  teamMembers: TeamMember[];
  invitations: Invitation[];
  departments: Department[];
  positions: Position[];
  isAdmin: boolean;
}

const roleColors: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  manager: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  employee: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function TeamDashboard({
  profile,
  teamMembers,
  invitations,
  departments,
  positions,
  isAdmin,
}: TeamDashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<TeamMember | null>(null);
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Filter team members
  const filteredMembers = teamMembers.filter((member) => {
    if (!searchQuery) return true;
    const name = getDisplayName(member).toLowerCase();
    const email = member.email?.toLowerCase() || "";
    return name.includes(searchQuery.toLowerCase()) || email.includes(searchQuery.toLowerCase());
  });

  function getDisplayName(member: TeamMember) {
    if (member.display_name) return member.display_name;
    return `${member.first_name} ${member.last_name}`;
  }

  function getInitials(member: TeamMember) {
    return `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
  }

  const handleCancelInvitation = async (invitationId: string) => {
    setProcessingId(invitationId);
    try {
      const { error } = await supabase
        .from("employee_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitationId);

      if (error) throw error;

      toast.success("Invitation cancelled");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to cancel invitation");
    } finally {
      setProcessingId(null);
    }
  };

  const handleResendInvitation = async (invitation: Invitation) => {
    setProcessingId(invitation.id);
    try {
      // Generate new token and extend expiry
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase
        .from("employee_invitations")
        .update({
          token,
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", invitation.id);

      if (error) throw error;

      // In a real app, you would send an email here
      toast.success("Invitation resent");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to resend invitation");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeletePosition = async (positionId: string) => {
    setProcessingId(positionId);
    try {
      const { error } = await supabase
        .from("positions")
        .delete()
        .eq("id", positionId);

      if (error) throw error;

      toast.success("Position deleted");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete position");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {isAdmin && (
          <Button onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="members">Team Members</TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="positions">Positions</TabsTrigger>
              <TabsTrigger value="locations">Locations</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
              <TabsTrigger value="labor-cost">Labor Cost</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </>
          )}
          {isAdmin && invitations.length > 0 && (
            <TabsTrigger value="invitations">
              Pending Invitations ({invitations.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="members" className="mt-4">
          {filteredMembers.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredMembers.map((member) => (
                <Card key={member.id} className="group">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(member)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">
                            {getDisplayName(member)}
                          </h3>
                          {member.id === profile.id && (
                            <Badge variant="outline" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {member.email}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={roleColors[member.role || "employee"]}>
                            {member.role}
                          </Badge>
                          <Badge className={statusColors[member.status || "active"]}>
                            {member.status}
                          </Badge>
                        </div>
                        {member.departments && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {member.departments.name}
                          </p>
                        )}
                        {member.user_positions && member.user_positions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {member.user_positions.map((up) => {
                              if (!up.positions) return null;
                              const pos = up.positions;
                              return (
                                <Badge
                                  key={pos.id}
                                  variant="outline"
                                  className="text-xs"
                                  style={{
                                    borderColor:
                                      pos.color === "blue" ? "#3b82f6" :
                                      pos.color === "green" ? "#22c55e" :
                                      pos.color === "yellow" ? "#eab308" :
                                      pos.color === "red" ? "#ef4444" :
                                      pos.color === "purple" ? "#a855f7" :
                                      pos.color === "pink" ? "#ec4899" :
                                      pos.color === "orange" ? "#f97316" :
                                      pos.color === "cyan" ? "#06b6d4" :
                                      pos.color === "indigo" ? "#6366f1" :
                                      pos.color === "teal" ? "#14b8a6" :
                                      "#3b82f6",
                                    color:
                                      pos.color === "blue" ? "#3b82f6" :
                                      pos.color === "green" ? "#22c55e" :
                                      pos.color === "yellow" ? "#eab308" :
                                      pos.color === "red" ? "#ef4444" :
                                      pos.color === "purple" ? "#a855f7" :
                                      pos.color === "pink" ? "#ec4899" :
                                      pos.color === "orange" ? "#f97316" :
                                      pos.color === "cyan" ? "#06b6d4" :
                                      pos.color === "indigo" ? "#6366f1" :
                                      pos.color === "teal" ? "#14b8a6" :
                                      "#3b82f6"
                                  }}
                                >
                                  {pos.name}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {isAdmin && member.id !== profile.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedEmployee(member);
                                setEmployeeDialogOpen(true);
                              }}
                            >
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedEmployee(member);
                                setEmployeeDialogOpen(true);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedEmployee(member);
                                setEmployeeDialogOpen(true);
                              }}
                            >
                              {member.status === "active" ? "Deactivate" : "Manage Status"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No team members found" : "No team members yet"}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="positions" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Positions</h2>
                <p className="text-sm text-muted-foreground">
                  Define job positions and their colors for shift management
                </p>
              </div>
              <Button
                onClick={() => {
                  setSelectedPosition(null);
                  setPositionDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Position
              </Button>
            </div>

            {positions.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {positions.map((position) => (
                  <Card key={position.id} className="group">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className="h-10 w-10 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor:
                                position.color === "blue" ? "#3b82f6" :
                                position.color === "green" ? "#22c55e" :
                                position.color === "yellow" ? "#eab308" :
                                position.color === "red" ? "#ef4444" :
                                position.color === "purple" ? "#a855f7" :
                                position.color === "pink" ? "#ec4899" :
                                position.color === "orange" ? "#f97316" :
                                position.color === "cyan" ? "#06b6d4" :
                                position.color === "indigo" ? "#6366f1" :
                                position.color === "teal" ? "#14b8a6" :
                                "#3b82f6"
                            }}
                          >
                            <Briefcase className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-medium">{position.name}</h3>
                            {position.description && (
                              <p className="text-sm text-muted-foreground">
                                {position.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant={position.is_active ? "default" : "secondary"}>
                                {position.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100"
                              disabled={processingId === position.id}
                            >
                              {processingId === position.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedPosition(position);
                                setPositionDialogOpen(true);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeletePosition(position.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No positions configured</p>
                  <Button
                    variant="link"
                    onClick={() => {
                      setSelectedPosition(null);
                      setPositionDialogOpen(true);
                    }}
                  >
                    Add your first position
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="invitations" className="mt-4">
            {invitations.length > 0 ? (
              <div className="space-y-4">
                {invitations.map((invitation) => (
                  <Card key={invitation.id} className="group">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {invitation.first_name} {invitation.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {invitation.email}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>
                              Expires{" "}
                              {format(parseISO(invitation.expires_at), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={roleColors[invitation.role || "employee"]}>
                          {invitation.role}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResendInvitation(invitation)}
                          disabled={processingId === invitation.id}
                        >
                          {processingId === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Resend"
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleCancelInvitation(invitation.id)}
                          disabled={processingId === invitation.id}
                        >
                          {processingId === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
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
                  <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending invitations</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Locations Tab */}
        {isAdmin && (
          <TabsContent value="locations" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Locations</h2>
                <p className="text-sm text-muted-foreground">
                  Manage work locations for geofencing and time tracking
                </p>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            </div>
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No locations configured</p>
                <Button variant="link">
                  Add your first location
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Groups Tab */}
        {isAdmin && (
          <TabsContent value="groups" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Groups</h2>
                <p className="text-sm text-muted-foreground">
                  Organize team members into groups for scheduling and permissions
                </p>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Group
              </Button>
            </div>
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <UsersRound className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No groups configured</p>
                <Button variant="link">
                  Add your first group
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Labor Cost Tab */}
        {isAdmin && (
          <TabsContent value="labor-cost" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Labor Cost</h2>
                <p className="text-sm text-muted-foreground">
                  Configure hourly rates and labor cost tracking
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Default Hourly Rate</CardTitle>
                  <CardDescription>
                    Set the default hourly rate for new employees
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">0.00</span>
                    <span className="text-muted-foreground">/ hour</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Overtime Rules</CardTitle>
                  <CardDescription>
                    Configure overtime calculation rules
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Overtime after 40 hours/week at 1.5x rate
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Settings Tab */}
        {isAdmin && (
          <TabsContent value="settings" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Team Settings</h2>
                <p className="text-sm text-muted-foreground">
                  Configure team-wide settings and preferences
                </p>
              </div>
            </div>
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Scheduling Preferences</CardTitle>
                  <CardDescription>
                    Default settings for shift scheduling
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Week Start Day</p>
                      <p className="text-sm text-muted-foreground">First day of the work week</p>
                    </div>
                    <Badge variant="outline">Monday</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Default Shift Duration</p>
                      <p className="text-sm text-muted-foreground">Standard shift length</p>
                    </div>
                    <Badge variant="outline">8 hours</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Break Duration</p>
                      <p className="text-sm text-muted-foreground">Default break time</p>
                    </div>
                    <Badge variant="outline">30 minutes</Badge>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notification Settings</CardTitle>
                  <CardDescription>
                    Configure team notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Shift Reminders</p>
                      <p className="text-sm text-muted-foreground">Send reminders before shifts</p>
                    </div>
                    <Badge variant="outline">1 hour before</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Schedule Published</p>
                      <p className="text-sm text-muted-foreground">Notify when schedule is published</p>
                    </div>
                    <Badge variant="outline">Enabled</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Invite Dialog */}
      <InviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        profile={profile}
        departments={departments}
      />

      {/* Employee Edit Dialog */}
      <EmployeeDialog
        open={employeeDialogOpen}
        onOpenChange={setEmployeeDialogOpen}
        employee={selectedEmployee}
        currentUser={profile}
        departments={departments}
        positions={positions}
      />

      {/* Position Dialog */}
      <PositionDialog
        open={positionDialogOpen}
        onOpenChange={setPositionDialogOpen}
        position={selectedPosition}
        organizationId={profile.organization_id}
      />
    </div>
  );
}
