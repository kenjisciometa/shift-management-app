"use client";

import { useState } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, addDays, addWeeks, addMonths, addQuarters, addYears, subDays, subWeeks, subMonths, subQuarters, subYears } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PeriodFilter } from "@/types/timesheet-table";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  period: PeriodFilter;
  startDate: Date;
  endDate: Date;
  onDateChange: (start: Date, end: Date) => void;
}

/**
 * Format display text based on period type
 */
function formatPeriodDisplay(period: PeriodFilter, startDate: Date, endDate: Date): string {
  switch (period) {
    case "day":
      return format(startDate, "MMM d, yyyy");
    case "week":
      return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;
    case "month":
      return format(startDate, "MMMM yyyy");
    case "quarter":
      const quarter = Math.floor(startDate.getMonth() / 3) + 1;
      return `Q${quarter} ${format(startDate, "yyyy")}`;
    case "year":
      return format(startDate, "yyyy");
    case "custom":
      return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;
    default:
      return format(startDate, "MMM d, yyyy");
  }
}

/**
 * Get quarter options for a given year
 */
function getQuarterOptions(year: number) {
  return [
    { label: "Q1", start: new Date(year, 0, 1), end: new Date(year, 2, 31) },
    { label: "Q2", start: new Date(year, 3, 1), end: new Date(year, 5, 30) },
    { label: "Q3", start: new Date(year, 6, 1), end: new Date(year, 8, 30) },
    { label: "Q4", start: new Date(year, 9, 1), end: new Date(year, 11, 31) },
  ];
}

