"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
  Upload,
  X,
  ImageIcon,
} from "lucide-react";
import { LocationDialog } from "./location-dialog";
import { DepartmentDialog } from "./department-dialog";
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

interface OrganizationSettingsProps {
  profile: Profile;
  organization: Organization;
  locations: Location[];
  departments: Department[];
  teamMembers: TeamMember[];
  ptoPolicies: PTOPolicy[];
}

const timezones = [
  { value: "Pacific/Honolulu", label: "Honolulu (HST)" },
  { value: "America/Anchorage", label: "Anchorage (AKST)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST)" },
  { value: "America/Denver", label: "Denver (MST)" },
  { value: "America/Chicago", label: "Chicago (CST)" },
  { value: "America/New_York", label: "New York (EST)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Europe/Helsinki", label: "Helsinki (EET)" },
  { value: "Europe/Moscow", label: "Moscow (MSK)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Kolkata", label: "Mumbai (IST)" },
  { value: "Asia/Bangkok", label: "Bangkok (ICT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Seoul", label: "Seoul (KST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST)" },
];

export function OrganizationSettings({
  profile,
  organization,
  locations,
  departments,
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

  // Logo upload state
  const [logoUrl, setLogoUrl] = useState<string | null>(organization.logo_url);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Allowed image formats and max size
  const ALLOWED_FORMATS = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const MAX_FILE_SIZE = 3.5 * 1024 * 1024; // 3.5MB

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_FORMATS.includes(file.type)) {
      return "Invalid file format. Please upload JPG, PNG, GIF, or WebP.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size exceeds 3.5MB limit.";
    }
    return null;
  };

  const uploadLogo = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setUploadingLogo(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${organization.id}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Delete old logo if exists
      if (logoUrl) {
        const oldPath = logoUrl.split("/organization-logos/")[1];
        if (oldPath) {
          await supabase.storage.from("organization-logos").remove([oldPath]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from("organization-logos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("organization-logos")
        .getPublicUrl(filePath);

      const newLogoUrl = urlData.publicUrl;

      // Update organization record
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ logo_url: newLogoUrl })
        .eq("id", organization.id);

      if (updateError) throw updateError;

      setLogoUrl(newLogoUrl);
      toast.success("Logo uploaded successfully");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    if (!logoUrl) return;

    setUploadingLogo(true);
    try {
      // Delete from storage
      const oldPath = logoUrl.split("/organization-logos/")[1];
      if (oldPath) {
        await supabase.storage.from("organization-logos").remove([oldPath]);
      }

      // Update organization record
      const { error } = await supabase
        .from("organizations")
        .update({ logo_url: null })
        .eq("id", organization.id);

      if (error) throw error;

      setLogoUrl(null);
      toast.success("Logo removed");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadLogo(file);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadLogo(file);
    }
  }, []);

  // Dialogs
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);

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
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Organization Logo</Label>
                <div className="flex items-start gap-4">
                  {/* Logo Preview */}
                  <div className="relative h-24 w-24 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                    {logoUrl ? (
                      <>
                        <Image
                          src={logoUrl}
                          alt="Organization logo"
                          fill
                          className="object-cover"
                        />
                        <button
                          onClick={removeLogo}
                          disabled={uploadingLogo}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>

                  {/* Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {uploadingLogo ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Uploading...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          Drop your logo here or click to browse
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, GIF, or WebP. Max 3.5MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

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
    </div>
  );
}
