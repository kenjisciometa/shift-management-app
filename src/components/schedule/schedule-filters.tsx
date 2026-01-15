"use client";

import { Filter, Send, Copy, Trash2, X, ChevronDown, MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Location = { id: string; name: string };
type Position = { id: string; name: string };
type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
};

interface ScheduleFiltersProps {
  locations: Location[];
  positions: Position[];
  teamMembers: TeamMember[];
  selectedLocations: string[];
  selectedPosition: string | null;
  selectedMember: string | null;
  selectedEvent: string | null;
  onLocationsChange: (value: string[]) => void;
  onPositionChange: (value: string | null) => void;
  onMemberChange: (value: string | null) => void;
  onEventChange: (value: string | null) => void;
  onClearFilters: () => void;
  // Multi-select actions
  selectedShiftCount: number;
  onPublishSelected: () => void;
  onCopySelected: () => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
}

const eventTypes = [
  { id: "shift", name: "Shifts" },
  { id: "time-off", name: "Time Off" },
  { id: "unavailable", name: "Unavailable" },
];

export function ScheduleFilters({
  locations,
  positions,
  teamMembers,
  selectedLocations,
  selectedPosition,
  selectedMember,
  selectedEvent,
  onLocationsChange,
  onPositionChange,
  onMemberChange,
  onEventChange,
  onClearFilters,
  selectedShiftCount,
  onPublishSelected,
  onCopySelected,
  onDeleteSelected,
  onClearSelection,
}: ScheduleFiltersProps) {
  const hasActiveFilters =
    selectedLocations.length > 0 || selectedPosition || selectedMember || selectedEvent;

  const toggleLocation = (locationId: string) => {
    if (selectedLocations.includes(locationId)) {
      onLocationsChange(selectedLocations.filter((id) => id !== locationId));
    } else {
      onLocationsChange([...selectedLocations, locationId]);
    }
  };

  const getLocationLabel = () => {
    if (selectedLocations.length === 0) return "All Locations";
    if (selectedLocations.length === 1) {
      const loc = locations.find((l) => l.id === selectedLocations[0]);
      return loc?.name || "1 Location";
    }
    return `${selectedLocations.length} Locations`;
  };
  const hasSelectedShifts = selectedShiftCount > 0;

  const getDisplayName = (member: TeamMember) => {
    if (member.display_name) return member.display_name;
    return `${member.first_name} ${member.last_name}`;
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30">
      {/* Selected shifts actions */}
      {hasSelectedShifts && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {selectedShiftCount} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onPublishSelected}
              className="h-8"
            >
              <Send className="h-4 w-4 mr-1" />
              Publish
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onCopySelected}
              className="h-8"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDeleteSelected}
              className="h-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="h-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Separator orientation="vertical" className="h-6" />
        </>
      )}

      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filters:</span>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 text-sm justify-between min-w-[160px]",
              selectedLocations.length > 0 && "border-primary bg-green-100"
            )}
          >
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{getLocationLabel()}</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 ml-2 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-2" align="start">
          <div className="space-y-1">
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">
                No locations available
              </p>
            ) : (
              <>
                {selectedLocations.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 text-xs text-muted-foreground"
                    onClick={() => onLocationsChange([])}
                  >
                    Clear selection
                  </Button>
                )}
                {locations.map((location) => (
                  <label
                    key={location.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted transition-colors"
                  >
                    <Checkbox
                      checked={selectedLocations.includes(location.id)}
                      onCheckedChange={() => toggleLocation(location.id)}
                    />
                    <span className="text-sm">{location.name}</span>
                  </label>
                ))}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Select
        value={selectedPosition || "all"}
        onValueChange={(value) => onPositionChange(value === "all" ? null : value)}
      >
        <SelectTrigger className={cn("w-[160px] h-8 text-sm", selectedPosition && "bg-green-100")}>
          <SelectValue placeholder="All Positions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Positions</SelectItem>
          {positions.map((position) => (
            <SelectItem key={position.id} value={position.id}>
              {position.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedMember || "all"}
        onValueChange={(value) => onMemberChange(value === "all" ? null : value)}
      >
        <SelectTrigger className={cn("w-[180px] h-8 text-sm", selectedMember && "bg-green-100")}>
          <SelectValue placeholder="All Members" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Members</SelectItem>
          {teamMembers.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {getDisplayName(member)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedEvent || "all"}
        onValueChange={(value) => onEventChange(value === "all" ? null : value)}
      >
        <SelectTrigger className={cn("w-[140px] h-8 text-sm", selectedEvent && "bg-green-100")}>
          <SelectValue placeholder="All Events" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Events</SelectItem>
          {eventTypes.map((event) => (
            <SelectItem key={event.id} value={event.id}>
              {event.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="h-8 text-sm text-muted-foreground hover:text-foreground"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
