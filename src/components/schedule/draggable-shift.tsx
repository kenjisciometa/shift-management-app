"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import type { Database } from "@/types/database.types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
}

const shiftColors: Record<string, string> = {
  blue: "bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-100",
  green: "bg-green-100 border-green-300 text-green-900 dark:bg-green-900/30 dark:border-green-700 dark:text-green-100",
  yellow: "bg-yellow-100 border-yellow-300 text-yellow-900 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-100",
  red: "bg-red-100 border-red-300 text-red-900 dark:bg-red-900/30 dark:border-red-700 dark:text-red-100",
  purple: "bg-purple-100 border-purple-300 text-purple-900 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-100",
  pink: "bg-pink-100 border-pink-300 text-pink-900 dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-100",
  orange: "bg-orange-100 border-orange-300 text-orange-900 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-100",
  default: "bg-slate-100 border-slate-300 text-slate-900 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100",
};

export function DraggableShift({ shift, onClick, isDraggable = true }: DraggableShiftProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shift.id,
    data: { shift },
    disabled: !isDraggable,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 1000 : undefined,
      }
    : undefined;

  const startTime = parseISO(shift.start_time);
  const endTime = parseISO(shift.end_time);
  const colorClass = shiftColors[shift.color || "default"] || shiftColors.default;

  const getDisplayName = () => {
    if (!shift.profiles) return "Unassigned";
    if (shift.profiles.display_name) return shift.profiles.display_name;
    return `${shift.profiles.first_name} ${shift.profiles.last_name}`;
  };

  const getInitials = () => {
    if (!shift.profiles) return "?";
    return `${shift.profiles.first_name[0]}${shift.profiles.last_name[0]}`.toUpperCase();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-2 rounded-lg border cursor-pointer transition-shadow",
        colorClass,
        isDragging && "opacity-50 shadow-lg",
        isDraggable && "hover:shadow-md"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {isDraggable && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 opacity-50 hover:opacity-100"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={shift.profiles?.avatar_url || undefined} />
          <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{getDisplayName()}</div>
          <div className="text-xs opacity-80">
            {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
          </div>
          {shift.position && (
            <div className="text-xs opacity-70 truncate">{shift.position}</div>
          )}
        </div>
      </div>
    </div>
  );
}
