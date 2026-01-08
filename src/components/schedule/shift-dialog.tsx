"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, setHours, setMinutes, addDays, addWeeks, startOfDay, isBefore, isAfter, isSameDay } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Shift = Database["public"]["Tables"]["shifts"]["Row"] & {
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  locations: { id: string; name: string } | null;
  departments: { id: string; name: string } | null;
};

type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

type Location = { id: string; name: string };
type Department = { id: string; name: string };
type Position = Database["public"]["Tables"]["positions"]["Row"];
type ShiftTemplate = Database["public"]["Tables"]["shift_templates"]["Row"];

interface ShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: Shift | null;
  selectedDate: Date | null;
  template?: ShiftTemplate | null;
  teamMembers: TeamMember[];
  locations: Location[];
  departments: Department[];
  positions: Position[];
  organizationId: string;
  isAdmin: boolean;
}

const repeatOptions = [
  { value: "none", label: "No repeat" },
  { value: "this_week", label: "This week" },
  { value: "every_week", label: "Every week" },
  { value: "every_2_weeks", label: "Every 2 weeks" },
  { value: "every_3_weeks", label: "Every 3 weeks" },
  { value: "every_4_weeks", label: "Every 4 weeks" },
  { value: "every_5_weeks", label: "Every 5 weeks" },
  { value: "every_6_weeks", label: "Every 6 weeks" },
  { value: "every_7_weeks", label: "Every 7 weeks" },
  { value: "every_8_weeks", label: "Every 8 weeks" },
];

