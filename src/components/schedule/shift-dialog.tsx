"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, setHours, setMinutes, addDays, addWeeks, addHours, startOfDay, isBefore, isAfter, isSameDay } from "date-fns";
import { apiPost, apiPut, apiDelete, apiGet } from "@/lib/api-client";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
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
  user_positions?: { position_id: string }[];
  user_locations?: { location_id: string }[];
};

type Location = { id: string; name: string };
type Department = { id: string; name: string };
type Position = Database["public"]["Tables"]["positions"]["Row"];
type ShiftTemplate = Database["public"]["Tables"]["shift_templates"]["Row"];

interface SchedulingPreferences {
  defaultShiftDuration: number; // in hours
  breakDuration: number; // in minutes
}

const defaultSchedulingPreferences: SchedulingPreferences = {
  defaultShiftDuration: 8,
  breakDuration: 30,
};

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
  schedulingPreferences?: SchedulingPreferences;
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
  schedulingPreferences,
}: ShiftDialogProps) {
  const router = useRouter();

  // Merge with defaults
  const schedPrefs = {
    ...defaultSchedulingPreferences,
    ...schedulingPreferences,
  };

  // Calculate end time based on start time and default duration
  const calculateEndTime = (startTime: string, durationHours: number): string => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const startDate = setMinutes(setHours(new Date(), hours), minutes);
    const endDate = addHours(startDate, durationHours);
    return format(endDate, "HH:mm");
  };

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [seriesShiftCount, setSeriesShiftCount] = useState(0);
  const [deleteSeriesCount, setDeleteSeriesCount] = useState(0);

  // Position assignment dialog state
  const [showAssignPositionDialog, setShowAssignPositionDialog] = useState(false);
  const [pendingPositionId, setPendingPositionId] = useState<string | null>(null);
  const [assigningPosition, setAssigningPosition] = useState(false);

  // Overlap warning dialog state
  const [showOverlapDialog, setShowOverlapDialog] = useState(false);
  const [overlapShifts, setOverlapShifts] = useState<Array<{ id: string; start_time: string; end_time: string; location?: { name: string } | null }>>([]);
  const [pendingPublishMode, setPendingPublishMode] = useState<"single" | "series">("single");

  const isEditing = !!shift;
  const isPartOfSeries = shift?.repeat_parent_id !== null && shift?.repeat_parent_id !== undefined;

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

  // Get selected team member
  const selectedTeamMember = teamMembers.find((m) => m.id === formData.userId);

  // Get available locations for the selected user
  const getAvailableLocations = (): Location[] => {
    if (!formData.userId) return locations;
    const member = teamMembers.find((m) => m.id === formData.userId);
    if (!member?.user_locations || member.user_locations.length === 0) {
      // If user has no assigned locations, show all locations
      return locations;
    }
    // Filter locations to only those assigned to the user
    const userLocationIds = member.user_locations.map((ul) => ul.location_id);
    return locations.filter((loc) => userLocationIds.includes(loc.id));
  };

  const availableLocations = getAvailableLocations();

  // Check if the selected team member has the selected position
  const userHasPosition = (userId: string, positionId: string): boolean => {
    const member = teamMembers.find((m) => m.id === userId);
    if (!member?.user_positions) return false;
    return member.user_positions.some((up) => up.position_id === positionId);
  };

  // Handle position selection with assignment check
  const handlePositionChange = (positionId: string) => {
    if (positionId && formData.userId && !userHasPosition(formData.userId, positionId)) {
      // User doesn't have this position - show confirmation dialog
      setPendingPositionId(positionId);
      setShowAssignPositionDialog(true);
    } else {
      // User has the position or no user selected - just set it
      setFormData((prev) => ({ ...prev, positionId }));
    }
  };

  // Assign position to user and set it in form
  const handleAssignPosition = async () => {
    if (!pendingPositionId || !formData.userId) return;

    setAssigningPosition(true);
    try {
      const response = await apiPost(`/api/team/members/${formData.userId}/positions`, {
        position_id: pendingPositionId,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to assign position");
      }

      // Update local team member data
      const memberIndex = teamMembers.findIndex((m) => m.id === formData.userId);
      if (memberIndex !== -1) {
        const member = teamMembers[memberIndex];
        if (!member.user_positions) {
          member.user_positions = [];
        }
        member.user_positions.push({ position_id: pendingPositionId });
      }

      // Set the position in form
      setFormData((prev) => ({ ...prev, positionId: pendingPositionId }));
      toast.success("Position assigned to employee");
    } catch (error) {
      console.error(error);
      toast.error("Failed to assign position");
    } finally {
      setAssigningPosition(false);
      setShowAssignPositionDialog(false);
      setPendingPositionId(null);
    }
  };

  // Cancel position assignment
  const handleCancelAssignPosition = () => {
    setShowAssignPositionDialog(false);
    setPendingPositionId(null);
  };

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
        const defaultStartTime = "09:00";
        const defaultEndTime = calculateEndTime(defaultStartTime, schedPrefs.defaultShiftDuration);
        setFormData({
          userId: "",
          date: format(date, "yyyy-MM-dd"),
          startTime: defaultStartTime,
          endTime: defaultEndTime,
          breakMinutes: schedPrefs.breakDuration,
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
  }, [open, shift, selectedDate, template, locations, schedPrefs.defaultShiftDuration, schedPrefs.breakDuration]);

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

  // Get the repeat group ID (either the shift's own repeat_parent_id or its own id if it's the parent)
  const getRepeatGroupId = () => {
    if (!shift) return null;
    return shift.repeat_parent_id || shift.id;
  };

  // Check for overlapping shifts for the same user
  const checkOverlappingShifts = async (
    userId: string,
    startTime: string,
    endTime: string,
    excludeShiftId?: string
  ): Promise<Array<{ id: string; start_time: string; end_time: string; location?: { name: string } | null }>> => {
    // Get the date from start_time for the query range
    const startDate = new Date(startTime);
    const dateStr = format(startDate, "yyyy-MM-dd");

    // Fetch shifts for the user on that day
    const response = await apiGet<Array<{
      id: string;
      start_time: string;
      end_time: string;
      location?: { name: string } | null;
    }>>(`/api/shifts?user_id=${userId}&start_date=${dateStr}&end_date=${dateStr}`);

    if (!response.success || !response.data) {
      return [];
    }

    const newStart = new Date(startTime).getTime();
    const newEnd = new Date(endTime).getTime();

    // Filter to find overlapping shifts (excluding the current shift if editing)
    return response.data.filter((s) => {
      if (excludeShiftId && s.id === excludeShiftId) return false;

      const existingStart = new Date(s.start_time).getTime();
      const existingEnd = new Date(s.end_time).getTime();

      // Check for overlap: new shift starts before existing ends AND new shift ends after existing starts
      return newStart < existingEnd && newEnd > existingStart;
    });
  };

  // Check if publish dialog should be shown
  const checkShowPublishDialog = async () => {
    if (!shift) return false;

    // Only show dialog if:
    // 1. We're editing an existing shift
    // 2. The shift is part of a series (has repeat_parent_id) OR is a parent (other shifts have this as repeat_parent_id)
    // 3. Publish is being turned ON (was false, now true)
    const wasPublished = shift.is_published || false;
    const willBePublished = formData.isPublished;

    if (!willBePublished || wasPublished) return false;

    const repeatGroupId = getRepeatGroupId();
    if (!repeatGroupId) return false;

    // Count unpublished shifts in the same series
    const response = await apiGet<{ count: number; shift_ids: string[] }>(
      `/api/shifts/series/${shift.id}?is_published=false&count_only=true`
    );

    if (!response.success || !response.data || response.data.count <= 1) return false;

    setSeriesShiftCount(response.data.count);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.userId) {
      toast.error("Please select an employee");
      return;
    }

    // Check if we need to show publish dialog
    if (isEditing && shift) {
      const shouldShowDialog = await checkShowPublishDialog();
      if (shouldShowDialog) {
        setShowPublishDialog(true);
        return;
      }
    }

    // Check for overlapping shifts
    await proceedWithOverlapCheck("single");
  };

  // Check for overlaps and show dialog if needed
  const proceedWithOverlapCheck = async (publishMode: "single" | "series") => {
    const [startHour, startMinute] = formData.startTime.split(":").map(Number);
    const [endHour, endMinute] = formData.endTime.split(":").map(Number);
    const repeatDates = generateRepeatDates();

    // Check each date for overlaps
    const allOverlaps: Array<{ id: string; start_time: string; end_time: string; location?: { name: string } | null }> = [];

    for (const date of repeatDates) {
      const startDateTime = setMinutes(setHours(date, startHour), startMinute);
      const endDateTime = setMinutes(setHours(date, endHour), endMinute);

      const overlaps = await checkOverlappingShifts(
        formData.userId,
        startDateTime.toISOString(),
        endDateTime.toISOString(),
        isEditing ? shift?.id : undefined
      );

      // Add only unique overlaps
      for (const overlap of overlaps) {
        if (!allOverlaps.some((o) => o.id === overlap.id)) {
          allOverlaps.push(overlap);
        }
      }
    }

    if (allOverlaps.length > 0) {
      setOverlapShifts(allOverlaps);
      setPendingPublishMode(publishMode);
      setShowOverlapDialog(true);
      return;
    }

    await executeSubmit(publishMode);
  };

  // Handle overlap dialog confirmation
  const handleOverlapDialogChoice = (proceed: boolean) => {
    setShowOverlapDialog(false);
    if (proceed) {
      executeSubmit(pendingPublishMode);
    }
  };

  const executeSubmit = async (publishMode: "single" | "series") => {
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
          user_id: formData.userId,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          break_minutes: formData.breakMinutes,
          location_id: formData.locationId || null,
          department_id: formData.departmentId || null,
          position_id: formData.positionId || null,
          notes: formData.notes || null,
          color: positionColor,
          is_published: formData.isPublished,
        };

        // Update single shift
        const response = await apiPut(`/api/shifts/${shift.id}`, shiftData);
        if (!response.success) {
          throw new Error(response.error || "Failed to update shift");
        }

        // If publishing entire series
        if (publishMode === "series" && formData.isPublished) {
          const seriesResponse = await apiPut(`/api/shifts/series/${shift.id}`, {
            is_published: true,
          });
          if (!seriesResponse.success) {
            throw new Error(seriesResponse.error || "Failed to publish series");
          }
          toast.success(`${seriesShiftCount} shifts published successfully`);
        } else {
          toast.success("Shift updated successfully");
        }
      } else {
        // Create new shift(s) with repeat
        const repeatDates = generateRepeatDates();

        if (repeatDates.length > 1) {
          // Create first shift to get its ID as repeat_parent_id
          const firstDate = repeatDates[0];
          const firstStartDateTime = setMinutes(setHours(firstDate, startHour), startMinute);
          const firstEndDateTime = setMinutes(setHours(firstDate, endHour), endMinute);

          const firstShiftData = {
            user_id: formData.userId,
            start_time: firstStartDateTime.toISOString(),
            end_time: firstEndDateTime.toISOString(),
            break_minutes: formData.breakMinutes,
            location_id: formData.locationId || null,
            department_id: formData.departmentId || null,
            position_id: formData.positionId || null,
            notes: formData.notes || null,
            color: positionColor,
            is_published: formData.isPublished,
          };

          const firstResponse = await apiPost<{ id: string }>("/api/shifts", firstShiftData);
          if (!firstResponse.success || !firstResponse.data) {
            throw new Error(firstResponse.error || "Failed to create shift");
          }

          // Create remaining shifts with repeat_parent_id linking to the first shift
          const parentId = firstResponse.data.id;
          for (const date of repeatDates.slice(1)) {
            const startDateTime = setMinutes(setHours(date, startHour), startMinute);
            const endDateTime = setMinutes(setHours(date, endHour), endMinute);

            await apiPost("/api/shifts", {
              user_id: formData.userId,
              start_time: startDateTime.toISOString(),
              end_time: endDateTime.toISOString(),
              break_minutes: formData.breakMinutes,
              location_id: formData.locationId || null,
              department_id: formData.departmentId || null,
              position_id: formData.positionId || null,
              notes: formData.notes || null,
              color: positionColor,
              is_published: formData.isPublished,
              repeat_parent_id: parentId,
            });
          }

          toast.success(`${repeatDates.length} shifts created successfully`);
        } else {
          // Single shift creation
          const singleDate = repeatDates[0];
          const startDateTime = setMinutes(setHours(singleDate, startHour), startMinute);
          const endDateTime = setMinutes(setHours(singleDate, endHour), endMinute);

          const shiftData = {
            user_id: formData.userId,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            break_minutes: formData.breakMinutes,
            location_id: formData.locationId || null,
            department_id: formData.departmentId || null,
            position_id: formData.positionId || null,
            notes: formData.notes || null,
            color: positionColor,
            is_published: formData.isPublished,
          };

          const response = await apiPost("/api/shifts", shiftData);
          if (!response.success) {
            throw new Error(response.error || "Failed to create shift");
          }
          toast.success("Shift created successfully");
        }
      }

      onOpenChange(false);
      router.refresh();
    } catch (error: any) {
      console.error("Shift error:", error?.message || error?.code || error);
      toast.error(error?.message || (isEditing ? "Failed to update shift" : "Failed to create shift"));
    } finally {
      setLoading(false);
    }
  };

  const handlePublishDialogChoice = async (choice: "single" | "series" | "cancel") => {
    setShowPublishDialog(false);
    if (choice === "cancel") return;
    // Check for overlaps before proceeding
    await proceedWithOverlapCheck(choice);
  };

  const handleDelete = async () => {
    if (!shift) return;

    // Check if shift is part of a series and count shifts
    const repeatGroupId = getRepeatGroupId();
    if (repeatGroupId) {
      const response = await apiGet<{ count: number; shift_ids: string[] }>(
        `/api/shifts/series/${shift.id}?count_only=true`
      );

      if (response.success && response.data && response.data.count > 1) {
        setDeleteSeriesCount(response.data.count);
      } else {
        setDeleteSeriesCount(0);
      }
    } else {
      setDeleteSeriesCount(0);
    }

    setShowDeleteDialog(true);
  };

  const executeDelete = async (mode: "single" | "series") => {
    if (!shift) return;

    setDeleting(true);
    setShowDeleteDialog(false);

    try {
      if (mode === "series" && deleteSeriesCount > 1) {
        const response = await apiDelete(`/api/shifts/series/${shift.id}`);
        if (!response.success) {
          throw new Error(response.error || "Failed to delete series");
        }
        toast.success(`${deleteSeriesCount} shifts deleted successfully`);
      } else {
        const response = await apiDelete(`/api/shifts/${shift.id}`);
        if (!response.success) {
          throw new Error(response.error || "Failed to delete shift");
        }
        toast.success("Shift deleted successfully");
      }

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
              onValueChange={(value) => {
                // Check if the currently selected location is valid for the new user
                const newMember = teamMembers.find((m) => m.id === value);
                let newLocationId = formData.locationId;

                if (newMember?.user_locations && newMember.user_locations.length > 0) {
                  const userLocationIds = newMember.user_locations.map((ul) => ul.location_id);
                  // Reset location if current selection is not available for this user
                  if (!userLocationIds.includes(formData.locationId)) {
                    // Auto-select first available location or clear
                    newLocationId = userLocationIds[0] || "";
                  }
                }

                setFormData((prev) => ({ ...prev, userId: value, locationId: newLocationId }));
              }}
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
                  onChange={(e) => {
                    const newStartTime = e.target.value;
                    // Auto-update end time based on default duration (only for new shifts)
                    if (!isEditing && newStartTime) {
                      const newEndTime = calculateEndTime(newStartTime, schedPrefs.defaultShiftDuration);
                      setFormData((prev) => ({
                        ...prev,
                        startTime: newStartTime,
                        endTime: newEndTime,
                      }));
                    } else {
                      setFormData((prev) => ({ ...prev, startTime: newStartTime }));
                    }
                  }}
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
                <Select
                  value={formData.breakMinutes.toString()}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      breakMinutes: parseInt(value),
                    }))
                  }
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 25 }, (_, i) => i * 5).map((minutes) => (
                      <SelectItem key={minutes} value={minutes.toString()}>
                        {minutes === 0 ? "No break" : `${minutes} min`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          {availableLocations.length > 0 && (
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
                  {availableLocations.map((location) => (
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
                onValueChange={handlePositionChange}
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

      {/* Publish Series Confirmation Dialog */}
      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Shifts</AlertDialogTitle>
            <AlertDialogDescription>
              This shift is part of a recurring series. Would you like to publish all {seriesShiftCount} unpublished shifts in this series, or just this one?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => handlePublishDialogChoice("cancel")}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handlePublishDialogChoice("single")}
            >
              This shift only
            </Button>
            <AlertDialogAction onClick={() => handlePublishDialogChoice("series")}>
              Publish all ({seriesShiftCount})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <Trash2 className="h-7 w-7 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl">
              Delete Shift{deleteSeriesCount > 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {deleteSeriesCount > 1 ? (
                <>
                  This shift is part of a recurring series ({deleteSeriesCount} shifts).
                  <br />
                  Would you like to delete all shifts in this series or just this one?
                </>
              ) : (
                "Are you sure you want to delete this shift? This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-center gap-2 mt-4">
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>
            {deleteSeriesCount > 1 ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => executeDelete("single")}
                  className="border-destructive text-destructive hover:bg-destructive/10"
                >
                  This shift only
                </Button>
                <AlertDialogAction
                  onClick={() => executeDelete("series")}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete all ({deleteSeriesCount})
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={() => executeDelete("single")}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Position Assignment Confirmation Dialog */}
      <AlertDialog open={showAssignPositionDialog} onOpenChange={setShowAssignPositionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign Position</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTeamMember && pendingPositionId && (
                <>
                  <strong>{selectedTeamMember.display_name || `${selectedTeamMember.first_name} ${selectedTeamMember.last_name}`}</strong>
                  {" "}does not have the{" "}
                  <strong>{positions.find(p => p.id === pendingPositionId)?.name}</strong>
                  {" "}position assigned.
                  <br /><br />
                  Would you like to assign this position to them?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelAssignPosition} disabled={assigningPosition}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAssignPosition} disabled={assigningPosition}>
              {assigningPosition && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign Position
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Overlap Warning Dialog */}
      <AlertDialog open={showOverlapDialog} onOpenChange={setShowOverlapDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100">
              <AlertTriangle className="h-7 w-7 text-yellow-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl">
              Overlapping Shifts
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              <span className="font-medium text-foreground">
                {selectedTeamMember?.display_name ||
                 (selectedTeamMember ? `${selectedTeamMember.first_name} ${selectedTeamMember.last_name}` : "This employee")}
              </span>
              {" "}already has {overlapShifts.length === 1 ? "a shift" : "shifts"} during this time:
              <div className="mt-3 max-h-32 overflow-y-auto bg-muted/50 rounded-md p-2 text-left text-sm">
                {overlapShifts.map((s, idx) => (
                  <div key={s.id} className={cn("py-1", idx > 0 && "border-t border-muted")}>
                    <span className="font-medium">
                      {format(parseISO(s.start_time), "MMM d")}
                    </span>
                    {" "}
                    {format(parseISO(s.start_time), "HH:mm")} - {format(parseISO(s.end_time), "HH:mm")}
                    {s.location?.name && (
                      <span className="text-muted-foreground"> @ {s.location.name}</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3">Do you want to create this shift anyway?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-center gap-2 mt-4">
            <AlertDialogCancel onClick={() => handleOverlapDialogChoice(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleOverlapDialogChoice(true)}
              className="bg-yellow-600 text-white hover:bg-yellow-700"
            >
              Create Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
