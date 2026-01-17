"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPut } from "@/lib/api-client";
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
import { Loader2, Clock, Timer, Edit3, AlertTriangle } from "lucide-react";

export interface TimeClockSettings {
  // Shift requirements
  require_shift_for_clock_in: boolean;
  allow_early_clock_in_minutes: number;
  allow_late_clock_in_minutes: number;

  // Auto clock-out
  auto_clock_out_enabled: boolean;
  auto_clock_out_hours: number;

  // Manual time entry
  allow_manual_time_entry: boolean;
  require_notes_for_manual_entry: boolean;

  // Overtime
  overtime_threshold_hours: number;
  notify_on_overtime: boolean;
}

export const defaultTimeClockSettings: TimeClockSettings = {
  require_shift_for_clock_in: false,
  allow_early_clock_in_minutes: 30,
  allow_late_clock_in_minutes: 60,
  auto_clock_out_enabled: false,
  auto_clock_out_hours: 12,
  allow_manual_time_entry: true,
  require_notes_for_manual_entry: true,
  overtime_threshold_hours: 8,
  notify_on_overtime: true,
};

interface ClockInSettingsProps {
  organizationId: string;
}

export function ClockInSettings({ organizationId }: ClockInSettingsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TimeClockSettings>(defaultTimeClockSettings);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await apiGet<TimeClockSettings>("/api/settings/organization/time-clock");
        if (response.success && response.data) {
          setSettings({ ...defaultTimeClockSettings, ...response.data });
        }
      } catch (error) {
        console.error("Failed to fetch time clock settings:", error);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiPut("/api/settings/organization/time-clock", settings);

      if (!response.success) {
        throw new Error(response.error || "Failed to save settings");
      }

      toast.success("Clock-in settings saved");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shift Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Shift Requirements
          </CardTitle>
          <CardDescription>
            Configure when employees can clock in and out
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Require Scheduled Shift</Label>
              <p className="text-sm text-muted-foreground">
                Employees can only clock in when they have a scheduled shift for that day.
              </p>
            </div>
            <Switch
              checked={settings.require_shift_for_clock_in}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, require_shift_for_clock_in: checked }))
              }
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-0.5">
              <Label className="text-base">Early Clock-in Window</Label>
              <p className="text-sm text-muted-foreground">
                How many minutes before the scheduled shift start time can employees clock in.
              </p>
            </div>
            <Select
              value={settings.allow_early_clock_in_minutes.toString()}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, allow_early_clock_in_minutes: parseInt(value) }))
              }
              disabled={!settings.require_shift_for_clock_in}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="10">10 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="space-y-0.5">
              <Label className="text-base">Late Clock-in Window</Label>
              <p className="text-sm text-muted-foreground">
                How long after the scheduled shift start time can employees still clock in.
              </p>
            </div>
            <Select
              value={settings.allow_late_clock_in_minutes.toString()}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, allow_late_clock_in_minutes: parseInt(value) }))
              }
              disabled={!settings.require_shift_for_clock_in}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="240">4 hours</SelectItem>
                <SelectItem value="480">8 hours (entire shift)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Auto Clock-out */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Auto Clock-out
          </CardTitle>
          <CardDescription>
            Automatically clock out employees after a set duration. Individual employee settings in Edit Employee will override these organization-wide defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Auto Clock-out</Label>
              <p className="text-sm text-muted-foreground">
                Automatically clock out employees who forget to clock out. Can be overridden per employee in Team &gt; Edit Employee.
              </p>
            </div>
            <Switch
              checked={settings.auto_clock_out_enabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, auto_clock_out_enabled: checked }))
              }
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-0.5">
              <Label className="text-base">Auto Clock-out After</Label>
              <p className="text-sm text-muted-foreground">
                Maximum shift duration before automatic clock-out.
              </p>
            </div>
            <Select
              value={settings.auto_clock_out_hours.toString()}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, auto_clock_out_hours: parseInt(value) }))
              }
              disabled={!settings.auto_clock_out_enabled}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">8 hours</SelectItem>
                <SelectItem value="10">10 hours</SelectItem>
                <SelectItem value="12">12 hours</SelectItem>
                <SelectItem value="14">14 hours</SelectItem>
                <SelectItem value="16">16 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Manual Time Entry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Manual Time Entry
          </CardTitle>
          <CardDescription>
            Configure options for manual time entry corrections. Individual employee settings in Edit Employee will override these organization-wide defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Allow Manual Time Entry</Label>
              <p className="text-sm text-muted-foreground">
                Allow managers to manually add or edit time entries. Can be overridden per employee in Team &gt; Edit Employee.
              </p>
            </div>
            <Switch
              checked={settings.allow_manual_time_entry}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, allow_manual_time_entry: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Require Notes for Manual Entry</Label>
              <p className="text-sm text-muted-foreground">
                Require a reason/note when manually editing time entries.
              </p>
            </div>
            <Switch
              checked={settings.require_notes_for_manual_entry}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, require_notes_for_manual_entry: checked }))
              }
              disabled={!settings.allow_manual_time_entry}
            />
          </div>
        </CardContent>
      </Card>

      {/* Overtime Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Overtime Settings
          </CardTitle>
          <CardDescription>
            Configure overtime thresholds and notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="space-y-0.5">
              <Label className="text-base">Daily Overtime Threshold</Label>
              <p className="text-sm text-muted-foreground">
                Hours worked per day before overtime is triggered.
              </p>
            </div>
            <Select
              value={settings.overtime_threshold_hours.toString()}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, overtime_threshold_hours: parseInt(value) }))
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 hours</SelectItem>
                <SelectItem value="7">7 hours</SelectItem>
                <SelectItem value="8">8 hours</SelectItem>
                <SelectItem value="9">9 hours</SelectItem>
                <SelectItem value="10">10 hours</SelectItem>
                <SelectItem value="12">12 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Notify on Overtime</Label>
              <p className="text-sm text-muted-foreground">
                Send a notification to managers when an employee exceeds overtime threshold.
              </p>
            </div>
            <Switch
              checked={settings.notify_on_overtime}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, notify_on_overtime: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Clock-in Settings
        </Button>
      </div>
    </div>
  );
}
