"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  Users,
  Loader2,
  Plus,
  MoreHorizontal,
  Globe,
  Map,
  List,
  Briefcase,
} from "lucide-react";
import { LocationDialog } from "./location-dialog";
import { DepartmentDialog } from "./department-dialog";
import { PositionDialog } from "./position-dialog";
import { LocationMap } from "./location-map";
import { PTOPolicyManager } from "@/components/pto/policy-manager";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Organization = Database["public"]["Tables"]["organizations"]["Row"];
type Location = Database["public"]["Tables"]["locations"]["Row"];
type Department = Database["public"]["Tables"]["departments"]["Row"] & {
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
  } | null;
};

type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  role: string | null;
};

type PTOPolicy = Database["public"]["Tables"]["pto_policies"]["Row"];
type Position = Database["public"]["Tables"]["positions"]["Row"];

interface OrganizationSettingsProps {
  profile: Profile;
  organization: Organization;
  locations: Location[];
  departments: Department[];
  positions: Position[];
  teamMembers: TeamMember[];
  ptoPolicies: PTOPolicy[];
}

const timezones = [
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "America/New_York", label: "New York (EST)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST)" },
  { value: "America/Chicago", label: "Chicago (CST)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

export function OrganizationSettings({
  profile,
  organization,
  locations,
  departments,
  positions,
  teamMembers,
  ptoPolicies,
}: OrganizationSettingsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Organization form state
  const [orgForm, setOrgForm] = useState({
    name: organization.name,
    timezone: organization.timezone || "Asia/Tokyo",
  });

  // Dialogs
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  // Location view mode
  const [locationViewMode, setLocationViewMode] = useState<"list" | "map">("list");
  const [selectedMapLocationId, setSelectedMapLocationId] = useState<string | null>(null);

  const handleSaveOrganization = async () => {
    if (!orgForm.name.trim()) {
      toast.error("Organization name is required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: orgForm.name.trim(),
          timezone: orgForm.timezone,
        })
        .eq("id", organization.id);

      if (error) throw error;

      toast.success("Organization updated");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update organization");
    } finally {
      setSaving(false);
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

  const handleDeleteDepartment = async (departmentId: string) => {
    setProcessingId(departmentId);
    try {
      const { error } = await supabase
        .from("departments")
        .delete()
        .eq("id", departmentId);

      if (error) throw error;

      toast.success("Department deleted");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete department");
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

  const getDisplayName = (p: { first_name: string; last_name: string; display_name: string | null } | null) => {
    if (!p) return "No manager";
    if (p.display_name) return p.display_name;
    return `${p.first_name} ${p.last_name}`;
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="pto-policies">PTO Policies</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Details
              </CardTitle>
              <CardDescription>
                Manage your organization's basic information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={orgForm.name}
                  onChange={(e) =>
                    setOrgForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={orgForm.timezone}
                  onValueChange={(value) =>
                    setOrgForm((prev) => ({ ...prev, timezone: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4">
                <Button onClick={handleSaveOrganization} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Locations */}
        <TabsContent value="locations" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Locations</h2>
              <p className="text-sm text-muted-foreground">
                Manage work locations and geofencing settings
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center border rounded-lg p-1">
                <Button
                  variant={locationViewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  className="h-8"
                  onClick={() => setLocationViewMode("list")}
                >
                  <List className="h-4 w-4 mr-1" />
                  List
                </Button>
                <Button
                  variant={locationViewMode === "map" ? "default" : "ghost"}
                  size="sm"
                  className="h-8"
                  onClick={() => setLocationViewMode("map")}
                >
                  <Map className="h-4 w-4 mr-1" />
                  Map
                </Button>
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
          </div>

          {locationViewMode === "map" ? (
            <LocationMap
              locations={locations}
              selectedLocationId={selectedMapLocationId || undefined}
              onSelectLocation={(id) => setSelectedMapLocationId(id)}
              onEditLocation={(location) => {
                setSelectedLocation(location);
                setLocationDialogOpen(true);
              }}
            />
          ) : locations.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {locations.map((location) => (
                <Card key={location.id} className="group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-primary" />
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
                                <Globe className="h-3 w-3 mr-1" />
                                {location.radius_meters}m radius
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

        {/* Departments */}
        <TabsContent value="departments" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Departments</h2>
              <p className="text-sm text-muted-foreground">
                Organize your team into departments
              </p>
            </div>
            <Button
              onClick={() => {
                setSelectedDepartment(null);
                setDepartmentDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </div>

          {departments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {departments.map((department) => (
                <Card key={department.id} className="group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <h3 className="font-medium">{department.name}</h3>
                          {department.description && (
                            <p className="text-sm text-muted-foreground">
                              {department.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Manager: {getDisplayName(department.profiles)}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={department.is_active ? "default" : "secondary"}>
                              {department.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {department.code && (
                              <Badge variant="outline">{department.code}</Badge>
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
                            disabled={processingId === department.id}
                          >
                            {processingId === department.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedDepartment(department);
                              setDepartmentDialogOpen(true);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteDepartment(department.id)}
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
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No departments configured</p>
                <Button
                  variant="link"
                  onClick={() => {
                    setSelectedDepartment(null);
                    setDepartmentDialogOpen(true);
                  }}
                >
                  Add your first department
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Positions */}
        <TabsContent value="positions" className="mt-6">
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
                          className={`h-10 w-10 rounded-lg flex items-center justify-center bg-${position.color}-500`}
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

        {/* PTO Policies */}
        <TabsContent value="pto-policies" className="mt-6">
          <PTOPolicyManager
            policies={ptoPolicies}
            organizationId={organization.id}
          />
        </TabsContent>
      </Tabs>

      {/* Location Dialog */}
      <LocationDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        location={selectedLocation}
        organizationId={organization.id}
      />

      {/* Department Dialog */}
      <DepartmentDialog
        open={departmentDialogOpen}
        onOpenChange={setDepartmentDialogOpen}
        department={selectedDepartment}
        organizationId={organization.id}
        teamMembers={teamMembers}
      />

      {/* Position Dialog */}
      <PositionDialog
        open={positionDialogOpen}
        onOpenChange={setPositionDialogOpen}
        position={selectedPosition}
        organizationId={organization.id}
      />
    </div>
  );
}
