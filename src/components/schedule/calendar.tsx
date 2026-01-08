"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
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
} from "date-fns";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ShiftCard } from "./shift-card";
import { ShiftDialog } from "./shift-dialog";
import { DraggableShift } from "./draggable-shift";
import { DroppableDay } from "./droppable-day";
import { TemplatesManager } from "./templates-manager";

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

interface ScheduleCalendarProps {
  shifts: Shift[];
  teamMembers: TeamMember[];
  locations: Location[];
  departments: Department[];
  positions: Position[];
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

  const changeView = (newView: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", newView);
    router.push(`/schedule?${params.toString()}`);
  };

  const getShiftsForDay = (date: Date) => {
    return shifts.filter((shift) => {
      const shiftDate = parseISO(shift.start_time);
      return isSameDay(shiftDate, date);
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

    if (!shift || !targetDate) return;

    // Check if shift was dropped on a different day
    const originalDate = parseISO(shift.start_time);
    if (isSameDay(originalDate, targetDate)) return;

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
      const { error } = await supabase
        .from("shifts")
        .update({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        })
        .eq("id", shift.id);

      if (error) throw error;

      toast.success("Shift moved successfully");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to move shift");
    }
  };

  const getDateTitle = () => {
    if (view === "month") {
      return format(currentDate, "MMMM yyyy");
    } else if (view === "day") {
      return format(currentDate, "EEEE, MMMM d, yyyy");
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
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
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
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
            <h2 className="text-lg font-semibold ml-4">{getDateTitle()}</h2>
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

        {/* Calendar Content */}
        <div className="flex-1 overflow-auto">
          {view === "month" ? (
            <MonthView
              days={days}
              currentDate={currentDate}
              getShiftsForDay={getShiftsForDay}
              onAddShift={handleAddShift}
              onEditShift={handleEditShift}
              isAdmin={isAdmin}
            />
          ) : view === "day" ? (
            <DayView
              date={currentDate}
              hours={hours}
              shifts={getShiftsForDay(currentDate)}
              onAddShift={handleAddShift}
              onEditShift={handleEditShift}
              isAdmin={isAdmin}
            />
          ) : (
            <WeekView
              days={days}
              hours={hours}
              getShiftsForDay={getShiftsForDay}
              onAddShift={handleAddShift}
              onEditShift={handleEditShift}
              isAdmin={isAdmin}
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
      </div>
    </DndContext>
  );
}

// Month View Component with Drag & Drop
function MonthView({
  days,
  currentDate,
  getShiftsForDay,
  onAddShift,
  onEditShift,
  isAdmin,
}: {
  days: Date[];
  currentDate: Date;
  getShiftsForDay: (date: Date) => Shift[];
  onAddShift: (date: Date) => void;
  onEditShift: (shift: Shift) => void;
  isAdmin: boolean;
}) {
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

          return (
            <DroppableDay
              key={day.toISOString()}
              date={day}
              currentDate={currentDate}
              isAdmin={isAdmin}
              onAddShift={onAddShift}
            >
              {dayShifts.slice(0, 3).map((shift) => (
                <DraggableShift
                  key={shift.id}
                  shift={shift}
                  isDraggable={isAdmin}
                  onClick={() => onEditShift(shift)}
                />
              ))}
              {dayShifts.length > 3 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{dayShifts.length - 3} more
                </div>
              )}
            </DroppableDay>
          );
        })}
      </div>
    </div>
  );
}

// Week View Component
function WeekView({
  days,
  hours,
  getShiftsForDay,
  onAddShift,
  onEditShift,
  isAdmin,
}: {
  days: Date[];
  hours: number[];
  getShiftsForDay: (date: Date) => Shift[];
  onAddShift: (date: Date) => void;
  onEditShift: (shift: Shift) => void;
  isAdmin: boolean;
}) {
  return (
    <div className="h-full flex flex-col">
      {/* Day headers */}
      <div className="flex border-b sticky top-0 bg-background z-10">
        <div className="w-16 shrink-0" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="flex-1 p-2 text-center border-l"
          >
            <div className="text-sm text-muted-foreground">
              {format(day, "EEE")}
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

      {/* Time grid */}
      <div className="flex-1 overflow-auto">
        <div className="relative">
          {hours.map((hour) => (
            <div key={hour} className="flex h-16 border-b">
              <div className="w-16 shrink-0 pr-2 text-right text-xs text-muted-foreground -mt-2">
                {format(new Date().setHours(hour, 0), "h a")}
              </div>
              {days.map((day) => {
                const dayShifts = getShiftsForDay(day);
                const hourShifts = dayShifts.filter((shift) => {
                  const shiftHour = parseISO(shift.start_time).getHours();
                  return shiftHour === hour;
                });

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className="flex-1 border-l relative group"
                    onClick={() => isAdmin && onAddShift(day)}
                  >
                    {hourShifts.map((shift) => (
                      <ShiftCard
                        key={shift.id}
                        shift={shift}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditShift(shift);
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Day View Component
function DayView({
  date,
  hours,
  shifts,
  onAddShift,
  onEditShift,
  isAdmin,
}: {
  date: Date;
  hours: number[];
  shifts: Shift[];
  onAddShift: (date: Date) => void;
  onEditShift: (shift: Shift) => void;
  isAdmin: boolean;
}) {
  return (
    <div className="h-full overflow-auto">
      <div className="relative">
        {hours.map((hour) => {
          const hourShifts = shifts.filter((shift) => {
            const shiftHour = parseISO(shift.start_time).getHours();
            return shiftHour === hour;
          });

          return (
            <div key={hour} className="flex h-20 border-b">
              <div className="w-20 shrink-0 pr-2 text-right text-sm text-muted-foreground pt-1">
                {format(new Date().setHours(hour, 0), "h:mm a")}
              </div>
              <div
                className="flex-1 border-l relative group px-2"
                onClick={() => isAdmin && onAddShift(date)}
              >
                <div className="flex gap-2 flex-wrap">
                  {hourShifts.map((shift) => (
                    <ShiftCard
                      key={shift.id}
                      shift={shift}
                      expanded
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditShift(shift);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
