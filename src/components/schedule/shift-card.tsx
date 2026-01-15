"use client";

import { format, parseISO, differenceInMinutes } from "date-fns";
import type { Database } from "@/types/database.types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock } from "lucide-react";

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

interface ShiftCardProps {
  shift: Shift;
  compact?: boolean;
  expanded?: boolean;
  onClick?: (e: React.MouseEvent) => void;
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
  cyan: {
    published: "bg-cyan-500 border !border-cyan-600 text-white dark:bg-cyan-600 dark:!border-cyan-700",
    draft: "bg-white dark:bg-background border-2 border-dashed !border-cyan-400 text-cyan-600 dark:!border-cyan-500 dark:text-cyan-400",
  },
  indigo: {
    published: "bg-indigo-500 border !border-indigo-600 text-white dark:bg-indigo-600 dark:!border-indigo-700",
    draft: "bg-white dark:bg-background border-2 border-dashed !border-indigo-400 text-indigo-600 dark:!border-indigo-500 dark:text-indigo-400",
  },
  teal: {
    published: "bg-teal-500 border !border-teal-600 text-white dark:bg-teal-600 dark:!border-teal-700",
    draft: "bg-white dark:bg-background border-2 border-dashed !border-teal-400 text-teal-600 dark:!border-teal-500 dark:text-teal-400",
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

export function ShiftCard({ shift, compact, expanded, onClick }: ShiftCardProps) {
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

  if (compact) {
    return (
      <div
        className={cn(
          "text-xs p-1 rounded cursor-pointer truncate",
          colorClass
        )}
        onClick={onClick}
      >
        <span className="font-medium">{format(startTime, "h:mm a")}</span>
        {" - "}
        <span>{getDisplayName()}</span>
      </div>
    );
  }

  if (expanded) {
    return (
      <div
        className={cn(
          "p-3 rounded-lg cursor-pointer min-w-[200px]",
          colorClass
        )}
        onClick={onClick}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-sm opacity-80">
            <Clock className="h-3 w-3" />
            {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}・{durationText}
          </div>
          {shift.positions && (
            <div className="text-sm opacity-80 truncate">{shift.positions.name}</div>
          )}
          {shift.locations && (
            <div className="flex items-center gap-1 text-sm opacity-70">
              <MapPin className="h-3 w-3" />
              {shift.locations.name}
            </div>
          )}
          <div className="font-medium truncate">{getDisplayName()}</div>
        </div>
        {!shift.is_published && (
          <Badge variant="secondary" className="mt-2 text-xs">
            Draft
          </Badge>
        )}
      </div>
    );
  }

  // Default card (for week view)
  return (
    <div
      className={cn(
        "absolute left-0 right-0 mx-1 p-1 rounded text-xs cursor-pointer overflow-hidden",
        colorClass
      )}
      onClick={onClick}
    >
      <div className="opacity-80">
        {format(startTime, "h:mm")} - {format(endTime, "h:mm a")}・{durationText}
      </div>
      {shift.positions && (
        <div className="opacity-80 truncate">{shift.positions.name}</div>
      )}
      <div className="font-medium truncate">{getDisplayName()}</div>
    </div>
  );
}
