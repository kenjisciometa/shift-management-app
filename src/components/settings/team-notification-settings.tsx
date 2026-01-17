"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPut } from "@/lib/api-client";
import type { Json } from "@/types/database.types";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Bell } from "lucide-react";

export interface TeamNotificationSettings {
  shiftReminders: boolean;
  shiftReminderTime: number; // in minutes before shift
  schedulePublished: boolean;
}

export const defaultTeamNotificationSettings: TeamNotificationSettings = {
  shiftReminders: true,
  shiftReminderTime: 60,
  schedulePublished: true,
};

interface TeamNotificationSettingsComponentProps {
  organizationId: string;
  initialSettings: any;
}

export function TeamNotificationSettingsComponent({
  organizationId,
  initialSettings,
}: TeamNotificationSettingsComponentProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<TeamNotificationSettings>(() => {
    const savedSettings = initialSettings?.teamScheduling?.notifications as TeamNotificationSettings | undefined;
    if (!savedSettings) return defaultTeamNotificationSettings;
    return { ...defaultTeamNotificationSettings, ...savedSettings };
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      // Merge with existing settings
      const updatedSettings = {
        ...initialSettings,
        teamScheduling: {
          ...initialSettings?.teamScheduling,
          notifications: settings,
        },
      };

      const response = await apiPut("/api/organization", {
        settings: updatedSettings as unknown as Json,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to save notification settings");
      }

      toast.success("Notification settings saved");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save notification settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Team Notification Settings
        </CardTitle>
        <CardDescription>
          Configure team-wide notifications for shifts and schedules
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Shift Reminders</Label>
            <p className="text-sm text-muted-foreground">
              Send reminders before shifts start
            </p>
          </div>
          <Switch
            checked={settings.shiftReminders}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({
                ...prev,
                shiftReminders: checked,
              }))
            }
          />
        </div>

        {settings.shiftReminders && (
          <div className="space-y-2 ml-6">
            <Label>Reminder Time</Label>
            <Select
              value={settings.shiftReminderTime.toString()}
              onValueChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  shiftReminderTime: parseInt(value),
                }))
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes before</SelectItem>
                <SelectItem value="30">30 minutes before</SelectItem>
                <SelectItem value="60">1 hour before</SelectItem>
                <SelectItem value="120">2 hours before</SelectItem>
                <SelectItem value="1440">1 day before</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Schedule Published</Label>
            <p className="text-sm text-muted-foreground">
              Notify team members when schedule is published
            </p>
          </div>
          <Switch
            checked={settings.schedulePublished}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({
                ...prev,
                schedulePublished: checked,
              }))
            }
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Notification Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
