"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

interface TimeClockWidgetProps {
  profile: Profile;
  locations: Location[];
  currentEntry: TimeEntry | null;
  todayEntries: TimeEntry[];
}

type ClockStatus = "clocked_out" | "clocked_in" | "on_break";

export function TimeClockWidget({
  profile,
  locations,
  currentEntry,
  todayEntries,
}: TimeClockWidgetProps) {
  const router = useRouter();
  const supabase = createClient();
  const { position, loading: geoLoading, error: geoError, getPosition } = useGeolocation();

  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    locations.length === 1 ? locations[0].id : ""
  );
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

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7244/ingest/5c628d44-070d-4c4e-8f24-ef49dbed185b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'time-clock/widget.tsx:108',message:'Component state - locations and selectedLocationId',data:{locationsCount:locations.length,locations:locations.map(l=>({id:l.id,name:l.name})),selectedLocationId,initialSelectedLocationId:locations.length===1?locations[0]?.id:'',todayEntriesCount:todayEntries.length,status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }, [locations, selectedLocationId, todayEntries, status]);
  // #endregion

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7244/ingest/5c628d44-070d-4c4e-8f24-ef49dbed185b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'time-clock/widget.tsx:108',message:'Geolocation state update',data:{geoLoading,geoError,hasPosition:!!position,positionAccuracy:position?.accuracy,positionLat:position?.latitude,positionLng:position?.longitude},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  }, [geoLoading, geoError, position]);
  // #endregion

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
    // Only require location selection if locations are available
    if (!selectedLocationId && entryType === "clock_in" && locations.length > 0) {
      toast.error("Please select a location");
      return;
    }

    if (entryType === "clock_in" && isWithinGeofence === false && selectedLocation?.geofence_enabled && !selectedLocation?.allow_clock_outside) {
      toast.error("You must be within the work location to clock in", {
        duration: 5000,
        className: "!text-xl !p-6 !min-w-[400px]",
      });
      return;
    }

    setLoading(true);

    try {
      // Find today's shift for this user (for clock_in)
      let shiftId: string | null = null;
      if (entryType === "clock_in") {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        const { data: todayShift } = await supabase
          .from("shifts")
          .select("id")
          .eq("user_id", profile.id)
          .eq("organization_id", profile.organization_id)
          .gte("start_time", todayStart.toISOString())
          .lte("start_time", todayEnd.toISOString())
          .order("start_time", { ascending: true })
          .limit(1)
          .single();

        shiftId = todayShift?.id || null;
      } else {
        // For other entry types, use the shift_id from the most recent clock_in
        const lastClockIn = todayEntries.find((e) => e.entry_type === "clock_in");
        shiftId = lastClockIn?.shift_id || null;
      }

      const { error } = await supabase.from("time_entries").insert({
        organization_id: profile.organization_id,
        user_id: profile.id,
        entry_type: entryType,
        timestamp: new Date().toISOString(),
        latitude: position?.latitude,
        longitude: position?.longitude,
        accuracy_meters: position?.accuracy,
        location_id: selectedLocationId || null,
        is_inside_geofence: isWithinGeofence,
        shift_id: shiftId,
      });

      if (error) throw error;

      const messages: Record<string, string> = {
        clock_in: "Clocked in successfully",
        clock_out: "Clocked out successfully",
        break_start: "Break started",
        break_end: "Break ended",
      };

      toast.success(messages[entryType] || "Entry recorded");
      router.refresh();
    } catch (error) {
      toast.error("Failed to record time entry");
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

          {/* Location Selection - Only show when there are multiple locations */}
          {status === "clocked_out" && locations.length > 1 && (
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
                {/* #region agent log */}
                {(() => {
                  // Allow clock in when no locations exist, otherwise require location selection
                  const isDisabled = loading || geoLoading || (locations.length > 0 && !selectedLocationId);
                  fetch('http://127.0.0.1:7244/ingest/5c628d44-070d-4c4e-8f24-ef49dbed185b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'time-clock/widget.tsx:397',message:'Clock In button disabled state',data:{status,isDisabled,loading,geoLoading,selectedLocationId,hasSelectedLocation:!!selectedLocationId,locationsCount:locations.length,locationsIds:locations.map(l=>l.id),isButtonShown:status==='clocked_out'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
                  return null;
                })()}
                {/* #endregion */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => createTimeEntry("clock_in")}
                  disabled={loading || geoLoading || (locations.length > 0 && !selectedLocationId)}
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
