"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { apiPut } from "@/lib/api-client";
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
import { Loader2, Monitor, Moon, Sun, Calendar, Globe } from "lucide-react";

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  dateFormat: string;
  timezone: string | null;
  calendarView: "day" | "week" | "month";
  showHolidays: boolean;
}

const defaultPreferences: UserPreferences = {
  theme: "system",
  dateFormat: "YYYY/MM/DD",
  timezone: null,
  calendarView: "month",
  showHolidays: true,
};

const dateFormats = [
  { value: "YYYY/MM/DD", label: "2024/01/15 (YYYY/MM/DD)" },
  { value: "YYYY-MM-DD", label: "2024-01-15 (YYYY-MM-DD)" },
  { value: "MM/DD/YYYY", label: "01/15/2024 (MM/DD/YYYY)" },
  { value: "DD/MM/YYYY", label: "15/01/2024 (DD/MM/YYYY)" },
  { value: "MMM D, YYYY", label: "Jan 15, 2024 (MMM D, YYYY)" },
];

const timezones = [
  { value: "org-default", label: "Use organization timezone" },
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

interface PreferencesSettingsProps {
  userId: string;
  initialPreferences?: Partial<UserPreferences>;
}

export function PreferencesSettings({
  userId,
  initialPreferences,
}: PreferencesSettingsProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    ...defaultPreferences,
    ...initialPreferences,
  });

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync theme with next-themes
  useEffect(() => {
    if (mounted && theme) {
      setPreferences((prev) => ({
        ...prev,
        theme: theme as "light" | "dark" | "system",
      }));
    }
  }, [mounted, theme]);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    setPreferences((prev) => ({ ...prev, theme: newTheme }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiPut("/api/profile/preferences", {
        preferences,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to save preferences");
      }

      toast.success("Preferences saved successfully");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Display Settings
          </CardTitle>
          <CardDescription>
            Customize how the app looks and displays information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme */}
          <div className="space-y-3">
            <Label>Theme</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={preferences.theme === "light" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleThemeChange("light")}
              >
                <Sun className="h-4 w-4 mr-2" />
                Light
              </Button>
              <Button
                type="button"
                variant={preferences.theme === "dark" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleThemeChange("dark")}
              >
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </Button>
              <Button
                type="button"
                variant={preferences.theme === "system" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleThemeChange("system")}
              >
                <Monitor className="h-4 w-4 mr-2" />
                System
              </Button>
            </div>
          </div>

          {/* Date Format */}
          <div className="space-y-2">
            <Label htmlFor="dateFormat">Date Format</Label>
            <Select
              value={preferences.dateFormat}
              onValueChange={(value) =>
                setPreferences((prev) => ({ ...prev, dateFormat: value }))
              }
            >
              <SelectTrigger id="dateFormat">
                <SelectValue placeholder="Select date format" />
              </SelectTrigger>
              <SelectContent>
                {dateFormats.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Timezone Override
              </div>
            </Label>
            <Select
              value={preferences.timezone || "org-default"}
              onValueChange={(value) =>
                setPreferences((prev) => ({
                  ...prev,
                  timezone: value === "org-default" ? null : value,
                }))
              }
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Use organization timezone" />
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
              Override the organization timezone for your personal view
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar Settings
          </CardTitle>
          <CardDescription>
            Customize your calendar display preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Calendar View */}
          <div className="space-y-2">
            <Label htmlFor="calendarView">Default Calendar View</Label>
            <Select
              value={preferences.calendarView}
              onValueChange={(value: "day" | "week" | "month") =>
                setPreferences((prev) => ({ ...prev, calendarView: value }))
              }
            >
              <SelectTrigger id="calendarView">
                <SelectValue placeholder="Select default view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day View</SelectItem>
                <SelectItem value="week">Week View</SelectItem>
                <SelectItem value="month">Month View</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Show Holidays */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showHolidays">Show Holidays</Label>
              <p className="text-sm text-muted-foreground">
                Display national holidays on the calendar
              </p>
            </div>
            <Switch
              id="showHolidays"
              checked={preferences.showHolidays}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({ ...prev, showHolidays: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
