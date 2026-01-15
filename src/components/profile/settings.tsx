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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  Loader2,
  Upload,
  X,
  Camera,
  Briefcase,
  Calendar,
  Hash,
} from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface UserLocation {
  location_id: string;
  is_primary: boolean | null;
  locations: {
    id: string;
    name: string;
  } | null;
}

interface ProfileSettingsProps {
  user: {
    id: string;
    email: string;
  };
  profile: Profile;
  department: {
    id: string;
    name: string;
  } | null;
  userLocations: UserLocation[];
}

export function ProfileSettings({
  user,
  profile,
  department,
  userLocations,
}: ProfileSettingsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    first_name: profile.first_name || "",
    last_name: profile.last_name || "",
    display_name: profile.display_name || "",
    phone: profile.phone || "",
  });

  // Avatar upload state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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

  const uploadAvatar = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setUploadingAvatar(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Delete old avatar if exists
      if (avatarUrl) {
        const oldPath = avatarUrl.split("/avatars/")[1];
        if (oldPath) {
          await supabase.storage.from("avatars").remove([`avatars/${oldPath}`]);
        }
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const newAvatarUrl = urlData.publicUrl;

      // Update profile record
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(newAvatarUrl);
      toast.success("Profile photo updated");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    if (!avatarUrl) return;

    setUploadingAvatar(true);
    try {
      // Delete from storage
      const oldPath = avatarUrl.split("/avatars/")[1];
      if (oldPath) {
        await supabase.storage.from("avatars").remove([`avatars/${oldPath}`]);
      }

      // Update profile record
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);

      if (error) throw error;

      setAvatarUrl(null);
      toast.success("Photo removed");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAvatar(file);
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
      uploadAvatar(file);
    }
  }, []);

  const handleSaveProfile = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          display_name: form.display_name.trim() || null,
          phone: form.phone.trim() || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    if (form.first_name && form.last_name) {
      return `${form.first_name[0]}${form.last_name[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || "U";
  };

  const getRoleBadgeVariant = (role: string | null) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "default";
      case "manager":
        return "secondary";
      default:
        return "outline";
    }
  };

  const formatRole = (role: string | null) => {
    if (!role) return "Employee";
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div className="space-y-6">
      {/* Profile Photo Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Profile Photo
          </CardTitle>
          <CardDescription>
            Upload a photo to personalize your profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            {/* Avatar Preview */}
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarUrl || undefined} alt="Profile photo" />
                <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
              </Avatar>
              {avatarUrl && (
                <button
                  onClick={removeAvatar}
                  disabled={uploadingAvatar}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
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
              {uploadingAvatar ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Drop your photo here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, GIF, or WebP. Max 3.5MB
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Update your personal details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={form.first_name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, first_name: e.target.value }))
                }
                placeholder="Enter first name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={form.last_name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, last_name: e.target.value }))
                }
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={form.display_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, display_name: e.target.value }))
              }
              placeholder="How you'd like to be called"
            />
            <p className="text-xs text-muted-foreground">
              This name will be shown instead of your full name
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="Enter phone number"
            />
          </div>

          <div className="pt-4">
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Information Card (Read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>
            Your account details (managed by your organization)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Email</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{user.email}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Role</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <Badge variant={getRoleBadgeVariant(profile.role)}>
                  {formatRole(profile.role)}
                </Badge>
              </div>
            </div>
          </div>

          {profile.employee_code && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Employee Code</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile.employee_code}</span>
              </div>
            </div>
          )}

          {profile.hire_date && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Hire Date</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(profile.hire_date).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          {department && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Department</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{department.name}</span>
              </div>
            </div>
          )}

          {userLocations.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Assigned Locations</Label>
              <div className="flex flex-wrap gap-2">
                {userLocations.map((ul) => (
                  <div
                    key={ul.location_id}
                    className="flex items-center gap-2 p-2 bg-muted rounded-md"
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {ul.locations?.name || "Unknown"}
                    </span>
                    {ul.is_primary && (
                      <Badge variant="secondary" className="text-xs">
                        Primary
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            Contact your administrator to update email, role, department, or location assignments.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
