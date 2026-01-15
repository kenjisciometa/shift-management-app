"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Users, Calendar, AlertTriangle, X } from "lucide-react";

type PTOPolicy = Database["public"]["Tables"]["pto_policies"]["Row"];

type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

interface PTOBalanceInitializeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  policies: PTOPolicy[];
  onSuccess?: () => void;
}

export function PTOBalanceInitializeDialog({
  open,
  onOpenChange,
  organizationId,
  policies,
  onSuccess,
}: PTOBalanceInitializeDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [totalUserCount, setTotalUserCount] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    userSelection: "all" as "all" | "specific",
    selectedUserIds: [] as string[],
    overwriteExisting: false,
  });

  const [searchQuery, setSearchQuery] = useState("");

  // Fetch user count when dialog opens
  useEffect(() => {
    if (open) {
      fetchUserCount();
      if (formData.userSelection === "specific") {
        fetchTeamMembers();
      }
    }
  }, [open, formData.userSelection]);

  const fetchUserCount = async () => {
    try {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "active");

      if (error) throw error;
      setTotalUserCount(count || 0);
    } catch (error) {
      console.error("Error fetching user count:", error);
    }
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData({
        year: new Date().getFullYear(),
        userSelection: "all",
        selectedUserIds: [],
        overwriteExisting: false,
      });
      setSearchQuery("");
    }
  }, [open]);

  const fetchTeamMembers = async () => {
    setFetchingUsers(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name, avatar_url, role")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .order("first_name");

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast.error("Failed to load team members");
    } finally {
      setFetchingUsers(false);
    }
  };

  const getDisplayName = (member: TeamMember) => {
    if (member.display_name) return member.display_name;
    return `${member.first_name} ${member.last_name}`;
  };

  const getInitials = (member: TeamMember) => {
    return `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
  };

  const filteredMembers = teamMembers.filter((member) => {
    if (!searchQuery) return true;
    const name = getDisplayName(member).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const handleToggleUser = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedUserIds: prev.selectedUserIds.includes(userId)
        ? prev.selectedUserIds.filter((id) => id !== userId)
        : [...prev.selectedUserIds, userId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (formData.userSelection === "specific" && formData.selectedUserIds.length === 0) {
      toast.error("Please select at least one user");
      return;
    }

    const activePolicies = policies.filter((p) => p.is_active);
    if (activePolicies.length === 0) {
      toast.error("No active PTO policies found. Please create policies first.");
      return;
    }

    setLoading(true);

    try {
      const requestBody: {
        year: number;
        overwrite_existing: boolean;
        user_ids?: string[];
      } = {
        year: formData.year,
        overwrite_existing: formData.overwriteExisting,
      };

      if (formData.userSelection === "specific") {
        requestBody.user_ids = formData.selectedUserIds;
      }

      const response = await fetch("/api/pto/balance/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initialize balances");
      }

      const result = data.data;
      const totalProcessed = result.created + result.skipped + result.updated;

      if (result.errors.length > 0) {
        toast.warning(
          `Initialized ${totalProcessed} balances, but ${result.errors.length} errors occurred`,
          {
            description: "Check console for details",
          }
        );
      } else {
        toast.success(
          `Successfully initialized ${result.created} balance${result.created !== 1 ? "s" : ""}`,
          {
            description:
              result.skipped > 0
                ? `${result.skipped} existing balance${result.skipped !== 1 ? "s" : ""} skipped`
                : undefined,
          }
        );
      }

      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to initialize balances"
      );
    } finally {
      setLoading(false);
    }
  };

  const activePolicies = policies.filter((p) => p.is_active);
  const estimatedUsers =
    formData.userSelection === "all"
      ? totalUserCount ?? 0
      : formData.selectedUserIds.length;
  const estimatedBalances = activePolicies.length * estimatedUsers;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Initialize PTO Balances</DialogTitle>
          <DialogDescription>
            Create PTO balances for users based on active policies. This will set up initial
            entitlements for the selected year.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Year Selection */}
          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Select
              value={formData.year.toString()}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, year: parseInt(value) }))
              }
            >
              <SelectTrigger id="year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  new Date().getFullYear() - 1,
                  new Date().getFullYear(),
                  new Date().getFullYear() + 1,
                ].map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select the year for which to initialize balances
            </p>
          </div>

          {/* User Selection */}
          <div className="space-y-3">
            <Label>User Selection</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="all-users"
                  name="userSelection"
                  checked={formData.userSelection === "all"}
                  onChange={() => {
                    setFormData((prev) => ({
                      ...prev,
                      userSelection: "all",
                      selectedUserIds: [],
                    }));
                  }}
                  className="h-4 w-4"
                />
                <Label htmlFor="all-users" className="font-normal cursor-pointer">
                  All active users
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="specific-users"
                  name="userSelection"
                  checked={formData.userSelection === "specific"}
                  onChange={() => {
                    setFormData((prev) => ({
                      ...prev,
                      userSelection: "specific",
                    }));
                    if (teamMembers.length === 0) {
                      fetchTeamMembers();
                    }
                  }}
                  className="h-4 w-4"
                />
                <Label htmlFor="specific-users" className="font-normal cursor-pointer">
                  Specific users
                </Label>
              </div>
            </div>

            {/* Specific Users Selection */}
            {formData.userSelection === "specific" && (
              <div className="space-y-2 border rounded-md p-4">
                <div className="flex items-center justify-between">
                  <Label>Select Users</Label>
                  {formData.selectedUserIds.length > 0 && (
                    <Badge variant="secondary">
                      {formData.selectedUserIds.length} selected
                    </Badge>
                  )}
                </div>

                {/* Search Input */}
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-2"
                />

                {/* Selected Users */}
                {formData.selectedUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 pb-2 border-b">
                    {formData.selectedUserIds.map((userId) => {
                      const member = teamMembers.find((m) => m.id === userId);
                      if (!member) return null;
                      return (
                        <Badge
                          key={userId}
                          variant="secondary"
                          className="flex items-center gap-1 pr-1"
                        >
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={member.avatar_url || undefined} />
                            <AvatarFallback className="text-[8px]">
                              {getInitials(member)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{getDisplayName(member)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => handleToggleUser(userId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* User List */}
                <ScrollArea className="h-60 border rounded-md">
                  <div className="p-2">
                    {fetchingUsers ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredMembers.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        {searchQuery ? "No users found" : "No active users"}
                      </p>
                    ) : (
                      filteredMembers.map((member) => {
                        const isSelected = formData.selectedUserIds.includes(member.id);
                        return (
                          <div
                            key={member.id}
                            role="button"
                            tabIndex={0}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-primary/10 border border-primary"
                                : "hover:bg-muted"
                            }`}
                            onClick={() => handleToggleUser(member.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleToggleUser(member.id);
                              }
                            }}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.avatar_url || undefined} />
                              <AvatarFallback>{getInitials(member)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {getDisplayName(member)}
                              </div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {member.role}
                              </div>
                            </div>
                            <Checkbox checked={isSelected} />
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Overwrite Existing */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="overwrite"
              checked={formData.overwriteExisting}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  overwriteExisting: checked as boolean,
                }))
              }
            />
            <Label htmlFor="overwrite" className="font-normal cursor-pointer">
              Overwrite existing balances
            </Label>
          </div>
          {formData.overwriteExisting && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Existing balances will be updated with new entitled days from policies. This may
                overwrite current balance data.
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="p-4 bg-muted rounded-md space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              <span>Summary</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Active Policies:</span>
                <span className="ml-2 font-medium">{activePolicies.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Target Users:</span>
                <span className="ml-2 font-medium">
                  {formData.userSelection === "all"
                    ? "All active users"
                    : `${formData.selectedUserIds.length} selected`}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Estimated Balances:</span>
                <span className="ml-2 font-medium">
                  {estimatedBalances} balance{estimatedBalances !== 1 ? "s" : ""} will be created
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || estimatedBalances === 0}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Initialize Balances
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
