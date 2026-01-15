"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Loader2,
  Settings2,
  GripVertical,
  Clock,
  Volume2,
} from "lucide-react";

// Team Settings Types
type ShiftDisplayField = "time" | "position" | "location" | "name";

interface ShiftFieldConfig {
  field: ShiftDisplayField;
  visible: boolean;
}

export interface TeamSettings {
  displayPreferences: {
    timeFormat: "12h" | "24h";
    clockType: "local" | "world";
    weekStartDay: "sunday" | "monday" | "saturday";
  };
  schedulingPreferences: {
    defaultShiftDuration: number; // in hours
    breakDuration: number; // in minutes
  };
  shiftAppearance: {
    day: ShiftFieldConfig[];
    week: ShiftFieldConfig[];
    month: ShiftFieldConfig[];
  };
  otherPreferences: {
    soundEffects: boolean;
    showTypingIndicator: boolean;
  };
}

export const defaultTeamSettings: TeamSettings = {
  displayPreferences: {
    timeFormat: "12h",
    clockType: "local",
    weekStartDay: "sunday",
  },
  schedulingPreferences: {
    defaultShiftDuration: 8,
    breakDuration: 30,
  },
  shiftAppearance: {
    day: [
      { field: "location", visible: true },
      { field: "time", visible: true },
      { field: "position", visible: true },
      { field: "name", visible: true },
    ],
    week: [
      { field: "location", visible: true },
      { field: "time", visible: true },
      { field: "position", visible: true },
      { field: "name", visible: true },
    ],
    month: [
      { field: "location", visible: true },
      { field: "time", visible: true },
      { field: "position", visible: true },
      { field: "name", visible: true },
    ],
  },
  otherPreferences: {
    soundEffects: true,
    showTypingIndicator: true,
  },
};

const fieldLabels: Record<ShiftDisplayField, string> = {
  time: "Time",
  position: "Position",
  location: "Location",
  name: "Name",
};