export function DateRangePicker({
  period,
  startDate,
  endDate,
  onDateChange,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: startDate,
    to: endDate,
  });

  /**
   * Navigate to previous period
   */
  const handlePrevious = () => {
    let newStart: Date;
    let newEnd: Date;

    switch (period) {
      case "day":
        newStart = subDays(startDate, 1);
        newEnd = newStart;
        break;
      case "week":
        newStart = subWeeks(startDate, 1);
        newEnd = endOfWeek(newStart, { weekStartsOn: 0 });
        break;
      case "month":
        newStart = subMonths(startDate, 1);
        newEnd = endOfMonth(newStart);
        break;
      case "quarter":
        newStart = subQuarters(startDate, 1);
        newEnd = endOfQuarter(newStart);
        break;
      case "year":
        newStart = subYears(startDate, 1);
        newEnd = endOfYear(newStart);
        break;
      default:
        return;
    }

    onDateChange(newStart, newEnd);
  };

  /**
   * Navigate to next period
   */
  const handleNext = () => {
    let newStart: Date;
    let newEnd: Date;

    switch (period) {
      case "day":
        newStart = addDays(startDate, 1);
        newEnd = newStart;
        break;
      case "week":
        newStart = addWeeks(startDate, 1);
        newEnd = endOfWeek(newStart, { weekStartsOn: 0 });
        break;
      case "month":
        newStart = addMonths(startDate, 1);
        newEnd = endOfMonth(newStart);
        break;
      case "quarter":
        newStart = addQuarters(startDate, 1);
        newEnd = endOfQuarter(newStart);
        break;
      case "year":
        newStart = addYears(startDate, 1);
        newEnd = endOfYear(newStart);
        break;
      default:
        return;
    }

    onDateChange(newStart, newEnd);
  };

  /**
   * Go to today/current period
   */
  const handleToday = () => {
    const today = new Date();
    let newStart: Date;
    let newEnd: Date;

    switch (period) {
      case "day":
        newStart = today;
        newEnd = today;
        break;
      case "week":
        newStart = startOfWeek(today, { weekStartsOn: 0 });
        newEnd = endOfWeek(today, { weekStartsOn: 0 });
        break;
      case "month":
        newStart = startOfMonth(today);
        newEnd = endOfMonth(today);
        break;
      case "quarter":
        newStart = startOfQuarter(today);
        newEnd = endOfQuarter(today);
        break;
      case "year":
        newStart = startOfYear(today);
        newEnd = endOfYear(today);
        break;
      case "custom":
        newStart = today;
        newEnd = today;
        break;
      default:
        return;
    }

    onDateChange(newStart, newEnd);
  };

  /**
   * Handle single date selection (for day period)
   */
  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      onDateChange(date, date);
      setOpen(false);
    }
  };

  /**
   * Handle month selection
   */
  const handleMonthSelect = (date: Date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    onDateChange(start, end);
    setOpen(false);
  };

  /**
   * Handle quarter selection
   */
  const handleQuarterSelect = (start: Date, end: Date) => {
    onDateChange(start, end);
    setOpen(false);
  };

  /**
   * Handle year selection
   */
  const handleYearSelect = (year: number) => {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    onDateChange(start, end);
    setOpen(false);
  };

  /**
   * Handle custom range selection
   */
  const handleCustomRangeApply = () => {
    if (customRange.from && customRange.to) {
      onDateChange(customRange.from, customRange.to);
      setOpen(false);
    }
  };

  /**
   * Render content based on period type
   */
  const renderContent = () => {
    switch (period) {
      case "day":
        return (
          <Calendar
            mode="single"
            selected={startDate}
            onSelect={handleDaySelect}
            initialFocus
          />
        );

      case "week":
        return (
          <Calendar
            mode="single"
            selected={startDate}
            onSelect={(date) => {
              if (date) {
                const start = startOfWeek(date, { weekStartsOn: 0 });
                const end = endOfWeek(date, { weekStartsOn: 0 });
                onDateChange(start, end);
                setOpen(false);
              }
            }}
            initialFocus
          />
        );

      case "month":
        const currentYear = startDate.getFullYear();
        const months = Array.from({ length: 12 }, (_, i) => new Date(currentYear, i, 1));
        return (
          <div className="p-3">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMonthSelect(new Date(currentYear - 1, startDate.getMonth(), 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium">{currentYear}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMonthSelect(new Date(currentYear + 1, startDate.getMonth(), 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {months.map((month) => (
                <Button
                  key={month.getMonth()}
                  variant={month.getMonth() === startDate.getMonth() ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleMonthSelect(month)}
                >
                  {format(month, "MMM")}
                </Button>
              ))}
            </div>
          </div>
        );

      case "quarter":
        const qYear = startDate.getFullYear();
        const currentQuarter = Math.floor(startDate.getMonth() / 3);
        return (
          <div className="p-3">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newYear = qYear - 1;
                  const quarters = getQuarterOptions(newYear);
                  handleQuarterSelect(quarters[currentQuarter].start, quarters[currentQuarter].end);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium">{qYear}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newYear = qYear + 1;
                  const quarters = getQuarterOptions(newYear);
                  handleQuarterSelect(quarters[currentQuarter].start, quarters[currentQuarter].end);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {getQuarterOptions(qYear).map((q, index) => (
                <Button
                  key={q.label}
                  variant={index === currentQuarter ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuarterSelect(q.start, q.end)}
                >
                  {q.label}
                </Button>
              ))}
            </div>
          </div>
        );

      case "year":
        const selectedYear = startDate.getFullYear();
        const years = Array.from({ length: 12 }, (_, i) => selectedYear - 5 + i);
        return (
          <div className="p-3">
            <div className="grid grid-cols-3 gap-2">
              {years.map((year) => (
                <Button
                  key={year}
                  variant={year === selectedYear ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleYearSelect(year)}
                >
                  {year}
                </Button>
              ))}
            </div>
          </div>
        );

      case "custom":
        return (
          <div className="p-3 space-y-4">
            <Calendar
              mode="range"
              selected={{ from: customRange.from, to: customRange.to }}
              onSelect={(range) => {
                setCustomRange({ from: range?.from, to: range?.to });
              }}
              numberOfMonths={2}
              initialFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCustomRangeApply}
                disabled={!customRange.from || !customRange.to}
              >
                Apply
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Navigation buttons (not shown for custom) */}
      {period !== "custom" && (
        <>
          <Button variant="outline" size="icon" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      {/* Date display with popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "min-w-[200px] justify-start text-left font-normal",
              !startDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatPeriodDisplay(period, startDate, endDate)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {renderContent()}
        </PopoverContent>
      </Popover>
    </div>
  );
}
