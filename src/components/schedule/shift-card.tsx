"use client";

import { format, parseISO } from "date-fns";
import type { Database } from "@/types/database.types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
};

interface ShiftCardProps {
  shift: Shift;
  compact?: boolean;
  expanded?: boolean;
  onClick?: (e: React.MouseEvent) => void;
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

export function ShiftCard({ shift, compact, expanded, onClick }: ShiftCardProps) {
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

  if (compact) {
    return (
      <div
        className={cn(
          "text-xs p-1 rounded border cursor-pointer truncate",
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
          "p-3 rounded-lg border cursor-pointer min-w-[200px]",
          colorClass
        )}
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={shift.profiles?.avatar_url || undefined} />
            <AvatarFallback>{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{getDisplayName()}</div>
            <div className="flex items-center gap-1 text-sm opacity-80">
              <Clock className="h-3 w-3" />
              {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
            </div>
            {shift.locations && (
              <div className="flex items-center gap-1 text-sm opacity-70">
                <MapPin className="h-3 w-3" />
                {shift.locations.name}
              </div>
            )}
            {shift.position && (
              <Badge variant="outline" className="mt-1 text-xs">
                {shift.position}
              </Badge>
            )}
          </div>
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
        "absolute left-0 right-0 mx-1 p-1 rounded border text-xs cursor-pointer overflow-hidden",
        colorClass
      )}
      onClick={onClick}
    >
      <div className="font-medium truncate">{getDisplayName()}</div>
      <div className="opacity-80">
        {format(startTime, "h:mm")} - {format(endTime, "h:mm a")}
      </div>
    </div>
  );
}
