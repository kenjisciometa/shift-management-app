"use client";

import { Filter, Send, Copy, Trash2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
  selectedLocation: string | null;
  selectedPosition: string | null;
  selectedMember: string | null;
  selectedEvent: string | null;
  onLocationChange: (value: string | null) => void;
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
  selectedLocation,
  selectedPosition,
  selectedMember,
  selectedEvent,
  onLocationChange,
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
    selectedLocation || selectedPosition || selectedMember || selectedEvent;
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

      <Select
        value={selectedLocation || "all"}
        onValueChange={(value) => onLocationChange(value === "all" ? null : value)}
      >
        <SelectTrigger className="w-[160px] h-8 text-sm">
          <SelectValue placeholder="All Locations" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Locations</SelectItem>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedPosition || "all"}
        onValueChange={(value) => onPositionChange(value === "all" ? null : value)}
      >
        <SelectTrigger className="w-[160px] h-8 text-sm">
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
        <SelectTrigger className="w-[180px] h-8 text-sm">
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
        <SelectTrigger className="w-[140px] h-8 text-sm">
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
