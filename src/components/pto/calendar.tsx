"use client";

import { useState, useMemo } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Palmtree } from "lucide-react";
import { cn } from "@/lib/utils";

interface PTORequestForCalendar {
  id: string;
  user_id: string;
  pto_type: string;
  start_date: string;
  end_date: string;
  total_days: number | null;
  status: string | null;
  reason: string | null;
  profiles?: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface PTOCalendarProps {
  requests: PTORequestForCalendar[];
  isTeamView?: boolean;
}

const ptoTypeColors: Record<string, string> = {
  vacation: "bg-blue-500",
  sick: "bg-red-500",
  personal: "bg-purple-500",
  bereavement: "bg-gray-500",
  jury_duty: "bg-orange-500",
  other: "bg-green-500",
};

const ptoTypeLabels: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick Leave",
  personal: "Personal",
  bereavement: "Bereavement",
  jury_duty: "Jury Duty",
  other: "Other",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200",
};

export function PTOCalendar({ requests, isTeamView = false }: PTOCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(
      direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1)
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const getRequestsForDay = (date: Date) => {
    return requests.filter((request) => {
      if (request.status === "rejected" || request.status === "cancelled") {
        return false;
      }
      const startDate = parseISO(request.start_date);
      const endDate = parseISO(request.end_date);
      return isWithinInterval(date, { start: startDate, end: endDate }) ||
        isSameDay(date, startDate) ||
        isSameDay(date, endDate);
    });
  };

  const getDisplayName = (profile?: PTORequestForCalendar["profiles"]) => {
    if (!profile) return "Unknown";
    if (profile.display_name) return profile.display_name;
    return `${profile.first_name} ${profile.last_name}`;
  };

  const getInitials = (profile?: PTORequestForCalendar["profiles"]) => {
    if (!profile) return "?";
    return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateMonth("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateMonth("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToToday}>
            Today
          </Button>
          <h2 className="text-lg font-semibold ml-4">
            {format(currentDate, "MMMM yyyy")}
          </h2>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-sm">
          {Object.entries(ptoTypeLabels).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1">
              <div className={cn("w-3 h-3 rounded-full", ptoTypeColors[type])} />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b sticky top-0 bg-background z-10">
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
        <div className="grid grid-cols-7 auto-rows-fr">
          {days.map((day) => {
            const dayRequests = getRequestsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[100px] p-1 border-b border-r",
                  !isCurrentMonth && "bg-muted/50"
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-center mb-1">
                  <span
                    className={cn(
                      "w-7 h-7 flex items-center justify-center text-sm rounded-full",
                      isToday(day) && "bg-primary text-primary-foreground font-semibold",
                      !isCurrentMonth && "text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                {/* PTO requests */}
                <div className="space-y-1">
                  {dayRequests.slice(0, 3).map((request) => (
                    <Popover key={request.id}>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "w-full text-left text-xs p-1 rounded truncate flex items-center gap-1",
                            ptoTypeColors[request.pto_type],
                            "text-white hover:opacity-80 transition-opacity"
                          )}
                        >
                          {isTeamView && request.profiles && (
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={request.profiles.avatar_url || undefined} />
                              <AvatarFallback className="text-[8px] bg-white/20">
                                {getInitials(request.profiles)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span className="truncate">
                            {isTeamView
                              ? getDisplayName(request.profiles)
                              : ptoTypeLabels[request.pto_type]}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-4">
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            {isTeamView && request.profiles && (
                              <Avatar>
                                <AvatarImage src={request.profiles.avatar_url || undefined} />
                                <AvatarFallback>{getInitials(request.profiles)}</AvatarFallback>
                              </Avatar>
                            )}
                            {!isTeamView && (
                              <div className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center",
                                ptoTypeColors[request.pto_type]
                              )}>
                                <Palmtree className="h-5 w-5 text-white" />
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="font-medium">
                                {isTeamView
                                  ? getDisplayName(request.profiles)
                                  : ptoTypeLabels[request.pto_type]}
                              </div>
                              {isTeamView && (
                                <div className="text-sm text-muted-foreground">
                                  {ptoTypeLabels[request.pto_type]}
                                </div>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn("capitalize", statusColors[request.status || "pending"])}
                            >
                              {request.status || "pending"}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <div className="text-muted-foreground">Start Date</div>
                              <div className="font-medium">
                                {format(parseISO(request.start_date), "MMM d, yyyy")}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">End Date</div>
                              <div className="font-medium">
                                {format(parseISO(request.end_date), "MMM d, yyyy")}
                              </div>
                            </div>
                          </div>

                          <div className="text-sm">
                            <div className="text-muted-foreground">Duration</div>
                            <div className="font-medium">
                              {Number(request.total_days).toFixed(1)} day
                              {Number(request.total_days) !== 1 ? "s" : ""}
                            </div>
                          </div>

                          {request.reason && (
                            <div className="text-sm">
                              <div className="text-muted-foreground">Reason</div>
                              <div>{request.reason}</div>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ))}
                  {dayRequests.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{dayRequests.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