const weekDays = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export function ShiftDialog({
  open,
  onOpenChange,
  shift,
  selectedDate,
  template,
  teamMembers,
  locations,
  departments,
  positions,
  organizationId,
  isAdmin,
}: ShiftDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!shift;

  // Form state
  const [formData, setFormData] = useState({
    userId: "",
    date: "",
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 60,
    locationId: "",
    departmentId: "",
    positionId: "",
    notes: "",
    isPublished: false,
  });

  // Get selected position's color
  const selectedPosition = positions.find((p) => p.id === formData.positionId);
  const positionColor = selectedPosition?.color || "blue";

  // Repeat state
  const [repeatType, setRepeatType] = useState("none");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [repeatEndDate, setRepeatEndDate] = useState("");

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      // Reset repeat state
      setRepeatType("none");
      setSelectedDays([]);
      setRepeatEndDate("");

      if (shift) {
        const startDate = parseISO(shift.start_time);
        const endDate = parseISO(shift.end_time);
        setFormData({
          userId: shift.user_id,
          date: format(startDate, "yyyy-MM-dd"),
          startTime: format(startDate, "HH:mm"),
          endTime: format(endDate, "HH:mm"),
          breakMinutes: shift.break_minutes || 0,
          locationId: shift.location_id || "",
          departmentId: shift.department_id || "",
          positionId: shift.position_id || "",
          notes: shift.notes || "",
          isPublished: shift.is_published || false,
        });
      } else if (template) {
        // Apply template values
        const date = selectedDate || new Date();
        setFormData({
          userId: "",
          date: format(date, "yyyy-MM-dd"),
          startTime: template.start_time,
          endTime: template.end_time,
          breakMinutes: template.break_minutes || 0,
          locationId: locations[0]?.id || "",
          departmentId: "",
          positionId: "",
          notes: "",
          isPublished: false,
        });
        // Set default repeat end date to 4 weeks from start
        setRepeatEndDate(format(addWeeks(date, 4), "yyyy-MM-dd"));
      } else {
        const date = selectedDate || new Date();
        setFormData({
          userId: "",
          date: format(date, "yyyy-MM-dd"),
          startTime: "09:00",
          endTime: "17:00",
          breakMinutes: 60,
          locationId: locations[0]?.id || "",
          departmentId: "",
          positionId: "",
          notes: "",
          isPublished: false,
        });
        // Set default repeat end date to 4 weeks from start
        setRepeatEndDate(format(addWeeks(date, 4), "yyyy-MM-dd"));
      }
    }
  }, [open, shift, selectedDate, template, locations]);

  // Auto-select the current day when repeat type changes to non-none
  useEffect(() => {
    if (repeatType !== "none" && formData.date && selectedDays.length === 0) {
      const date = parseISO(formData.date);
      setSelectedDays([date.getDay()]);
    }
  }, [repeatType, formData.date, selectedDays.length]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const getRepeatWeeks = (type: string): number => {
    if (type === "this_week") return 0;
    if (type === "every_week") return 1;
    const match = type.match(/every_(\d+)_weeks/);
    return match ? parseInt(match[1]) : 0;
  };

  const generateRepeatDates = (): Date[] => {
    if (!formData.date) return [];

    const dates: Date[] = [];
    const baseDate = startOfDay(parseISO(formData.date));

    if (repeatType === "none") {
      return [baseDate];
    }

    // Get the days to repeat on (use baseDate's day if none selected)
    const daysToRepeat = selectedDays.length > 0 ? selectedDays : [baseDate.getDay()];

    if (repeatType === "this_week") {
      // Get all selected days in the same week as the base date
      daysToRepeat.forEach((day) => {
        const diff = day - baseDate.getDay();
        const targetDate = addDays(baseDate, diff);
        // Include if same day or after baseDate (within the same week)
        if (isSameDay(targetDate, baseDate) || isAfter(targetDate, baseDate)) {
          dates.push(targetDate);
        }
      });
      // Sort dates chronologically
      dates.sort((a, b) => a.getTime() - b.getTime());
      return dates.length > 0 ? dates : [baseDate];
    }

    // For "every X weeks" patterns
    const intervalWeeks = getRepeatWeeks(repeatType);
    if (!repeatEndDate) return [baseDate];

    const endDate = startOfDay(parseISO(repeatEndDate));

    // Calculate the start of the week containing baseDate (Sunday = 0)
    const baseDayOfWeek = baseDate.getDay();

    // Generate dates for each week in the interval
    let weekOffset = 0;
    const maxIterations = 100; // Safety limit to prevent infinite loops
    let iterations = 0;

    while (iterations < maxIterations) {
      const weekStartDate = addWeeks(baseDate, weekOffset);

      // Check if we've passed the end date
      if (isAfter(weekStartDate, endDate)) break;

      // For each selected day, calculate the date in this week
      daysToRepeat.forEach((targetDay) => {
        // Calculate difference from baseDate's day of week
        const diff = targetDay - baseDayOfWeek;
        const targetDate = addDays(weekStartDate, diff);

        // Include only if within range [baseDate, endDate]
        const isInRange =
          (isSameDay(targetDate, baseDate) || isAfter(targetDate, baseDate)) &&
          (isSameDay(targetDate, endDate) || isBefore(targetDate, endDate));

        if (isInRange) {
          // Check for duplicates
          const isDuplicate = dates.some(d => isSameDay(d, targetDate));
          if (!isDuplicate) {
            dates.push(targetDate);
          }
        }
      });

      weekOffset += intervalWeeks;
      iterations++;
    }

    // Sort dates chronologically
    dates.sort((a, b) => a.getTime() - b.getTime());

    return dates.length > 0 ? dates : [baseDate];
  };

  // Calculate preview count
  const previewDates = repeatType !== "none" ? generateRepeatDates() : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.userId) {
      toast.error("Please select an employee");
      return;
    }

    setLoading(true);

    try {
      const [startHour, startMinute] = formData.startTime.split(":").map(Number);
      const [endHour, endMinute] = formData.endTime.split(":").map(Number);

      if (isEditing && shift) {
        // Update existing shift
        const baseDate = parseISO(formData.date);
        const startDateTime = setMinutes(setHours(baseDate, startHour), startMinute);
        const endDateTime = setMinutes(setHours(baseDate, endHour), endMinute);

        const shiftData = {
          organization_id: organizationId,
          user_id: formData.userId,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          break_minutes: formData.breakMinutes,
          location_id: formData.locationId || null,
          department_id: formData.departmentId || null,
          position_id: formData.positionId || null,
          position: selectedPosition?.name || null,
          notes: formData.notes || null,
          color: positionColor,
          is_published: formData.isPublished,
          status: formData.isPublished ? "published" : "draft",
          published_at: formData.isPublished ? new Date().toISOString() : null,
        };

        const { error } = await supabase
          .from("shifts")
          .update(shiftData)
          .eq("id", shift.id);

        if (error) throw error;
        toast.success("Shift updated successfully");
      } else {
        // Create new shift(s) with repeat
        const repeatDates = generateRepeatDates();
        const shiftsToCreate = repeatDates.map((date) => {
          const startDateTime = setMinutes(setHours(date, startHour), startMinute);
          const endDateTime = setMinutes(setHours(date, endHour), endMinute);

          return {
            organization_id: organizationId,
            user_id: formData.userId,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            break_minutes: formData.breakMinutes,
            location_id: formData.locationId || null,
            department_id: formData.departmentId || null,
            position_id: formData.positionId || null,
            position: selectedPosition?.name || null,
            notes: formData.notes || null,
            color: positionColor,
            is_published: formData.isPublished,
            status: formData.isPublished ? "published" : "draft",
            published_at: formData.isPublished ? new Date().toISOString() : null,
          };
        });

        const { error } = await supabase.from("shifts").insert(shiftsToCreate);

        if (error) throw error;
        toast.success(
          shiftsToCreate.length > 1
            ? `${shiftsToCreate.length} shifts created successfully`
            : "Shift created successfully"
        );
      }

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(isEditing ? "Failed to update shift" : "Failed to create shift");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!shift) return;

    if (!confirm("Are you sure you want to delete this shift?")) return;

    setDeleting(true);

    try {
      const { error } = await supabase.from("shifts").delete().eq("id", shift.id);

      if (error) throw error;

      toast.success("Shift deleted successfully");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete shift");
    } finally {
      setDeleting(false);
    }
  };

  const getEmployeeName = (member: TeamMember) => {
    if (member.display_name) return member.display_name;
    return `${member.first_name} ${member.last_name}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Shift" : template ? `Create Shift from Template` : "Create Shift"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the shift details below."
              : template
              ? `Using template: ${template.name}`
              : "Fill in the details to create a new shift."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee */}
          <div className="flex items-center gap-4">
            <Label htmlFor="userId" className="w-24 text-right shrink-0">
              Employee
            </Label>
            <Select
              value={formData.userId}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, userId: value }))
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {getEmployeeName(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="flex items-center gap-4">
            <Label htmlFor="date" className="w-24 text-right shrink-0">
              Date
            </Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, date: e.target.value }))
              }
              className="flex-1"
              required
            />
          </div>

          {/* Start, End, Break on same row */}
          <div className="flex items-center gap-2">
            <Label className="w-24 text-right shrink-0">Time</Label>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground w-10">Start</span>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, startTime: e.target.value }))
                  }
                  className="w-28"
                  required
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground w-8">End</span>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, endTime: e.target.value }))
                  }
                  className="w-28"
                  required
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground w-10">Break</span>
                <Input
                  id="breakMinutes"
                  type="number"
                  min="0"
                  value={formData.breakMinutes}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      breakMinutes: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-16"
                />
              </div>
            </div>
          </div>

          {/* Repeat - Only show for new shifts */}
          {!isEditing && (
            <>
              <div className="flex items-center gap-4">
                <Label htmlFor="repeat" className="w-24 text-right shrink-0">
                  Repeat
                </Label>
                <Select
                  value={repeatType}
                  onValueChange={setRepeatType}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {repeatOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Day selector for "This week" and "Every X weeks" */}
              {repeatType !== "none" && (
                <div className="flex items-center gap-4">
                  <Label className="w-24 text-right shrink-0">Days</Label>
                  <div className="flex-1 grid grid-cols-7 gap-1">
                    {weekDays.map((day) => (
                      <Button
                        key={day.value}
                        type="button"
                        variant={selectedDays.includes(day.value) ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-9 px-0",
                          selectedDays.includes(day.value) && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => toggleDay(day.value)}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Starts and Ends for "Every X weeks" */}
              {repeatType !== "none" && repeatType !== "this_week" && (
                <div className="flex items-center gap-4">
                  <Label className="w-24 text-right shrink-0">Period</Label>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground w-12">Starts</span>
                      <Input
                        type="date"
                        value={formData.date}
                        disabled
                        className="w-36 bg-muted"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground w-10">Ends</span>
                      <Input
                        type="date"
                        value={repeatEndDate}
                        onChange={(e) => setRepeatEndDate(e.target.value)}
                        min={formData.date}
                        className="w-36"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Preview of shifts to be created */}
              {repeatType !== "none" && previewDates.length > 0 && (
                <div className="flex items-start gap-4">
                  <Label className="w-24 text-right shrink-0 pt-2">Preview</Label>
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-2">
                      {previewDates.length} shift{previewDates.length !== 1 ? "s" : ""} will be created:
                    </div>
                    <div className="max-h-24 overflow-y-auto bg-muted/50 rounded-md p-2 text-xs space-y-1">
                      {previewDates.slice(0, 10).map((date, index) => (
                        <div key={index} className="text-muted-foreground">
                          {format(date, "EEE, MMM d, yyyy")}
                        </div>
                      ))}
                      {previewDates.length > 10 && (
                        <div className="text-muted-foreground font-medium">
                          ...and {previewDates.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Location */}
          {locations.length > 0 && (
            <div className="flex items-center gap-4">
              <Label htmlFor="locationId" className="w-24 text-right shrink-0">
                Location
              </Label>
              <Select
                value={formData.locationId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, locationId: value }))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Department */}
          {departments.length > 0 && (
            <div className="flex items-center gap-4">
              <Label htmlFor="departmentId" className="w-24 text-right shrink-0">
                Department
              </Label>
              <Select
                value={formData.departmentId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, departmentId: value }))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Position */}
          {positions.length > 0 && (
            <div className="flex items-center gap-4">
              <Label htmlFor="positionId" className="w-24 text-right shrink-0">
                Position
              </Label>
              <Select
                value={formData.positionId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, positionId: value }))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {positions
                    .filter((p) => p.is_active)
                    .map((position) => (
                      <SelectItem key={position.id} value={position.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor:
                                position.color === "blue" ? "#3b82f6" :
                                position.color === "green" ? "#22c55e" :
                                position.color === "yellow" ? "#eab308" :
                                position.color === "red" ? "#ef4444" :
                                position.color === "purple" ? "#a855f7" :
                                position.color === "pink" ? "#ec4899" :
                                position.color === "orange" ? "#f97316" :
                                position.color === "cyan" ? "#06b6d4" :
                                position.color === "indigo" ? "#6366f1" :
                                position.color === "teal" ? "#14b8a6" :
                                "#3b82f6"
                            }}
                          />
                          {position.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="flex items-start gap-4">
            <Label htmlFor="notes" className="w-24 text-right shrink-0 pt-2">
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any notes..."
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={2}
              className="flex-1"
            />
          </div>

          {/* Publish */}
          <div className="flex items-center gap-4">
            <Label htmlFor="isPublished" className="w-24 text-right shrink-0">
              Publish
            </Label>
            <div className="flex-1 flex items-center gap-3">
              <Switch
                id="isPublished"
                checked={formData.isPublished}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isPublished: checked }))
                }
              />
              <span className="text-sm text-muted-foreground">
                Make visible to employee
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading || deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading || deleting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || deleting}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
