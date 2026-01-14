"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CopyShiftsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedShiftCount: number;
  currentMonth: Date;
  onConfirm: (selectedDates: Date[]) => void;
}

export function CopyShiftsDialog({
  open,
  onOpenChange,
  selectedShiftCount,
  currentMonth,
  onConfirm,
}: CopyShiftsDialogProps) {
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const toggleDate = (date: Date) => {
    setSelectedDates((prev) => {
      const exists = prev.some((d) => isSameDay(d, date));
      if (exists) {
        return prev.filter((d) => !isSameDay(d, date));
      } else {
        return [...prev, date];
      }
    });
  };

  const isDateSelected = (date: Date) => {
    return selectedDates.some((d) => isSameDay(d, date));
  };

  const handleConfirm = () => {
    if (selectedDates.length > 0) {
      onConfirm(selectedDates);
      setSelectedDates([]);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedDates([]);
    }
    onOpenChange(open);
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setViewMonth((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Shifts</DialogTitle>
          <DialogDescription>
            Select the dates to copy {selectedShiftCount} shift{selectedShiftCount > 1 ? "s" : ""} to.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth("prev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium">{format(viewMonth, "MMMM yyyy")}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth("next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Week day headers */}
          <div className="grid grid-cols-7 mb-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const isCurrentMonth = isSameMonth(day, viewMonth);
              const isSelected = isDateSelected(day);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => toggleDate(day)}
                  className={cn(
                    "h-9 w-9 rounded-md text-sm transition-colors mx-auto flex items-center justify-center",
                    !isCurrentMonth && "text-muted-foreground/50",
                    isCurrentMonth && "hover:bg-muted",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                    isTodayDate && !isSelected && "border border-primary"
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          {/* Selected dates count */}
          {selectedDates.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground text-center">
              {selectedDates.length} date{selectedDates.length > 1 ? "s" : ""} selected
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedDates.length === 0}>
            Copy to {selectedDates.length || 0} date{selectedDates.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
