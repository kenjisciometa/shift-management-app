"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiPut, apiDelete, apiUpload } from "@/lib/api-client";
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
  Users,
  Loader2,
  Plus,
  MoreHorizontal,
  Upload,
  X,
  ImageIcon,
  Globe,
} from "lucide-react";
import { DepartmentDialog } from "./department-dialog";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Organization = Database["public"]["Tables"]["organizations"]["Row"];
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

interface OrganizationSettingsProps {
  profile: Profile;
  organization: Organization;
  departments: Department[];
  teamMembers: TeamMember[];
}

const timezones = [
  { value: "none", label: "Not specified" },
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

const countries = [
  { value: "none", label: "Not specified" },
  { value: "GB", label: "United Kingdom" },
  { value: "IE", label: "Ireland" },
  { value: "DE", label: "Germany (Deutschland)" },
  { value: "FR", label: "France" },
  { value: "NL", label: "Netherlands (Nederland)" },
  { value: "BE", label: "Belgium (België)" },
  { value: "CH", label: "Switzerland (Schweiz)" },
  { value: "AT", label: "Austria (Österreich)" },
  { value: "ES", label: "Spain (España)" },
  { value: "PT", label: "Portugal" },
  { value: "IT", label: "Italy (Italia)" },
  { value: "GR", label: "Greece (Ελλάδα)" },
  { value: "SE", label: "Sweden (Sverige)" },
  { value: "NO", label: "Norway (Norge)" },
  { value: "DK", label: "Denmark (Danmark)" },
  { value: "FI", label: "Finland (Suomi)" },
  { value: "PL", label: "Poland (Polska)" },
  { value: "CZ", label: "Czech Republic (Česko)" },
  { value: "HU", label: "Hungary (Magyarország)" },
  { value: "RO", label: "Romania (România)" },
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "NZ", label: "New Zealand" },
  { value: "JP", label: "Japan (日本)" },
  { value: "KR", label: "South Korea (한국)" },
  { value: "SG", label: "Singapore" },
  { value: "HK", label: "Hong Kong (香港)" },
];

const locales = [
  { value: "none", label: "Not specified" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-US", label: "English (US)" },
  { value: "de-DE", label: "German (Deutsch)" },
  { value: "fr-FR", label: "French (Français)" },
  { value: "nl-NL", label: "Dutch (Nederlands)" },
  { value: "es-ES", label: "Spanish (Español)" },
  { value: "it-IT", label: "Italian (Italiano)" },
  { value: "pt-PT", label: "Portuguese (Português)" },
  { value: "sv-SE", label: "Swedish (Svenska)" },
  { value: "no-NO", label: "Norwegian (Norsk)" },
  { value: "da-DK", label: "Danish (Dansk)" },
  { value: "fi-FI", label: "Finnish (Suomi)" },
  { value: "pl-PL", label: "Polish (Polski)" },
  { value: "ja-JP", label: "Japanese (日本語)" },
  { value: "ko-KR", label: "Korean (한국어)" },
  { value: "zh-CN", label: "Chinese Simplified (简体中文)" },
  { value: "zh-TW", label: "Chinese Traditional (繁體中文)" },
];

export function OrganizationSettings({
  organization,
  departments,
  teamMembers,
}: OrganizationSettingsProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Organization form state
  const orgSettings = organization.settings as { country?: string } | null;
  const [orgForm, setOrgForm] = useState({
    name: organization.name,
    timezone: organization.timezone || "none",
    locale: organization.locale || "none",
    country: orgSettings?.country || "none",
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
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiUpload<{ logo_url: string }>(
        "/api/organization/logo",
        formData
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to upload logo");
      }

      setLogoUrl(response.data.logo_url);
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
      const response = await apiDelete("/api/organization/logo");

      if (!response.success) {
        throw new Error(response.error || "Failed to remove logo");
      }

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
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);

  const handleSaveOrganization = async () => {
    if (!orgForm.name.trim()) {
      toast.error("Organization name is required");
      return;
    }

    setSaving(true);
    try {
      const currentSettings = (organization.settings as Record<string, unknown>) || {};
      const response = await apiPut(`/api/organization`, {
        name: orgForm.name.trim(),
        timezone: orgForm.timezone === "none" ? null : orgForm.timezone,
        locale: orgForm.locale === "none" ? null : orgForm.locale,
        settings: {
          ...currentSettings,
          country: orgForm.country === "none" ? null : orgForm.country,
        },
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to update organization");
      }

      toast.success("Organization updated");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update organization");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    setProcessingId(departmentId);
    try {
      const response = await apiDelete(`/api/organization/departments/${departmentId}`);

      if (!response.success) {
        throw new Error(response.error || "Failed to delete department");
      }

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
      {/* Organization Details */}
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

          <div className="pt-4">
            <Button onClick={handleSaveOrganization} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Regional Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Regional Settings
          </CardTitle>
          <CardDescription>
            Configure regional preferences for your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="country">Country / Region</Label>
            <Select
              value={orgForm.country}
              onValueChange={(value) =>
                setOrgForm((prev) => ({ ...prev, country: value }))
              }
            >
              <SelectTrigger id="country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.value} value={country.value}>
                    {country.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used for displaying national holidays on the calendar
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="locale">Language / Locale</Label>
            <Select
              value={orgForm.locale}
              onValueChange={(value) =>
                setOrgForm((prev) => ({ ...prev, locale: value }))
              }
            >
              <SelectTrigger id="locale">
                <SelectValue placeholder="Select locale" />
              </SelectTrigger>
              <SelectContent>
                {locales.map((locale) => (
                  <SelectItem key={locale.value} value={locale.value}>
                    {locale.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Default language and number/date formatting for your organization
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={orgForm.timezone}
              onValueChange={(value) =>
                setOrgForm((prev) => ({ ...prev, timezone: value }))
              }
            >
              <SelectTrigger id="timezone">
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
            <p className="text-xs text-muted-foreground">
              Used for scheduling and time display. Individual users can override this in their preferences.
            </p>
          </div>

          <div className="pt-4">
            <Button onClick={handleSaveOrganization} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Departments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
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
      </div>

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
