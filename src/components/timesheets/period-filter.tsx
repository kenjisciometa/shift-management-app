"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PeriodFilter as PeriodFilterType } from "@/types/timesheet-table";

interface PeriodFilterProps {
  value: PeriodFilterType;
  onValueChange: (value: PeriodFilterType) => void;
}

const periodOptions: { value: PeriodFilterType; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
];

export function PeriodFilter({ value, onValueChange }: PeriodFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Period:</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          {periodOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
