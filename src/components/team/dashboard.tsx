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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Filter,
  X,
  AlertTriangle,
} from "lucide-react";
import { InviteDialog } from "./invite-dialog";
import { EmployeeDialog } from "./employee-dialog";
import { PositionDialog } from "@/components/organization/position-dialog";
import { LocationDialog } from "@/components/organization/location-dialog";
import { cn } from "@/lib/utils";

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
type Location = Database["public"]["Tables"]["locations"]["Row"];

interface TeamDashboardProps {
  profile: Profile;
  teamMembers: TeamMember[];
  invitations: Invitation[];
  departments: Department[];
  positions: Position[];
  locations: Location[];
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
  locations,
  isAdmin,
}: TeamDashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<TeamMember | null>(null);
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Deactivation dialog state
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [memberToDeactivate, setMemberToDeactivate] = useState<TeamMember | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Filter states
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterPosition, setFilterPosition] = useState<string>("all");

  // Check if any filters are active
  const hasActiveFilters = filterRole !== "all" || filterStatus !== "all" || filterDepartment !== "all" || filterPosition !== "all";

  // Clear all filters
  const clearFilters = () => {
    setFilterRole("all");
    setFilterStatus("all");
    setFilterDepartment("all");
    setFilterPosition("all");
  };

  // Role priority for sorting (lower = higher priority)
  const rolePriority: Record<string, number> = {
    owner: 0,
    admin: 1,
    manager: 2,
    employee: 3,
  };

  // Filter and sort team members
  const filteredMembers = teamMembers
    .filter((member) => {
      // Search filter
      if (searchQuery) {
        const name = getDisplayName(member).toLowerCase();
        const email = member.email?.toLowerCase() || "";
        if (!name.includes(searchQuery.toLowerCase()) && !email.includes(searchQuery.toLowerCase())) {
          return false;
        }
      }
      // Role filter
      if (filterRole !== "all" && member.role !== filterRole) {
        return false;
      }
      // Status filter
      if (filterStatus !== "all" && member.status !== filterStatus) {
        return false;
      }
      // Department filter
      if (filterDepartment !== "all" && member.department_id !== filterDepartment) {
        return false;
      }
      // Position filter
      if (filterPosition !== "all") {
        const hasPosition = member.user_positions?.some(up => up.position_id === filterPosition);
        if (!hasPosition) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      // Sort by role priority (owner first, then admin, manager, employee)
      const priorityA = rolePriority[a.role || "employee"] ?? 3;
      const priorityB = rolePriority[b.role || "employee"] ?? 3;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      // Then sort by name
      return getDisplayName(a).localeCompare(getDisplayName(b));
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

  const handleDeleteLocation = async (locationId: string) => {
    setProcessingId(locationId);
    try {
      const { error } = await supabase
        .from("locations")
        .delete()
        .eq("id", locationId);

      if (error) throw error;

      toast.success("Location deleted");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete location");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeactivateMember = async () => {
    if (!memberToDeactivate) return;

    setDeactivating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "inactive" })
        .eq("id", memberToDeactivate.id);

      if (error) throw error;

      toast.success("Member deactivated successfully");
      setDeactivateDialogOpen(false);
      setMemberToDeactivate(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to deactivate member");
    } finally {
      setDeactivating(false);
    }
  };

  const handleActivateMember = async (member: TeamMember) => {
    setProcessingId(member.id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "active" })
        .eq("id", member.id);

      if (error) throw error;

      toast.success("Member activated successfully");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to activate member");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
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
            </>
          )}
          {isAdmin && invitations.length > 0 && (
            <TabsTrigger value="invitations">
              Pending Invitations ({invitations.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="members" className="mt-4 space-y-4">
          {/* Search and Filters */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
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

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>Filters:</span>
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className={cn("w-[130px] h-9", filterRole !== "all" && "bg-green-100")}>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className={cn("w-[130px] h-9", filterStatus !== "all" && "bg-green-100")}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              {departments.length > 0 && (
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger className={cn("w-[150px] h-9", filterDepartment !== "all" && "bg-green-100")}>
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {positions.length > 0 && (
                <Select value={filterPosition} onValueChange={setFilterPosition}>
                  <SelectTrigger className={cn("w-[150px] h-9", filterPosition !== "all" && "bg-green-100")}>
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Positions</SelectItem>
                    {positions.filter(p => p.is_active).map((pos) => (
                      <SelectItem key={pos.id} value={pos.id}>
                        {pos.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
              <div className="ml-auto text-sm text-muted-foreground">
                {filteredMembers.length} of {teamMembers.length} members
              </div>
            </div>
          </div>

          {/* Team Members Table */}
          {filteredMembers.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Positions</TableHead>
                    {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{getInitials(member)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {getDisplayName(member)}
                              </span>
                              {member.id === profile.id && (
                                <Badge variant="outline" className="text-xs">
                                  You
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={roleColors[member.role || "employee"]}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[member.status || "active"]}>
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.departments ? (
                          <span className="text-sm">{member.departments.name}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.user_positions && member.user_positions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
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
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {member.id !== profile.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                  disabled={processingId === member.id}
                                >
                                  {processingId === member.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="h-4 w-4" />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedEmployee(member);
                                    setEmployeeDialogOpen(true);
                                  }}
                                >
                                  Edit
                                </DropdownMenuItem>
                                {member.status === "active" ? (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => {
                                      setMemberToDeactivate(member);
                                      setDeactivateDialogOpen(true);
                                    }}
                                  >
                                    Deactivate
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => handleActivateMember(member)}
                                  >
                                    Activate
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || hasActiveFilters ? "No team members found matching filters" : "No team members yet"}
                </p>
                {hasActiveFilters && (
                  <Button variant="link" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
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
              <Button
                onClick={() => {
                  setSelectedLocation(null);
                  setLocationDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            </div>

            {locations.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {locations.map((location) => (
                  <Card key={location.id} className="group">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
                            <MapPin className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-medium">{location.name}</h3>
                            {location.address && (
                              <p className="text-sm text-muted-foreground">
                                {location.address}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant={location.is_active ? "default" : "secondary"}>
                                {location.is_active ? "Active" : "Inactive"}
                              </Badge>
                              {location.geofence_enabled && (
                                <Badge variant="outline">
                                  Geofence: {location.radius_meters}m
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100"
                              disabled={processingId === location.id}
                            >
                              {processingId === location.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedLocation(location);
                                setLocationDialogOpen(true);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteLocation(location.id)}
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
                  <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No locations configured</p>
                  <Button
                    variant="link"
                    onClick={() => {
                      setSelectedLocation(null);
                      setLocationDialogOpen(true);
                    }}
                  >
                    Add your first location
                  </Button>
                </CardContent>
              </Card>
            )}
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

      {/* Location Dialog */}
      <LocationDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        location={selectedLocation}
        organizationId={profile.organization_id}
      />

      {/* Deactivation Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Deactivate Member
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                <p>
                  Are you sure you want to deactivate{" "}
                  <strong>
                    {memberToDeactivate?.display_name ||
                      `${memberToDeactivate?.first_name} ${memberToDeactivate?.last_name}`}
                  </strong>
                  ?
                </p>
                <p className="mt-2">This will:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Prevent them from logging in</li>
                  <li>Remove them from future shift schedules</li>
                </ul>
                <p className="mt-2">You can reactivate the account later if needed.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deactivating}
            >
              {deactivating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