// Sortable Item Component
function SortableItem({
  id,
  label,
  visible,
  onVisibilityChange,
}: {
  id: string;
  label: string;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 bg-background border rounded-md ${
        isDragging ? "opacity-50 shadow-lg" : ""
      } ${!visible ? "opacity-50" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className={`text-sm flex-1 ${!visible ? "line-through" : ""}`}>{label}</span>
      <Switch
        checked={visible}
        onCheckedChange={onVisibilityChange}
        className="h-5 w-9"
      />
    </div>
  );
}

interface TeamSettingsComponentProps {
  organizationId: string;
  initialSettings: any;
}

export function TeamSettingsComponent({
  organizationId,
  initialSettings,
}: TeamSettingsComponentProps) {
  const router = useRouter();
  const supabase = createClient();
  const [savingTeamSettings, setSavingTeamSettings] = useState(false);

  // Team Settings state - handle migration from old format
  const [teamSettings, setTeamSettings] = useState<TeamSettings>(() => {
    const savedSettings = initialSettings as any;
    if (!savedSettings) return defaultTeamSettings;

    // Check if settings need migration (old format used string arrays)
    const needsMigration = savedSettings.shiftAppearance?.day &&
      typeof savedSettings.shiftAppearance.day[0] === "string";

    if (needsMigration) {
      const migrateArray = (arr: string[]): ShiftFieldConfig[] =>
        arr.map((field) => ({ field: field as ShiftDisplayField, visible: true }));

      return {
        ...defaultTeamSettings,
        ...savedSettings,
        shiftAppearance: {
          day: migrateArray(savedSettings.shiftAppearance.day),
          week: migrateArray(savedSettings.shiftAppearance.week),
          month: migrateArray(savedSettings.shiftAppearance.month),
        },
      };
    }

    return { ...defaultTeamSettings, ...savedSettings };
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent, view: "day" | "week" | "month") => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTeamSettings((prev) => {
        const items = prev.shiftAppearance[view];
        const oldIndex = items.findIndex((item) => item.field === active.id);
        const newIndex = items.findIndex((item) => item.field === over.id);

        return {
          ...prev,
          shiftAppearance: {
            ...prev.shiftAppearance,
            [view]: arrayMove(items, oldIndex, newIndex),
          },
        };
      });
    }
  };

  const handleVisibilityChange = (view: "day" | "week" | "month", field: ShiftDisplayField, visible: boolean) => {
    setTeamSettings((prev) => ({
      ...prev,
      shiftAppearance: {
        ...prev.shiftAppearance,
        [view]: prev.shiftAppearance[view].map((item) =>
          item.field === field ? { ...item, visible } : item
        ),
      },
    }));
  };

  const handleSaveTeamSettings = async () => {
    setSavingTeamSettings(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          settings: teamSettings as unknown as Json,
        })
        .eq("id", organizationId);

      if (error) throw error;

      toast.success("Team settings saved");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save team settings");
    } finally {
      setSavingTeamSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Display Preferences
          </CardTitle>
          <CardDescription>
            Configure how time and dates are displayed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Time Format</Label>
            <Select
              value={teamSettings.displayPreferences.timeFormat}
              onValueChange={(value: "12h" | "24h") =>
                setTeamSettings((prev) => ({
                  ...prev,
                  displayPreferences: {
                    ...prev.displayPreferences,
                    timeFormat: value,
                  },
                }))
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                <SelectItem value="24h">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Clock Type</Label>
            <Select
              value={teamSettings.displayPreferences.clockType}
              onValueChange={(value: "local" | "world") =>
                setTeamSettings((prev) => ({
                  ...prev,
                  displayPreferences: {
                    ...prev.displayPreferences,
                    clockType: value,
                  },
                }))
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local Time</SelectItem>
                <SelectItem value="world">World Clock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Week Start Day</Label>
            <Select
              value={teamSettings.displayPreferences.weekStartDay}
              onValueChange={(value: "sunday" | "monday" | "saturday") =>
                setTeamSettings((prev) => ({
                  ...prev,
                  displayPreferences: {
                    ...prev.displayPreferences,
                    weekStartDay: value,
                  },
                }))
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sunday">Sunday</SelectItem>
                <SelectItem value="monday">Monday</SelectItem>
                <SelectItem value="saturday">Saturday</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Scheduling Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduling Preferences
          </CardTitle>
          <CardDescription>
            Default settings for shift scheduling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Shift Duration</Label>
            <Select
              value={teamSettings.schedulingPreferences.defaultShiftDuration.toString()}
              onValueChange={(value) =>
                setTeamSettings((prev) => ({
                  ...prev,
                  schedulingPreferences: {
                    ...prev.schedulingPreferences,
                    defaultShiftDuration: parseInt(value),
                  },
                }))
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 hours</SelectItem>
                <SelectItem value="5">5 hours</SelectItem>
                <SelectItem value="6">6 hours</SelectItem>
                <SelectItem value="7">7 hours</SelectItem>
                <SelectItem value="8">8 hours</SelectItem>
                <SelectItem value="9">9 hours</SelectItem>
                <SelectItem value="10">10 hours</SelectItem>
                <SelectItem value="12">12 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Break Duration</Label>
            <Select
              value={teamSettings.schedulingPreferences.breakDuration.toString()}
              onValueChange={(value) =>
                setTeamSettings((prev) => ({
                  ...prev,
                  schedulingPreferences: {
                    ...prev.schedulingPreferences,
                    breakDuration: parseInt(value),
                  },
                }))
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No break</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Shift Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Shift Appearance on Calendar
          </CardTitle>
          <CardDescription>
            Drag and drop to reorder how shift information is displayed. Toggle visibility for each field.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Day View */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Day View</Label>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, "day")}
              >
                <SortableContext
                  items={teamSettings.shiftAppearance.day.map((item) => item.field)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {teamSettings.shiftAppearance.day.map((item) => (
                      <SortableItem
                        key={item.field}
                        id={item.field}
                        label={fieldLabels[item.field]}
                        visible={item.visible}
                        onVisibilityChange={(visible) =>
                          handleVisibilityChange("day", item.field, visible)
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Week View */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Week View</Label>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, "week")}
              >
                <SortableContext
                  items={teamSettings.shiftAppearance.week.map((item) => item.field)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {teamSettings.shiftAppearance.week.map((item) => (
                      <SortableItem
                        key={item.field}
                        id={item.field}
                        label={fieldLabels[item.field]}
                        visible={item.visible}
                        onVisibilityChange={(visible) =>
                          handleVisibilityChange("week", item.field, visible)
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Month View */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Month View</Label>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, "month")}
              >
                <SortableContext
                  items={teamSettings.shiftAppearance.month.map((item) => item.field)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {teamSettings.shiftAppearance.month.map((item) => (
                      <SortableItem
                        key={item.field}
                        id={item.field}
                        label={fieldLabels[item.field]}
                        visible={item.visible}
                        onVisibilityChange={(visible) =>
                          handleVisibilityChange("month", item.field, visible)
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Other Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Other Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Sound Effects</Label>
              <p className="text-sm text-muted-foreground">
                Enable sound effects for sent and received messages.
              </p>
            </div>
            <Switch
              checked={teamSettings.otherPreferences.soundEffects}
              onCheckedChange={(checked) =>
                setTeamSettings((prev) => ({
                  ...prev,
                  otherPreferences: {
                    ...prev.otherPreferences,
                    soundEffects: checked,
                  },
                }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Show others when I am typing</Label>
              <p className="text-sm text-muted-foreground">
                Allow others to see when you are typing a message.
              </p>
            </div>
            <Switch
              checked={teamSettings.otherPreferences.showTypingIndicator}
              onCheckedChange={(checked) =>
                setTeamSettings((prev) => ({
                  ...prev,
                  otherPreferences: {
                    ...prev.otherPreferences,
                    showTypingIndicator: checked,
                  },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveTeamSettings} disabled={savingTeamSettings}>
          {savingTeamSettings && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Schedule Settings
        </Button>
      </div>
    </div>
  );
}
