"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  setHours,
  setMinutes,
  isWithinInterval,
} from "date-fns";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, ChevronDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ShiftCard } from "./shift-card";
import { ShiftDialog } from "./shift-dialog";
import { DraggableShift } from "./draggable-shift";
import { DroppableDay } from "./droppable-day";
import { TemplatesManager } from "./templates-manager";
import { ScheduleFilters } from "./schedule-filters";
import { CopyShiftsDialog } from "./copy-shifts-dialog";
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

type ShiftTemplate = Database["public"]["Tables"]["shift_templates"]["Row"];

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
  positions: { id: string; name: string; color: string } | null;
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

type PTORequest = {
  id: string;
  user_id: string;
  pto_type: string;
  start_date: string;
  end_date: string;
  total_days: number | null;
  status: string | null;
  reason: string | null;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

interface ScheduleCalendarProps {
  shifts: Shift[];
  teamMembers: TeamMember[];
  locations: Location[];
  departments: Department[];
  positions: Position[];
  ptoRequests?: PTORequest[];
  currentDate: Date;
  view: "week" | "month" | "day";
  isAdmin: boolean;
  currentUserId: string;
  organizationId: string;
}

export function ScheduleCalendar({
  shifts,
  teamMembers,
  locations,
  departments,
  positions,
  ptoRequests = [],
  currentDate,
  view,
  isAdmin,
  currentUserId,
  organizationId,
}: ScheduleCalendarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ShiftTemplate | null>(null);

  // Filter states
  const [filterLocations, setFilterLocations] = useState<string[]>([]);
  const [filterPosition, setFilterPosition] = useState<string | null>(null);
  const [filterMember, setFilterMember] = useState<string | null>(null);
  const [filterEvent, setFilterEvent] = useState<string | null>(null);

  // Multi-select state
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);

  const clearFilters = () => {
    setFilterLocations([]);
    setFilterPosition(null);
    setFilterMember(null);
    setFilterEvent(null);
  };

  const handleShiftSelectChange = (shiftId: string, selected: boolean) => {
    setSelectedShiftIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(shiftId);
      } else {
        newSet.delete(shiftId);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedShiftIds(new Set());
  };

  const handlePublishSelected = async () => {
    if (selectedShiftIds.size === 0) return;
    try {
      const { error } = await supabase
        .from("shifts")
        .update({ is_published: true })
        .in("id", Array.from(selectedShiftIds));

      if (error) throw error;
      toast.success(`${selectedShiftIds.size} shifts published`);
      clearSelection();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to publish shifts");
    }
  };

  const handleCopySelected = () => {
    if (selectedShiftIds.size === 0) return;
    setCopyDialogOpen(true);
  };

  const handleCopyConfirm = async (targetDates: Date[]) => {
    if (selectedShiftIds.size === 0 || targetDates.length === 0) return;

    try {
      // Get the selected shifts data
      const selectedShiftsData = shifts.filter((shift) =>
        selectedShiftIds.has(shift.id)
      );

      // Create copies for each selected date
      const newShifts: Database["public"]["Tables"]["shifts"]["Insert"][] = [];

      for (const targetDate of targetDates) {
        for (const shift of selectedShiftsData) {
          const originalStart = parseISO(shift.start_time);
          const originalEnd = parseISO(shift.end_time);

          // Calculate new start and end times preserving the time of day
          const newStart = setMinutes(
            setHours(targetDate, originalStart.getHours()),
            originalStart.getMinutes()
          );
          const newEnd = setMinutes(
            setHours(targetDate, originalEnd.getHours()),
            originalEnd.getMinutes()
          );

          newShifts.push({
            organization_id: organizationId,
            user_id: shift.user_id,
            location_id: shift.location_id,
            department_id: shift.department_id,
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString(),
            position_id: shift.position_id,
            notes: shift.notes,
            color: shift.color,
            is_published: false, // Copied shifts are drafts by default
          });
        }
      }

      const { error } = await supabase.from("shifts").insert(newShifts);

      if (error) throw error;

      toast.success(
        `Copied ${selectedShiftsData.length} shift${selectedShiftsData.length > 1 ? "s" : ""} to ${targetDates.length} date${targetDates.length > 1 ? "s" : ""}`
      );
      setCopyDialogOpen(false);
      clearSelection();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to copy shifts");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedShiftIds.size === 0) return;
    try {
      const { error } = await supabase
        .from("shifts")
        .delete()
        .in("id", Array.from(selectedShiftIds));

      if (error) throw error;
      toast.success(`${selectedShiftIds.size} shifts deleted`);
      clearSelection();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete shifts");
    }
  };

  // Apply filters to shifts
  const filteredShifts = shifts.filter((shift) => {
    if (filterLocations.length > 0 && (!shift.location_id || !filterLocations.includes(shift.location_id))) return false;
    if (filterPosition && shift.position_id !== filterPosition) return false;
    if (filterMember && shift.user_id !== filterMember) return false;
    // Event filter can be expanded later for different event types
    return true;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const navigateDate = (direction: "prev" | "next") => {
    let newDate: Date;
    if (view === "month") {
      newDate = direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1);
    } else if (view === "day") {
      newDate = direction === "prev" ? subDays(currentDate, 1) : addDays(currentDate, 1);
    } else {
      newDate = direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", format(newDate, "yyyy-MM-dd"));
    router.push(`/schedule?${params.toString()}`);
  };

  const goToToday = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", format(new Date(), "yyyy-MM-dd"));
    router.push(`/schedule?${params.toString()}`);
  };

  const goToMonth = (year: number, month: number) => {
    const newDate = new Date(year, month, 1);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", format(newDate, "yyyy-MM-dd"));
    router.push(`/schedule?${params.toString()}`);
  };

  // Generate years for dropdown (5 years back and 5 years forward)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const changeView = (newView: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", newView);
    router.push(`/schedule?${params.toString()}`);
  };

  const getShiftsForDay = (date: Date) => {
    return filteredShifts.filter((shift) => {
      const shiftDate = parseISO(shift.start_time);
      return isSameDay(shiftDate, date);
    });
  };

  const getPTOForDay = (date: Date) => {
    return ptoRequests.filter((pto) => {
      const startDate = parseISO(pto.start_date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = parseISO(pto.end_date);
      endDate.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0);
      return isWithinInterval(checkDate, { start: startDate, end: endDate });
    });
  };

  const handleAddShift = (date?: Date) => {
    setSelectedShift(null);
    setSelectedDate(date || null);
    setSelectedTemplate(null);
    setDialogOpen(true);
  };

  const handleApplyTemplate = (template: ShiftTemplate) => {
    setSelectedShift(null);
    setSelectedDate(new Date());
    setSelectedTemplate(template);
    setDialogOpen(true);
  };

  const handleEditShift = (shift: Shift) => {
    setSelectedShift(shift);
    setSelectedDate(null);
    setDialogOpen(true);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const shift = event.active.data.current?.shift as Shift;
    setActiveShift(shift);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveShift(null);

    const { active, over } = event;
    if (!over || !isAdmin) return;

    const shift = active.data.current?.shift as Shift;
    const targetDate = over.data.current?.date as Date;
    const targetMemberId = over.data.current?.memberId as string | undefined;

    if (!shift || !targetDate) return;

    // Check if shift was dropped on a different day or different member
    const originalDate = parseISO(shift.start_time);
    const isSameDayDrop = isSameDay(originalDate, targetDate);
    const isSameMember = !targetMemberId || shift.user_id === targetMemberId;

    if (isSameDayDrop && isSameMember) return;

    // Calculate new start and end times
    const originalStart = parseISO(shift.start_time);
    const originalEnd = parseISO(shift.end_time);

    const newStart = setMinutes(
      setHours(targetDate, originalStart.getHours()),
      originalStart.getMinutes()
    );
    const newEnd = setMinutes(
      setHours(targetDate, originalEnd.getHours()),
      originalEnd.getMinutes()
    );

    try {
      const updateData: { start_time: string; end_time: string; user_id?: string } = {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      };

      // Update user_id if dropped on a different member (Week view)
      if (targetMemberId && shift.user_id !== targetMemberId) {
        updateData.user_id = targetMemberId;
      }

      const { error } = await supabase
        .from("shifts")
        .update(updateData)
        .eq("id", shift.id);

      if (error) throw error;

      toast.success("Shift moved successfully");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to move shift");
    }
  };

  const handleUpdateShiftTime = async (shiftId: string, newStartTime: Date, newEndTime: Date) => {
    try {
      const { error } = await supabase
        .from("shifts")
        .update({
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
        })
        .eq("id", shiftId);

      if (error) throw error;

      toast.success("Shift time updated successfully");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update shift time");
    }
  };

  const getDateTitle = () => {
    if (view === "month") {
      return format(currentDate, "MMMM yyyy");
    } else if (view === "day") {
      return format(currentDate, "EEEE, MMMM d, yyyy");
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      if (isSameMonth(weekStart, weekEnd)) {
        return `${format(weekStart, "MMMM d")} - ${format(weekEnd, "d, yyyy")}`;
      }
      return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
    }
  };

  const getDaysInView = () => {
    if (view === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } else if (view === "day") {
      return [currentDate];
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  };

  const days = getDaysInView();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToToday}>
              Today
            </Button>
            <div className="flex items-center ml-4">
              <h2 className="text-lg font-semibold">{getDateTitle()}</h2>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-1 h-8 w-8">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Go to</div>
                    <div className="flex gap-2">
                      <Select
                        value={String(currentDate.getMonth())}
                        onValueChange={(value) => goToMonth(currentDate.getFullYear(), parseInt(value))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {months.map((month, index) => (
                            <SelectItem key={month} value={String(index)}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={String(currentDate.getFullYear())}
                        onValueChange={(value) => goToMonth(parseInt(value), currentDate.getMonth())}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map((year) => (
                            <SelectItem key={year} value={String(year)}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={changeView}>
              <TabsList>
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </Tabs>

            {isAdmin && (
              <>
                <TemplatesManager
                  organizationId={organizationId}
                  onApplyTemplate={handleApplyTemplate}
                />
                <Button onClick={() => handleAddShift()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Shift
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <ScheduleFilters
          locations={locations}
          positions={positions}
          teamMembers={teamMembers}
          selectedLocations={filterLocations}
          selectedPosition={filterPosition}
          selectedMember={filterMember}
          selectedEvent={filterEvent}
          onLocationsChange={setFilterLocations}
          onPositionChange={setFilterPosition}
          onMemberChange={setFilterMember}
          onEventChange={setFilterEvent}
          onClearFilters={clearFilters}
          selectedShiftCount={selectedShiftIds.size}
          onPublishSelected={handlePublishSelected}
          onCopySelected={handleCopySelected}
          onDeleteSelected={handleDeleteSelected}
          onClearSelection={clearSelection}
        />

        {/* Calendar Content */}
        <div className="flex-1 overflow-auto">
          {view === "month" ? (
            <MonthView
              days={days}
              currentDate={currentDate}
              getShiftsForDay={getShiftsForDay}
              getPTOForDay={getPTOForDay}
              onAddShift={handleAddShift}
              onEditShift={handleEditShift}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              selectedShiftIds={selectedShiftIds}
              onSelectChange={handleShiftSelectChange}
            />
          ) : view === "day" ? (
            <DayView
              date={currentDate}
              shifts={filteredShifts.filter((shift) => isSameDay(parseISO(shift.start_time), currentDate))}
              teamMembers={teamMembers}
              onAddShift={handleAddShift}
              onEditShift={handleEditShift}
              onUpdateShiftTime={handleUpdateShiftTime}
              isAdmin={isAdmin}
              selectedShiftIds={selectedShiftIds}
              onSelectChange={handleShiftSelectChange}
            />
          ) : (
            <WeekView
              days={days}
              shifts={filteredShifts}
              teamMembers={teamMembers}
              onAddShift={handleAddShift}
              onEditShift={handleEditShift}
              isAdmin={isAdmin}
              selectedShiftIds={selectedShiftIds}
              onSelectChange={handleShiftSelectChange}
            />
          )}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeShift && (
            <div className="opacity-80">
              <DraggableShift shift={activeShift} isDraggable={false} />
            </div>
          )}
        </DragOverlay>

        {/* Shift Dialog */}
        <ShiftDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setSelectedTemplate(null);
          }}
          shift={selectedShift}
          selectedDate={selectedDate}
          template={selectedTemplate}
          teamMembers={teamMembers}
          locations={locations}
          departments={departments}
          positions={positions}
          organizationId={organizationId}
          isAdmin={isAdmin}
        />

        {/* Copy Shifts Dialog */}
        <CopyShiftsDialog
          open={copyDialogOpen}
          onOpenChange={setCopyDialogOpen}
          selectedShiftCount={selectedShiftIds.size}
          currentMonth={currentDate}
          onConfirm={handleCopyConfirm}
        />
      </div>
    </DndContext>
  );
}

// Month View Component with Drag & Drop
function MonthView({
  days,
  currentDate,
  getShiftsForDay,
  getPTOForDay,
  onAddShift,
  onEditShift,
  isAdmin,
  currentUserId,
  selectedShiftIds,
  onSelectChange,
}: {
  days: Date[];
  currentDate: Date;
  getShiftsForDay: (date: Date) => Shift[];
  getPTOForDay: (date: Date) => PTORequest[];
  onAddShift: (date: Date) => void;
  onEditShift: (shift: Shift) => void;
  isAdmin: boolean;
  currentUserId: string;
  selectedShiftIds: Set<string>;
  onSelectChange: (shiftId: string, selected: boolean) => void;
}) {
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const ptoTypeColors: Record<string, string> = {
    vacation: "bg-blue-500",
    sick: "bg-red-500",
    personal: "bg-purple-500",
    bereavement: "bg-gray-500",
    jury_duty: "bg-orange-500",
    other: "bg-green-500",
  };

  return (
    <div className="h-full flex flex-col">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {days.map((day) => {
          const dayShifts = getShiftsForDay(day);
          const dayPTO = getPTOForDay(day);
          const userPTO = dayPTO.filter((pto) => pto.user_id === currentUserId);
          const otherPTO = dayPTO.filter((pto) => pto.user_id !== currentUserId);

          return (
            <DroppableDay
              key={day.toISOString()}
              date={day}
              currentDate={currentDate}
              isAdmin={isAdmin}
              onAddShift={onAddShift}
            >
              {/* User's PTO indicators */}
              {userPTO.length > 0 && (
                <div className="flex gap-1 mb-1">
                  {userPTO.map((pto) => (
                    <div
                      key={pto.id}
                      className={cn(
                        "h-1.5 flex-1 rounded-full",
                        ptoTypeColors[pto.pto_type] || "bg-gray-500",
                        pto.status === "pending" && "opacity-60"
                      )}
                      title={`${pto.pto_type} - ${pto.status}`}
                    />
                  ))}
                </div>
              )}
              {/* Shifts */}
              {dayShifts.slice(0, 3).map((shift) => (
                <DraggableShift
                  key={shift.id}
                  shift={shift}
                  isDraggable={isAdmin}
                  onClick={() => onEditShift(shift)}
                  isSelected={selectedShiftIds.has(shift.id)}
                  onSelectChange={onSelectChange}
                />
              ))}
              {dayShifts.length > 3 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{dayShifts.length - 3} more shifts
                </div>
              )}
              {/* Other team members' PTO (admin view) */}
              {isAdmin && otherPTO.length > 0 && (
                <div className="mt-1 pt-1 border-t border-dashed">
                  <div className="text-xs text-muted-foreground mb-1">PTO:</div>
                  {otherPTO.slice(0, 2).map((pto) => (
                    <div
                      key={pto.id}
                      className={cn(
                        "text-xs px-1 py-0.5 rounded mb-0.5 truncate",
                        ptoTypeColors[pto.pto_type] || "bg-gray-500",
                        "text-white"
                      )}
                      title={`${pto.profiles?.display_name || pto.profiles?.first_name}: ${pto.pto_type}`}
                    >
                      {pto.profiles?.display_name || `${pto.profiles?.first_name} ${pto.profiles?.last_name}`}
                    </div>
                  ))}
                  {otherPTO.length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{otherPTO.length - 2} more
                    </div>
                  )}
                </div>
              )}
            </DroppableDay>
          );
        })}
      </div>
    </div>
  );
}

// Droppable cell for Week View
function DroppableWeekCell({
  date,
  memberId,
  isAdmin,
  onAddShift,
  children,
}: {
  date: Date;
  memberId: string;
  isAdmin: boolean;
  onAddShift: (date: Date) => void;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${memberId}-${date.toISOString()}`,
    data: { date, memberId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-[120px] p-1 border-r last:border-r-0 space-y-1 transition-colors",
        isOver && "bg-primary/10"
      )}
      onClick={() => isAdmin && onAddShift(date)}
    >
      {children}
    </div>
  );
}

// Week View Component - Member rows with day columns (Mon-Sun)
function WeekView({
  days,
  shifts,
  teamMembers,
  onAddShift,
  onEditShift,
  isAdmin,
  selectedShiftIds,
  onSelectChange,
}: {
  days: Date[];
  shifts: Shift[];
  teamMembers: TeamMember[];
  onAddShift: (date: Date) => void;
  onEditShift: (shift: Shift) => void;
  isAdmin: boolean;
  selectedShiftIds: Set<string>;
  onSelectChange: (shiftId: string, selected: boolean) => void;
}) {
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const getShiftsForMemberAndDay = (memberId: string, date: Date) => {
    return shifts.filter((shift) => {
      const shiftDate = parseISO(shift.start_time);
      return shift.user_id === memberId && isSameDay(shiftDate, date);
    });
  };

  const getDisplayName = (member: TeamMember) => {
    if (member.display_name) return member.display_name;
    return `${member.first_name} ${member.last_name}`;
  };

  return (
    <div className="h-full overflow-auto">
      <div className="min-w-fit">
        {/* Day headers */}
        <div className="flex border-b sticky top-0 bg-background z-10">
          <div className="w-40 shrink-0 p-2 text-sm font-medium text-muted-foreground border-r">
            Member
          </div>
          <div className="flex flex-1">
            {days.map((day, index) => (
              <div
                key={day.toISOString()}
                className="flex-1 min-w-[120px] p-2 text-center border-r last:border-r-0"
              >
                <div className="text-sm text-muted-foreground">
                  {weekDays[index]}
                </div>
                <div
                  className={cn(
                    "text-lg font-semibold w-8 h-8 mx-auto flex items-center justify-center rounded-full",
                    isToday(day) && "bg-primary text-primary-foreground"
                  )}
                >
                  {format(day, "d")}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Member rows */}
        {teamMembers.map((member) => (
          <div key={member.id} className="flex border-b min-h-[80px]">
            <div className="w-40 shrink-0 p-2 border-r bg-muted/30">
              <div className="font-medium text-sm truncate">
                {getDisplayName(member)}
              </div>
              {member.role && (
                <div className="text-xs text-muted-foreground truncate">
                  {member.role}
                </div>
              )}
            </div>
            <div className="flex flex-1">
              {days.map((day) => {
                const memberDayShifts = getShiftsForMemberAndDay(member.id, day);
                return (
                  <DroppableWeekCell
                    key={`${member.id}-${day.toISOString()}`}
                    date={day}
                    memberId={member.id}
                    isAdmin={isAdmin}
                    onAddShift={onAddShift}
                  >
                    {memberDayShifts.map((shift) => (
                      <DraggableShift
                        key={shift.id}
                        shift={shift}
                        isDraggable={isAdmin}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditShift(shift);
                        }}
                        isSelected={selectedShiftIds.has(shift.id)}
                        onSelectChange={onSelectChange}
                      />
                    ))}
                  </DroppableWeekCell>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Day View Component - Member rows with time-based horizontal bars (6AM-12AM)
function DayView({
  date,
  shifts,
  teamMembers,
  onAddShift,
  onEditShift,
  onUpdateShiftTime,
  isAdmin,
  selectedShiftIds,
  onSelectChange,
}: {
  date: Date;
  shifts: Shift[];
  teamMembers: TeamMember[];
  onAddShift: (date: Date) => void;
  onEditShift: (shift: Shift) => void;
  onUpdateShiftTime: (shiftId: string, newStartTime: Date, newEndTime: Date) => void;
  isAdmin: boolean;
  selectedShiftIds: Set<string>;
  onSelectChange: (shiftId: string, selected: boolean) => void;
}) {
  // Hours from 6AM to 12AM (midnight) = 6 to 24
  const hours = Array.from({ length: 19 }, (_, i) => i + 6); // 6, 7, 8, ... 24
  const totalHours = 18; // 6AM to 12AM

  // Drag state
  const [draggingShift, setDraggingShift] = useState<Shift | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0); // in hours
  const [pendingUpdate, setPendingUpdate] = useState<{
    shift: Shift;
    newStartTime: Date;
    newEndTime: Date;
    type: 'move' | 'resize-start' | 'resize-end';
  } | null>(null);

  // Resize state
  const [resizingShift, setResizingShift] = useState<Shift | null>(null);
  const [resizeEdge, setResizeEdge] = useState<'start' | 'end' | null>(null);
  const [resizeOffset, setResizeOffset] = useState<number>(0); // in hours

  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const justFinishedDragging = useRef(false);

  const getShiftsForMember = (memberId: string) => {
    return shifts.filter((shift) => shift.user_id === memberId);
  };

  const getDisplayName = (member: TeamMember) => {
    if (member.display_name) return member.display_name;
    return `${member.first_name} ${member.last_name}`;
  };

  const getShiftPosition = useCallback((
    shift: Shift,
    offsetHours: number = 0,
    startOffset: number = 0,
    endOffset: number = 0
  ) => {
    const startTime = parseISO(shift.start_time);
    const endTime = parseISO(shift.end_time);

    let startHour = startTime.getHours() + startTime.getMinutes() / 60 + offsetHours + startOffset;
    let endHour = endTime.getHours() + endTime.getMinutes() / 60 + offsetHours + endOffset;

    // Handle overnight shifts
    if (endHour < startHour) {
      endHour = 24;
    }

    // Clamp to visible range (6AM - 12AM)
    startHour = Math.max(6, Math.min(24, startHour));
    endHour = Math.max(6, Math.min(24, endHour));

    const left = ((startHour - 6) / totalHours) * 100;
    const width = ((endHour - startHour) / totalHours) * 100;

    return { left: `${left}%`, width: `${Math.max(width, 2)}%` };
  }, []);

  const getColorClass = (color: string | null, isPublished: boolean) => {
    const colors: Record<string, { published: string; draft: string }> = {
      blue: {
        published: "bg-blue-500 border-blue-600 text-white",
        draft: "bg-white border-2 border-dashed border-blue-400 text-blue-600",
      },
      green: {
        published: "bg-green-500 border-green-600 text-white",
        draft: "bg-white border-2 border-dashed border-green-400 text-green-600",
      },
      yellow: {
        published: "bg-yellow-500 border-yellow-600 text-white",
        draft: "bg-white border-2 border-dashed border-yellow-400 text-yellow-600",
      },
      red: {
        published: "bg-red-500 border-red-600 text-white",
        draft: "bg-white border-2 border-dashed border-red-400 text-red-600",
      },
      purple: {
        published: "bg-purple-500 border-purple-600 text-white",
        draft: "bg-white border-2 border-dashed border-purple-400 text-purple-600",
      },
      pink: {
        published: "bg-pink-500 border-pink-600 text-white",
        draft: "bg-white border-2 border-dashed border-pink-400 text-pink-600",
      },
      orange: {
        published: "bg-orange-500 border-orange-600 text-white",
        draft: "bg-white border-2 border-dashed border-orange-400 text-orange-600",
      },
      cyan: {
        published: "bg-cyan-500 border-cyan-600 text-white",
        draft: "bg-white border-2 border-dashed border-cyan-400 text-cyan-600",
      },
      indigo: {
        published: "bg-indigo-500 border-indigo-600 text-white",
        draft: "bg-white border-2 border-dashed border-indigo-400 text-indigo-600",
      },
      teal: {
        published: "bg-teal-500 border-teal-600 text-white",
        draft: "bg-white border-2 border-dashed border-teal-400 text-teal-600",
      },
      default: {
        published: "bg-slate-500 border-slate-600 text-white",
        draft: "bg-white border-2 border-dashed border-slate-400 text-slate-600",
      },
    };
    const colorConfig = colors[color || "default"] || colors.default;
    return isPublished ? colorConfig.published : colorConfig.draft;
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, shift: Shift, memberId: string) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.stopPropagation();

    const container = containerRefs.current.get(memberId);
    if (!container) return;

    setDraggingShift(shift);
    setDragOffset(0);

    let currentDragOffset = 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;
      const startX = e.clientX;
      const currentX = moveEvent.clientX;
      const deltaX = currentX - startX;
      const deltaHours = (deltaX / containerWidth) * totalHours;

      // Round to nearest 15 minutes (0.25 hours)
      const roundedDeltaHours = Math.round(deltaHours * 4) / 4;
      currentDragOffset = roundedDeltaHours;
      setDragOffset(roundedDeltaHours);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      // Set flag to prevent click from opening Create Shift
      justFinishedDragging.current = true;
      setTimeout(() => {
        justFinishedDragging.current = false;
      }, 100);

      if (currentDragOffset !== 0) {
        const originalStart = parseISO(shift.start_time);
        const originalEnd = parseISO(shift.end_time);

        const newStartTime = new Date(originalStart.getTime() + currentDragOffset * 60 * 60 * 1000);
        const newEndTime = new Date(originalEnd.getTime() + currentDragOffset * 60 * 60 * 1000);

        // Check bounds (6AM - 12AM)
        const newStartHour = newStartTime.getHours() + newStartTime.getMinutes() / 60;
        const newEndHour = newEndTime.getHours() + newEndTime.getMinutes() / 60;

        if (newStartHour >= 6 && newEndHour <= 24) {
          setPendingUpdate({
            shift,
            newStartTime,
            newEndTime,
            type: 'move',
          });
        }
      }

      setDraggingShift(null);
      setDragOffset(0);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [isAdmin]);

  // Resize handler for shift edges
  const handleResizeMouseDown = useCallback((
    e: React.MouseEvent,
    shift: Shift,
    memberId: string,
    edge: 'start' | 'end'
  ) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.stopPropagation();

    const container = containerRefs.current.get(memberId);
    if (!container) return;

    setResizingShift(shift);
    setResizeEdge(edge);
    setResizeOffset(0);

    let currentResizeOffset = 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;
      const startX = e.clientX;
      const currentX = moveEvent.clientX;
      const deltaX = currentX - startX;
      const deltaHours = (deltaX / containerWidth) * totalHours;

      // Round to nearest 15 minutes (0.25 hours)
      const roundedDeltaHours = Math.round(deltaHours * 4) / 4;

      // Get current shift times
      const startTime = parseISO(shift.start_time);
      const endTime = parseISO(shift.end_time);
      const startHour = startTime.getHours() + startTime.getMinutes() / 60;
      const endHour = endTime.getHours() + endTime.getMinutes() / 60;
      const duration = endHour - startHour;

      // Apply constraints
      if (edge === 'start') {
        // Moving start: ensure new start >= 6 and new start < end (min 15min shift)
        const newStartHour = startHour + roundedDeltaHours;
        if (newStartHour >= 6 && newStartHour < endHour - 0.25) {
          currentResizeOffset = roundedDeltaHours;
          setResizeOffset(roundedDeltaHours);
        }
      } else {
        // Moving end: ensure new end <= 24 and new end > start (min 15min shift)
        const newEndHour = endHour + roundedDeltaHours;
        if (newEndHour <= 24 && newEndHour > startHour + 0.25) {
          currentResizeOffset = roundedDeltaHours;
          setResizeOffset(roundedDeltaHours);
        }
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      // Set flag to prevent click from opening Create Shift
      justFinishedDragging.current = true;
      setTimeout(() => {
        justFinishedDragging.current = false;
      }, 100);

      if (currentResizeOffset !== 0) {
        const originalStart = parseISO(shift.start_time);
        const originalEnd = parseISO(shift.end_time);

        let newStartTime = originalStart;
        let newEndTime = originalEnd;

        if (edge === 'start') {
          newStartTime = new Date(originalStart.getTime() + currentResizeOffset * 60 * 60 * 1000);
        } else {
          newEndTime = new Date(originalEnd.getTime() + currentResizeOffset * 60 * 60 * 1000);
        }

        setPendingUpdate({
          shift,
          newStartTime,
          newEndTime,
          type: edge === 'start' ? 'resize-start' : 'resize-end',
        });
      }

      setResizingShift(null);
      setResizeEdge(null);
      setResizeOffset(0);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [isAdmin]);

  const handleConfirmUpdate = () => {
    if (pendingUpdate) {
      onUpdateShiftTime(
        pendingUpdate.shift.id,
        pendingUpdate.newStartTime,
        pendingUpdate.newEndTime
      );
      setPendingUpdate(null);
    }
  };

  const handleCancelUpdate = () => {
    setPendingUpdate(null);
  };

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Time headers */}
        <div className="flex border-b sticky top-0 bg-background z-10">
          <div className="w-40 shrink-0 p-2 text-sm font-medium text-muted-foreground border-r">
            Member
          </div>
          <div className="flex-1 flex">
            {hours.map((hour) => (
              <div
                key={hour}
                className="flex-1 p-1 text-center text-xs text-muted-foreground border-r last:border-r-0"
              >
                {hour === 24 ? "12AM" : format(new Date().setHours(hour, 0), "ha")}
              </div>
            ))}
          </div>
        </div>

        {/* Member rows with time grid */}
        <div className="flex-1 overflow-auto">
          {teamMembers.map((member) => {
            const memberShifts = getShiftsForMember(member.id);
            return (
              <div key={member.id} className="flex border-b min-h-[60px]">
                <div className="w-40 shrink-0 p-2 border-r bg-muted/30">
                  <div className="font-medium text-sm truncate">
                    {getDisplayName(member)}
                  </div>
                  {member.role && (
                    <div className="text-xs text-muted-foreground truncate">
                      {member.role}
                    </div>
                  )}
                </div>
                <div
                  ref={(el) => {
                    if (el) containerRefs.current.set(member.id, el);
                  }}
                  className="flex-1 relative"
                  onClick={() => {
                    if (justFinishedDragging.current) return;
                    if (isAdmin) onAddShift(date);
                  }}
                >
                  {/* Hour grid lines */}
                  <div className="absolute inset-0 flex">
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="flex-1 border-r last:border-r-0 border-dashed border-muted"
                      />
                    ))}
                  </div>
                  {/* Shift bars */}
                  {memberShifts.map((shift) => {
                    const isDragging = draggingShift?.id === shift.id;
                    const isResizing = resizingShift?.id === shift.id;
                    const startTime = parseISO(shift.start_time);
                    const endTime = parseISO(shift.end_time);

                    // Calculate position with offsets
                    const startOffset = isResizing && resizeEdge === 'start' ? resizeOffset : 0;
                    const endOffset = isResizing && resizeEdge === 'end' ? resizeOffset : 0;
                    const position = getShiftPosition(
                      shift,
                      isDragging ? dragOffset : 0,
                      startOffset,
                      endOffset
                    );

                    // Calculate display times for dragging/resizing
                    let displayStartTime = startTime;
                    let displayEndTime = endTime;

                    if (isDragging) {
                      displayStartTime = new Date(startTime.getTime() + dragOffset * 60 * 60 * 1000);
                      displayEndTime = new Date(endTime.getTime() + dragOffset * 60 * 60 * 1000);
                    } else if (isResizing) {
                      if (resizeEdge === 'start') {
                        displayStartTime = new Date(startTime.getTime() + resizeOffset * 60 * 60 * 1000);
                      } else {
                        displayEndTime = new Date(endTime.getTime() + resizeOffset * 60 * 60 * 1000);
                      }
                    }

                    return (
                      <div
                        key={shift.id}
                        className={cn(
                          "absolute top-1 bottom-1 rounded flex items-center text-xs overflow-hidden border select-none group",
                          getColorClass(shift.color, shift.is_published ?? false),
                          selectedShiftIds.has(shift.id) && "ring-2 ring-primary",
                          (isDragging || isResizing) && "opacity-80 shadow-lg z-10"
                        )}
                        style={{ left: position.left, width: position.width }}
                      >
                        {/* Left resize handle */}
                        {isAdmin && (
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                            onMouseDown={(e) => handleResizeMouseDown(e, shift, member.id, 'start')}
                          />
                        )}

                        {/* Drag handle */}
                        {isAdmin && (
                          <div
                            className="flex items-center justify-center px-1 h-full cursor-grab active:cursor-grabbing hover:bg-black/10 shrink-0"
                            onMouseDown={(e) => handleMouseDown(e, shift, member.id)}
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                        )}
                        {/* Clickable content */}
                        <div
                          className="flex-1 truncate px-1 cursor-pointer min-w-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditShift(shift);
                          }}
                        >
                          <div className="opacity-80">
                            {format(displayStartTime, "h:mm")} - {format(displayEndTime, "h:mm a")}
                          </div>
                          {shift.positions && (
                            <div className="opacity-80 truncate">{shift.positions.name}</div>
                          )}
                          <div className="font-medium truncate">
                            {shift.profiles?.display_name || `${shift.profiles?.first_name} ${shift.profiles?.last_name}`}
                          </div>
                        </div>

                        {/* Right resize handle */}
                        {isAdmin && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                            onMouseDown={(e) => handleResizeMouseDown(e, shift, member.id, 'end')}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!pendingUpdate} onOpenChange={(open) => !open && handleCancelUpdate()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingUpdate?.type === 'move' ? 'Confirm Time Change' : 'Confirm Duration Change'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {pendingUpdate && (
                  <>
                    {pendingUpdate.type === 'move' ? (
                      <p>
                        Move shift from{" "}
                        <strong>
                          {format(parseISO(pendingUpdate.shift.start_time), "h:mm a")} -{" "}
                          {format(parseISO(pendingUpdate.shift.end_time), "h:mm a")}
                        </strong>{" "}
                        to{" "}
                        <strong>
                          {format(pendingUpdate.newStartTime, "h:mm a")} -{" "}
                          {format(pendingUpdate.newEndTime, "h:mm a")}
                        </strong>
                        ?
                      </p>
                    ) : (
                      <>
                        <p>
                          {pendingUpdate.type === 'resize-start' ? 'Change start time' : 'Change end time'} from{" "}
                          <strong>
                            {format(parseISO(pendingUpdate.shift.start_time), "h:mm a")} -{" "}
                            {format(parseISO(pendingUpdate.shift.end_time), "h:mm a")}
                          </strong>{" "}
                          to{" "}
                          <strong>
                            {format(pendingUpdate.newStartTime, "h:mm a")} -{" "}
                            {format(pendingUpdate.newEndTime, "h:mm a")}
                          </strong>
                          ?
                        </p>
                        <p className="mt-2 text-sm">
                          Duration:{" "}
                          {(() => {
                            const oldStart = parseISO(pendingUpdate.shift.start_time);
                            const oldEnd = parseISO(pendingUpdate.shift.end_time);
                            const oldDuration = (oldEnd.getTime() - oldStart.getTime()) / (1000 * 60 * 60);
                            const newDuration = (pendingUpdate.newEndTime.getTime() - pendingUpdate.newStartTime.getTime()) / (1000 * 60 * 60);
                            const formatDuration = (hours: number) => {
                              const h = Math.floor(hours);
                              const m = Math.round((hours - h) * 60);
                              return m > 0 ? `${h}h ${m}m` : `${h}h`;
                            };
                            return (
                              <>
                                <span className="line-through opacity-60">{formatDuration(oldDuration)}</span>
                                {" → "}
                                <strong>{formatDuration(newDuration)}</strong>
                              </>
                            );
                          })()}
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelUpdate}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpdate}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
