"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  TimesheetStatus,
  LocationOption,
  EmployeeOption,
} from "@/types/timesheet-table";

interface TimesheetFiltersProps {
  /** Whether user can filter by employee (privileged users only) */
  canFilterByEmployee: boolean;
  /** Status filter value */
  status: TimesheetStatus | "all";
  /** Selected employee ID */
  employeeId: string | "all";
  /** Selected location ID */
  locationId: string | "all";
  /** Available employees */
  employees: EmployeeOption[];
  /** Available locations */
  locations: LocationOption[];
  /** Callback when status changes */
  onStatusChange: (status: TimesheetStatus | "all") => void;
  /** Callback when employee changes */
  onEmployeeChange: (employeeId: string | "all") => void;
  /** Callback when location changes */
  onLocationChange: (locationId: string | "all") => void;
}

const statusOptions: { value: TimesheetStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function TimesheetFilters({
  canFilterByEmployee,
  status,
  employeeId,
  locationId,
  employees,
  locations,
  onStatusChange,
  onEmployeeChange,
  onLocationChange,
}: TimesheetFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Employee Filter (privileged users only) */}
      {canFilterByEmployee && employees.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Employee:</span>
          <Select value={employeeId} onValueChange={onEmployeeChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Status:</span>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Location Filter */}
      {locations.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Location:</span>
          <Select value={locationId} onValueChange={onLocationChange}>
            <SelectTrigger className="w-[160px]">
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
        </div>
      )}
    </div>
  );
}
