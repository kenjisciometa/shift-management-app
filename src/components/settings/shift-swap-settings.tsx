"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPut } from "@/lib/api-client";
import type { Json } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
import { Loader2, ArrowRightLeft } from "lucide-react";

export interface ShiftSwapSettings {
  enabled: boolean;
  requireAdminApproval: boolean;
  autoUpdateSchedule: boolean;
  allowCrossPositionSwaps: boolean;
  maxDaysInAdvance: number;
  notifyManagersOnRequest: boolean;
}

export const defaultShiftSwapSettings: ShiftSwapSettings = {
  enabled: true,
  requireAdminApproval: true,
  autoUpdateSchedule: true,
  allowCrossPositionSwaps: true,
  maxDaysInAdvance: 0,
  notifyManagersOnRequest: true,
};

interface ShiftSwapSettingsComponentProps {
  organizationId: string;
  initialSettings: any;
}

export function ShiftSwapSettingsComponent({
  organizationId,
  initialSettings,
}: ShiftSwapSettingsComponentProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<ShiftSwapSettings>(() => {
    const savedSettings = initialSettings?.shiftSwapSettings;
    if (!savedSettings) return defaultShiftSwapSettings;
    return { ...defaultShiftSwapSettings, ...savedSettings };
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      // Merge with existing settings
      const updatedSettings = {
        ...initialSettings,
        shiftSwapSettings: settings,
      };

      const response = await apiPut("/api/organization", {
        settings: updatedSettings as unknown as Json,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to save shift swap settings");
      }

      toast.success("Shift swap settings saved");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save shift swap settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Shift Swap Settings
          </CardTitle>
          <CardDescription>
            Configure how shift swaps work in your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Shift Swaps</Label>
              <p className="text-sm text-muted-foreground">
                Allow employees to request shift swaps with each other.
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, enabled: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Require Admin Approval</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, shift swaps require approval from Admin, Owner, or Manager. When disabled, swaps are automatically approved once both parties agree.
              </p>
            </div>
            <Switch
              checked={settings.requireAdminApproval}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, requireAdminApproval: checked }))
              }
              disabled={!settings.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Auto-Update Schedule</Label>
              <p className="text-sm text-muted-foreground">
                Automatically update the schedule when a swap is approved. When disabled, managers must manually update shifts.
              </p>
            </div>
            <Switch
              checked={settings.autoUpdateSchedule}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, autoUpdateSchedule: checked }))
              }
              disabled={!settings.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Allow Cross-Position Swaps</Label>
              <p className="text-sm text-muted-foreground">
                Allow employees to swap shifts with different positions. When disabled, only same-position swaps are allowed.
              </p>
            </div>
            <Switch
              checked={settings.allowCrossPositionSwaps}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, allowCrossPositionSwaps: checked }))
              }
              disabled={!settings.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Notify Managers on Request</Label>
              <p className="text-sm text-muted-foreground">
                Send a notification to managers when a new swap request is submitted.
              </p>
            </div>
            <Switch
              checked={settings.notifyManagersOnRequest}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, notifyManagersOnRequest: checked }))
              }
              disabled={!settings.enabled}
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-0.5">
              <Label className="text-base">Maximum Days in Advance</Label>
              <p className="text-sm text-muted-foreground">
                Limit how far in advance employees can request shift swaps.
              </p>
            </div>
            <Select
              value={settings.maxDaysInAdvance.toString()}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, maxDaysInAdvance: parseInt(value) }))
              }
              disabled={!settings.enabled}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Unlimited</SelectItem>
                <SelectItem value="7">1 week</SelectItem>
                <SelectItem value="14">2 weeks</SelectItem>
                <SelectItem value="30">1 month</SelectItem>
                <SelectItem value="60">2 months</SelectItem>
                <SelectItem value="90">3 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Shift Swap Settings
        </Button>
      </div>
    </div>
  );
}
