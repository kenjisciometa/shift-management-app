"use client";

import { useDroppable } from "@dnd-kit/core";
import { format, isToday, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface DroppableDayProps {
  date: Date;
  currentDate: Date;
  isAdmin: boolean;
  onAddShift: (date: Date) => void;
  children: React.ReactNode;
}

export function DroppableDay({
  date,
  currentDate,
  isAdmin,
  onAddShift,
  children,
}: DroppableDayProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: date.toISOString(),
    data: { date },
  });

  const isCurrentMonth = isSameMonth(date, currentDate);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-b border-r p-1 min-h-[100px] group transition-colors",
        !isCurrentMonth && "bg-muted/30",
        isOver && "bg-primary/10 border-primary"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "text-sm w-7 h-7 flex items-center justify-center rounded-full",
            isToday(date) && "bg-primary text-primary-foreground",
            !isCurrentMonth && "text-muted-foreground"
          )}
        >
          {format(date, "d")}
        </span>
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onAddShift(date)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
