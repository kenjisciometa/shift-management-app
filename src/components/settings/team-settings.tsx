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
  ArrowRightLeft,
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
  shiftAppearance: ShiftFieldConfig[];
  shiftSwapSettings: {
    enabled: boolean;
    requireAdminApproval: boolean;
    autoUpdateSchedule: boolean;
    allowCrossPositionSwaps: boolean;
    maxDaysInAdvance: number;
    notifyManagersOnRequest: boolean;
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
  shiftAppearance: [
    { field: "location", visible: true },
    { field: "time", visible: true },
    { field: "position", visible: true },
    { field: "name", visible: true },
  ],
  shiftSwapSettings: {
    enabled: true,
    requireAdminApproval: true,
    autoUpdateSchedule: true,
    allowCrossPositionSwaps: true,
    maxDaysInAdvance: 0,
    notifyManagersOnRequest: true,
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

// Sortable Location-Position Group Component
function SortableLocationPositionGroup({
  locationFirst,
  locationVisible,
  positionVisible,
  onSwap,
  onLocationVisibilityChange,
  onPositionVisibilityChange,
}: {
  locationFirst: boolean;
  locationVisible: boolean;
  positionVisible: boolean;
  onSwap: () => void;
  onLocationVisibilityChange: (visible: boolean) => void;
  onPositionVisibilityChange: (visible: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: "location-position" });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const firstLabel = locationFirst ? "Location" : "Position";
  const secondLabel = locationFirst ? "Position" : "Location";
  const firstVisible = locationFirst ? locationVisible : positionVisible;
  const secondVisible = locationFirst ? positionVisible : locationVisible;
  const onFirstVisibilityChange = locationFirst ? onLocationVisibilityChange : onPositionVisibilityChange;
  const onSecondVisibilityChange = locationFirst ? onPositionVisibilityChange : onLocationVisibilityChange;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 bg-background border rounded-md ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 flex items-center gap-2">
        {/* First item */}
        <div className={`flex items-center gap-1 flex-1 ${!firstVisible ? "opacity-50" : ""}`}>
          <span className={`text-sm ${!firstVisible ? "line-through" : ""}`}>{firstLabel}</span>
          <Switch
            checked={firstVisible}
            onCheckedChange={onFirstVisibilityChange}
            className="h-5 w-9"
          />
        </div>
        {/* Swap button */}
        <button
          type="button"
          onClick={onSwap}
          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
          title="Swap order"
        >
          <ArrowRightLeft className="h-4 w-4" />
        </button>
        {/* Second item */}
        <div className={`flex items-center gap-1 flex-1 ${!secondVisible ? "opacity-50" : ""}`}>
          <span className={`text-sm ${!secondVisible ? "line-through" : ""}`}>{secondLabel}</span>
          <Switch
            checked={secondVisible}
            onCheckedChange={onSecondVisibilityChange}
            className="h-5 w-9"
          />
        </div>
      </div>
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

    // Check if settings need migration from old format (day/week/month object)
    if (savedSettings.shiftAppearance?.day) {
      // Old format: { day: [...], week: [...], month: [...] }
      // Use day settings as the unified settings
      const oldSettings = savedSettings.shiftAppearance.day;

      // Check if it's string array format (even older)
      if (typeof oldSettings[0] === "string") {
        return {
          ...defaultTeamSettings,
          ...savedSettings,
          shiftAppearance: oldSettings.map((field: string) => ({
            field: field as ShiftDisplayField,
            visible: true,
          })),
        };
      }

      // It's already ShiftFieldConfig[] format
      return {
        ...defaultTeamSettings,
        ...savedSettings,
        shiftAppearance: oldSettings,
      };
    }

    // Check if shiftAppearance is already in the new unified format (array)
    if (Array.isArray(savedSettings.shiftAppearance)) {
      return { ...defaultTeamSettings, ...savedSettings };
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

  // Get sortable items - treat location+position as single group
  const getSortableItems = () => {
    const items: string[] = [];
    let locationPositionAdded = false;

    for (const field of teamSettings.shiftAppearance) {
      if (field.field === "location" || field.field === "position") {
        if (!locationPositionAdded) {
          items.push("location-position");
          locationPositionAdded = true;
        }
      } else {
        items.push(field.field);
      }
    }
    return items;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeId = active.id as string;
      const overId = over.id as string;

      setTeamSettings((prev) => {
        const items = [...prev.shiftAppearance];

        // Get location and position info
        const locationIndex = items.findIndex((item) => item.field === "location");
        const positionIndex = items.findIndex((item) => item.field === "position");
        const locationFirst = locationIndex < positionIndex;
        const locationItem = items[locationIndex];
        const positionItem = items[positionIndex];
        const groupStartIndex = Math.min(locationIndex, positionIndex);

        // Remove location and position from items
        const filteredItems = items.filter(
          (item) => item.field !== "location" && item.field !== "position"
        );

        // Build new order based on sortable items
        const sortableItems = getSortableItems();
        const oldSortIndex = sortableItems.indexOf(activeId);
        const newSortIndex = sortableItems.indexOf(overId);

        // Reorder the sortable items
        const newSortableOrder = arrayMove(sortableItems, oldSortIndex, newSortIndex);

        // Rebuild the full array
        const result: typeof items = [];
        for (const sortId of newSortableOrder) {
          if (sortId === "location-position") {
            if (locationFirst) {
              result.push(locationItem, positionItem);
            } else {
              result.push(positionItem, locationItem);
            }
          } else {
            const item = filteredItems.find((f) => f.field === sortId);
            if (item) result.push(item);
          }
        }

        return {
          ...prev,
          shiftAppearance: result,
        };
      });
    }
  };

  // Swap location and position order
  const handleSwapLocationPosition = () => {
    setTeamSettings((prev) => {
      const items = [...prev.shiftAppearance];
      const locationIndex = items.findIndex((item) => item.field === "location");
      const positionIndex = items.findIndex((item) => item.field === "position");

      [items[locationIndex], items[positionIndex]] = [items[positionIndex], items[locationIndex]];

      return {
        ...prev,
        shiftAppearance: items,
      };
    });
  };

  const handleVisibilityChange = (field: ShiftDisplayField, visible: boolean) => {
    setTeamSettings((prev) => ({
      ...prev,
      shiftAppearance: prev.shiftAppearance.map((item) =>
        item.field === field ? { ...item, visible } : item
      ),
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
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
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
                <SelectTrigger>
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
                <SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sunday">Sunday</SelectItem>
                  <SelectItem value="monday">Monday</SelectItem>
                  <SelectItem value="saturday">Saturday</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
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
                <SelectTrigger>
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
                <SelectTrigger>
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
            Location and Position are displayed on the same row - their order determines left/right placement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Preview Card */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Preview</Label>
              <div className="bg-blue-500 dark:bg-blue-600 border border-blue-600 dark:border-blue-700 rounded-lg p-2 text-white">
                {(() => {
                  const visibleFields = teamSettings.shiftAppearance.filter((item) => item.visible);
                  const locationIndex = teamSettings.shiftAppearance.findIndex((f) => f.field === "location");
                  const positionIndex = teamSettings.shiftAppearance.findIndex((f) => f.field === "position");
                  const locationFirst = locationIndex !== -1 && (positionIndex === -1 || locationIndex < positionIndex);
                  const showLocation = visibleFields.some((f) => f.field === "location");
                  const showPosition = visibleFields.some((f) => f.field === "position");

                  return visibleFields.map((item) => {
                    if (item.field === "location") {
                      return (
                        <div key="location-position" className="flex items-center gap-1 text-xs opacity-80">
                          {locationFirst ? (
                            <>
                              {showLocation && <span className="truncate">Main Office</span>}
                              {showLocation && showPosition && <span>・</span>}
                              {showPosition && <span className="truncate">Server</span>}
                            </>
                          ) : (
                            <>
                              {showPosition && <span className="truncate">Server</span>}
                              {showLocation && showPosition && <span>・</span>}
                              {showLocation && <span className="truncate">Main Office</span>}
                            </>
                          )}
                        </div>
                      );
                    }
                    if (item.field === "position") return null;
                    if (item.field === "time") {
                      return <div key="time" className="text-[10px] opacity-80 whitespace-nowrap">9:00 AM - 5:00 PM・8H</div>;
                    }
                    if (item.field === "name") {
                      return <div key="name" className="font-medium text-sm truncate">John Doe</div>;
                    }
                    return null;
                  });
                })()}
              </div>
            </div>

            {/* Config */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Field Order & Visibility</Label>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={getSortableItems()}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {(() => {
                      const locationItem = teamSettings.shiftAppearance.find((item) => item.field === "location");
                      const positionItem = teamSettings.shiftAppearance.find((item) => item.field === "position");
                      const locationIndex = teamSettings.shiftAppearance.findIndex((item) => item.field === "location");
                      const positionIndex = teamSettings.shiftAppearance.findIndex((item) => item.field === "position");
                      const locationFirst = locationIndex < positionIndex;

                      return getSortableItems().map((sortId) => {
                        if (sortId === "location-position") {
                          return (
                            <SortableLocationPositionGroup
                              key="location-position"
                              locationFirst={locationFirst}
                              locationVisible={locationItem?.visible ?? true}
                              positionVisible={positionItem?.visible ?? true}
                              onSwap={handleSwapLocationPosition}
                              onLocationVisibilityChange={(visible) => handleVisibilityChange("location", visible)}
                              onPositionVisibilityChange={(visible) => handleVisibilityChange("position", visible)}
                            />
                          );
                        }
                        const item = teamSettings.shiftAppearance.find((f) => f.field === sortId);
                        if (!item) return null;
                        return (
                          <SortableItem
                            key={item.field}
                            id={item.field}
                            label={fieldLabels[item.field]}
                            visible={item.visible}
                            onVisibilityChange={(visible) =>
                              handleVisibilityChange(item.field, visible)
                            }
                          />
                        );
                      });
                    })()}
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
