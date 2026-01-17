"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import type { Database } from "@/types/database.types";
import { useGeolocation, isInsideGeofence, calculateDistance } from "@/hooks/use-geolocation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Coffee,
  LogIn,
  LogOut,
  Loader2,
  Navigation,
} from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Location = Database["public"]["Tables"]["locations"]["Row"];
type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
type Shift = Database["public"]["Tables"]["shifts"]["Row"];

interface UserShift {
  id: string;
  start_time: string;
  end_time: string;
  location_id: string | null;
  location: { id: string; name: string } | null;
}

interface TimeClockSettings {
  require_shift_for_clock_in: boolean;
  allow_early_clock_in_minutes: number;
  allow_late_clock_in_minutes: number;
}

interface TimeClockWidgetProps {
  profile: Profile;
  locations: Location[];
  currentEntry: TimeEntry | null;
  todayEntries: TimeEntry[];
  userTodayShifts?: UserShift[];
  timeClockSettings?: TimeClockSettings;
}

type ClockStatus = "clocked_out" | "clocked_in" | "on_break";

export function TimeClockWidget({
  profile,
  locations,
  currentEntry,
  todayEntries,
  userTodayShifts = [],
  timeClockSettings = {
    require_shift_for_clock_in: false,
    allow_early_clock_in_minutes: 30,
    allow_late_clock_in_minutes: 60,
  },
}: TimeClockWidgetProps) {
  const router = useRouter();
  const { position, loading: geoLoading, error: geoError, getPosition } = useGeolocation();

  // Filter out shifts that are already clocked in
  const clockedInShiftIds = useMemo(() => {
    return todayEntries
      .filter((e) => e.entry_type === "clock_in" && e.shift_id)
      .map((e) => e.shift_id);
  }, [todayEntries]);

  const availableShifts = useMemo(() => {
    return userTodayShifts.filter((shift) => !clockedInShiftIds.includes(shift.id));
  }, [userTodayShifts, clockedInShiftIds]);

  // Auto-select shift if only one available
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");

  useEffect(() => {
    if (availableShifts.length === 1) {
      setSelectedShiftId(availableShifts[0].id);
    } else {
      setSelectedShiftId("");
    }
  }, [availableShifts]);

  const selectedShift = availableShifts.find((s) => s.id === selectedShiftId);

  // Auto-set location from selected shift
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    locations.length === 1 ? locations[0].id : ""
  );

  useEffect(() => {
    if (selectedShift?.location_id) {
      setSelectedLocationId(selectedShift.location_id);
    } else if (locations.length === 1) {
      setSelectedLocationId(locations[0].id);
    }
  }, [selectedShift, locations]);

  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Calculate status from today's entries
  const status = useMemo<ClockStatus>(() => {
    if (todayEntries.length === 0) return "clocked_out";

    // Sort by timestamp descending to get the latest entry
    const sortedEntries = [...todayEntries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const latestEntry = sortedEntries[0];

    switch (latestEntry.entry_type) {
      case "clock_in":
        return "clocked_in";
      case "clock_out":
        return "clocked_out";
      case "break_start":
        return "on_break";
      case "break_end":
        return "clocked_in";
      default:
        return "clocked_out";
    }
  }, [todayEntries]);

  // Get clock in time for duration calculation
  const clockInTime = useMemo(() => {
    const clockInEntry = todayEntries.find((e) => e.entry_type === "clock_in");
    return clockInEntry ? new Date(clockInEntry.timestamp) : null;
  }, [todayEntries]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Get position on mount
  useEffect(() => {
    getPosition();
  }, [getPosition]);

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  // Check if user is within geofence
  const isWithinGeofence = (() => {
    if (!position || !selectedLocation) return null;
    if (!selectedLocation.latitude || !selectedLocation.longitude) return true;
    if (!selectedLocation.radius_meters) return true;

    return isInsideGeofence(
      position.latitude,
      position.longitude,
      Number(selectedLocation.latitude),
      Number(selectedLocation.longitude),
      selectedLocation.radius_meters
    );
  })();

  const distanceToLocation = (() => {
    if (!position || !selectedLocation) return null;
    if (!selectedLocation.latitude || !selectedLocation.longitude) return null;

    return calculateDistance(
      position.latitude,
      position.longitude,
      Number(selectedLocation.latitude),
      Number(selectedLocation.longitude)
    );
  })();

  const createTimeEntry = async (entryType: string) => {
    // Check shift requirement for clock_in
    if (entryType === "clock_in") {
      if (timeClockSettings.require_shift_for_clock_in && !selectedShiftId) {
        if (availableShifts.length === 0) {
          toast.error("No shifts available for today. Please contact your manager.");
          return;
        }
        toast.error("Please select a shift");
        return;
      }

      // Only require location selection if locations are available and no shift selected
      if (!selectedLocationId && locations.length > 0) {
        toast.error("Please select a location");
        return;
      }

      if (isWithinGeofence === false && selectedLocation?.geofence_enabled && !selectedLocation?.allow_clock_outside) {
        toast.error("You must be within the work location to clock in", {
          duration: 5000,
          className: "!text-xl !p-6 !min-w-[400px]",
        });
        return;
      }
    }

    setLoading(true);

    try {
      // Map entry type to API endpoint
      const endpointMap: Record<string, string> = {
        clock_in: "/api/time-clock/clock-in",
        clock_out: "/api/time-clock/clock-out",
        break_start: "/api/time-clock/break-start",
        break_end: "/api/time-clock/break-end",
      };

      const endpoint = endpointMap[entryType];
      if (!endpoint) {
        throw new Error(`Unknown entry type: ${entryType}`);
      }

      // Build request body based on entry type
      const body: Record<string, unknown> = {};

      // Add coordinates if available
      if (position?.latitude && position?.longitude) {
        body.coordinates = {
          lat: position.latitude,
          lng: position.longitude,
        };
      }

      // Add location_id and shift_id for clock_in
      if (entryType === "clock_in") {
        if (selectedLocationId) {
          body.location_id = selectedLocationId;
        }
        if (selectedShiftId) {
          body.shift_id = selectedShiftId;
        }
      }

      const response = await apiPost(endpoint, body);

      if (!response.success) {
        throw new Error(response.error || "Failed to record time entry");
      }

      const messages: Record<string, string> = {
        clock_in: "Clocked in successfully",
        clock_out: "Clocked out successfully",
        break_start: "Break started",
        break_end: "Break ended",
      };

      toast.success(messages[entryType] || "Entry recorded");
      router.refresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to record time entry";
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const formatDuration = (start: Date, end: Date = new Date()) => {
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Group entries into sessions
  const sessions = useMemo(() => {
    const result: { clockIn: TimeEntry; clockOut?: TimeEntry; breaks: { start: TimeEntry; end?: TimeEntry }[] }[] = [];
    let currentSession: { clockIn: TimeEntry; clockOut?: TimeEntry; breaks: { start: TimeEntry; end?: TimeEntry }[] } | null = null;

    // Sort entries by timestamp ascending
    const sortedEntries = [...todayEntries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const entry of sortedEntries) {
      if (entry.entry_type === "clock_in") {
        if (currentSession) {
          result.push(currentSession);
        }
        currentSession = { clockIn: entry, breaks: [] };
      } else if (entry.entry_type === "clock_out" && currentSession) {
        currentSession.clockOut = entry;
        result.push(currentSession);
        currentSession = null;
      } else if (entry.entry_type === "break_start" && currentSession) {
        currentSession.breaks.push({ start: entry });
      } else if (entry.entry_type === "break_end" && currentSession && currentSession.breaks.length > 0) {
        const lastBreak = currentSession.breaks[currentSession.breaks.length - 1];
        if (!lastBreak.end) {
          lastBreak.end = entry;
        }
      }
    }

    if (currentSession) {
      result.push(currentSession);
    }

    return result.reverse(); // Most recent first
  }, [todayEntries]);

  return (
    <div className="space-y-6">
      {/* Main Clock Widget */}
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-mono">
            {formatTime(currentTime)}
          </CardTitle>
          <CardDescription>
            {currentTime.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge
              variant={
                status === "clocked_in"
                  ? "default"
                  : status === "on_break"
                  ? "secondary"
                  : "outline"
              }
              className="text-sm px-3 py-1"
            >
              {status === "clocked_in" && (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Clocked In
                </>
              )}
              {status === "on_break" && (
                <>
                  <Coffee className="w-4 h-4 mr-1" />
                  On Break
                </>
              )}
              {status === "clocked_out" && (
                <>
                  <Clock className="w-4 h-4 mr-1" />
                  Clocked Out
                </>
              )}
            </Badge>
          </div>

          {/* Current Session Info */}
          {clockInTime && status !== "clocked_out" && (
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Started at{" "}
                {clockInTime.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
              <p className="font-medium text-foreground">
                Duration: {formatDuration(clockInTime, currentTime)}
              </p>
            </div>
          )}

          {/* Shift Selection - Show when clocked out and shifts exist */}
          {status === "clocked_out" && availableShifts.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Shift {timeClockSettings.require_shift_for_clock_in && <span className="text-destructive">*</span>}
              </label>
              {availableShifts.length === 1 ? (
                <div className="p-3 border rounded-md bg-muted/50">
                  <div className="font-medium">
                    {new Date(availableShifts[0].start_time).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                    {" - "}
                    {new Date(availableShifts[0].end_time).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </div>
                  {availableShifts[0].location && (
                    <div className="text-sm text-muted-foreground">
                      {availableShifts[0].location.name}
                    </div>
                  )}
                </div>
              ) : (
                <Select
                  value={selectedShiftId}
                  onValueChange={setSelectedShiftId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableShifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {new Date(shift.start_time).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                        {" - "}
                        {new Date(shift.end_time).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                        {shift.location && ` (${shift.location.name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* No shifts available warning */}
          {status === "clocked_out" && timeClockSettings.require_shift_for_clock_in && availableShifts.length === 0 && (
            <div className="p-3 border border-amber-200 rounded-md bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">No shifts scheduled for today</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Contact your manager to be assigned a shift.
              </p>
            </div>
          )}

          {/* Location Selection - Show when shift doesn't have location or multiple locations available */}
          {status === "clocked_out" && !selectedShift?.location_id && locations.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Work Location</label>
              <Select
                value={selectedLocationId}
                onValueChange={setSelectedLocationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* GPS Status */}
          <div className="flex items-center justify-center gap-2 text-sm">
            {geoLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-muted-foreground">Getting location...</span>
              </>
            ) : geoError ? (
              <>
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-destructive">{geoError}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={getPosition}
                  className="h-auto p-1"
                >
                  Retry
                </Button>
              </>
            ) : position ? (
              <>
                <Navigation className="w-4 h-4 text-green-500" />
                <span className="text-muted-foreground">
                  Location acquired ({Math.round(position.accuracy)}m)
                </span>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={getPosition}
                  className="h-auto p-1"
                >
                  Get location
                </Button>
              </>
            )}
          </div>

          {/* Geofence Status */}
          {selectedLocation && distanceToLocation !== null && (
            <div className="flex items-center justify-center gap-2 text-sm">
              {isWithinGeofence ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-green-600">
                    Within work area ({Math.round(distanceToLocation)}m away)
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-amber-600">
                    Outside work area ({Math.round(distanceToLocation)}m away)
                  </span>
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-4">
            {status === "clocked_out" && (
              <>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => createTimeEntry("clock_in")}
                  disabled={
                    loading ||
                    geoLoading ||
                    (locations.length > 0 && !selectedLocationId && !selectedShift?.location_id) ||
                    (timeClockSettings.require_shift_for_clock_in && !selectedShiftId)
                  }
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4 mr-2" />
                  )}
                  Clock In
                </Button>
              </>
            )}

            {status === "clocked_in" && (
              <>
                <Button
                  className="w-full"
                  size="lg"
                  variant="destructive"
                  onClick={() => createTimeEntry("clock_out")}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4 mr-2" />
                  )}
                  Clock Out
                </Button>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => createTimeEntry("break_start")}
                  disabled={loading}
                >
                  <Coffee className="w-4 h-4 mr-2" />
                  Start Break
                </Button>
              </>
            )}

            {status === "on_break" && (
              <Button
                className="w-full"
                size="lg"
                onClick={() => createTimeEntry("break_end")}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Coffee className="w-4 h-4 mr-2" />
                )}
                End Break
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Today's Sessions */}
      {sessions.length > 0 && (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-lg">Today&apos;s Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sessions.map((session, idx) => {
                const clockIn = new Date(session.clockIn.timestamp);
                const clockOut = session.clockOut
                  ? new Date(session.clockOut.timestamp)
                  : null;

                // Calculate break time
                let breakMinutes = 0;
                for (const brk of session.breaks) {
                  const brkStart = new Date(brk.start.timestamp);
                  const brkEnd = brk.end
                    ? new Date(brk.end.timestamp)
                    : new Date();
                  breakMinutes += (brkEnd.getTime() - brkStart.getTime()) / (1000 * 60);
                }

                return (
                  <div
                    key={session.clockIn.id}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        {clockIn.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                        {clockOut && (
                          <>
                            {" - "}
                            {clockOut.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </>
                        )}
                      </div>
                      {!clockOut && (
                        <Badge variant="outline" className="text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span>
                        Duration: {formatDuration(clockIn, clockOut || currentTime)}
                      </span>
                      {breakMinutes > 0 && (
                        <span className="ml-2">
                          (Break: {Math.round(breakMinutes)}m)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
