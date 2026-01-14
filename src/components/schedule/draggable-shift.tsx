"use client";

import { useState, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO, differenceInMinutes } from "date-fns";
import type { Database } from "@/types/database.types";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical } from "lucide-react";

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

interface DraggableShiftProps {
  shift: Shift;
  onClick?: (e: React.MouseEvent) => void;
  isDraggable?: boolean;
  isSelected?: boolean;
  onSelectChange?: (shiftId: string, selected: boolean) => void;
}

const shiftColors: Record<string, { published: string; draft: string }> = {
  blue: {
    published: "bg-blue-500 border !border-blue-600 text-white dark:bg-blue-600 dark:!border-blue-700",
    draft: "bg-white dark:bg-background border-2 border-dashed !border-blue-400 text-blue-600 dark:!border-blue-500 dark:text-blue-400",
  },
  green: {
    published: "bg-green-500 border !border-green-600 text-white dark:bg-green-600 dark:!border-green-700",
    draft: "bg-white dark:bg-background border-2 border-dashed !border-green-400 text-green-600 dark:!border-green-500 dark:text-green-400",
  },
  yellow: {
    published: "bg-yellow-500 border !border-yellow-600 text-white dark:bg-yellow-600 dark:!border-yellow-700",
    draft: "bg-white dark:bg-background border-2 border-dashed !border-yellow-400 text-yellow-600 dark:!border-yellow-500 dark:text-yellow-400",
  },
  red: {
    published: "bg-red-500 border !border-red-600 text-white dark:bg-red-600 dark:!border-red-700",
    draft: "bg-white dark:bg-background border-2 border-dashed !border-red-400 text-red-600 dark:!border-red-500 dark:text-red-400",
  },
  purple: {
    published: "bg-purple-500 border !border-purple-600 text-white dark:bg-purple-600 dark:!border-purple-700",
    draft: "bg-white dark:bg-background border-2 border-dashed !border-purple-400 text-purple-600 dark:!border-purple-500 dark:text-purple-400",
  },
  pink: {
    published: "bg-pink-500 border !border-pink-600 text-white dark:bg-pink-600 dark:!border-pink-700",
    draft: "bg-white dark:bg-background border-2 border-dashed !border-pink-400 text-pink-600 dark:!border-pink-500 dark:text-pink-400",
  },
  orange: {
    published: "bg-orange-500 border !border-orange-600 text-white dark:bg-orange-600 dark:!border-orange-700",
    draft: "bg-white dark:bg-background border-2 border-dashed !border-orange-400 text-orange-600 dark:!border-orange-500 dark:text-orange-400",
  },
  default: {
    published: "bg-slate-500 border !border-slate-600 text-white dark:bg-slate-600 dark:!border-slate-700",
    draft: "bg-white dark:bg-background border-2 border-dashed !border-slate-400 text-slate-600 dark:!border-slate-500 dark:text-slate-400",
  },
};

const getColorClass = (color: string | null, isPublished: boolean) => {
  const colorConfig = shiftColors[color || "default"] || shiftColors.default;
  return isPublished ? colorConfig.published : colorConfig.draft;
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}H`;
  }
  return `${hours}H${mins}M`;
};

export function DraggableShift({
  shift,
  onClick,
  isDraggable = true,
  isSelected = false,
  onSelectChange,
}: DraggableShiftProps) {
  const [mounted, setMounted] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shift.id,
    data: { shift },
    disabled: !isDraggable,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 1000 : undefined,
      }
    : undefined;

  const startTime = parseISO(shift.start_time);
  const endTime = parseISO(shift.end_time);
  const colorClass = getColorClass(shift.color, shift.is_published ?? false);
  const durationMinutes = differenceInMinutes(endTime, startTime);
  const durationText = formatDuration(durationMinutes);

  const getDisplayName = () => {
    if (!shift.profiles) return "Unassigned";
    if (shift.profiles.display_name) return shift.profiles.display_name;
    return `${shift.profiles.first_name} ${shift.profiles.last_name}`;
  };

  const isPublished = shift.is_published ?? false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-2 rounded-lg cursor-pointer transition-shadow",
        colorClass,
        isDragging && "opacity-50 shadow-lg",
        isDraggable && "hover:shadow-md"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {isDraggable && (
          <div className="flex flex-col items-center gap-1 -ml-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => {
                onSelectChange?.(shift.id, checked === true);
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "h-4 w-4",
                isPublished && "border-white bg-transparent data-[state=checked]:bg-white data-[state=checked]:border-white data-[state=checked]:text-slate-900"
              )}
            />
            <div
              {...(mounted ? attributes : {})}
              {...(mounted ? listeners : {})}
              className="cursor-grab active:cursor-grabbing p-1 opacity-50 hover:opacity-100"
            >
              <GripVertical className={cn("h-4 w-4", isPublished && "text-white")} />
            </div>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] opacity-80 whitespace-nowrap">
            {format(startTime, "h:mm")} - {format(endTime, "h:mm a")}・{durationText}
          </div>
          <div className="font-medium text-sm truncate">{getDisplayName()}</div>
          {shift.position && (
            <div className="text-xs opacity-70 truncate">{shift.position}</div>
          )}
        </div>
      </div>
    </div>
  );
}
