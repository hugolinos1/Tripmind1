"use client"

import * as React from "react"
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isAfter,
  isBefore,
} from "date-fns"
import { fr } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

// Keep props for compatibility, but many will not be used in this simpler component
export type CalendarProps = {
  mode?: "single" | "range"
  selected?: Date | { from?: Date; to?: Date }
  onSelect?: (date: Date | { from?: Date; to?: Date } | undefined) => void
  className?: string
  numberOfMonths?: number
  locale?: any
  disabled?: any
  showOutsideDays?: any
}

function Calendar({
  className,
  mode = "range",
  selected,
  onSelect,
  ...props
}: CalendarProps) {
  // Determine the initial date to display, defaulting to today
  const getInitialDate = () => {
    if (mode === 'range' && selected && 'from' in selected && selected.from) {
      return selected.from;
    }
    if (mode === 'single' && selected instanceof Date) {
      return selected;
    }
    return new Date();
  }

  const [displayDate, setDisplayDate] = React.useState(getInitialDate())

  const handlePrevMonth = () => {
    setDisplayDate(subMonths(displayDate, 1))
  }

  const handleNextMonth = () => {
    setDisplayDate(addMonths(displayDate, 1))
  }
  
  const handleDayClick = (day: Date) => {
    if (!onSelect) return;

    if (mode === "single") {
      onSelect(day);
    } else if (mode === "range") {
      const range = selected as { from?: Date; to?: Date };
      if (!range?.from || range.to) {
        // Either no start date, or the range is complete, so start a new range.
        onSelect({ from: day, to: undefined });
      } else {
        // `from` date exists, so we are setting the `to` date.
        if (isBefore(day, range.from)) {
          // If the new date is before the start date, start a new range with the new date.
          onSelect({ from: day, to: undefined });
        } else {
          // Otherwise, complete the range.
          onSelect({ from: range.from, to: day });
        }
      }
    }
  };

  const weekDays = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"];
  const firstDayOfMonth = startOfMonth(displayDate);
  const daysInMonth = eachDayOfInterval({start: firstDayOfMonth, end: endOfMonth(displayDate)});
  
  // Get the day of the week for the first day of the month (0=Sun, 1=Mon,...)
  const firstDayOfWeek = getDay(firstDayOfMonth);
  
  // Create an array of empty placeholders for days before the 1st to align the grid
  const emptyDays = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  return (
    <div className={cn("w-fit bg-card text-card-foreground border rounded-md p-2", className)}>
      {/* Header with month/year and navigation */}
      <div className="flex items-center justify-between text-sm font-semibold mb-2">
        <button
          onClick={handlePrevMonth}
          className="p-1 border border-input rounded-sm hover:bg-accent focus:outline-none"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="capitalize" aria-live="polite">
          {format(displayDate, "MMMM yyyy", { locale: fr })}
        </div>
        <button
          onClick={handleNextMonth}
          className="p-1 border border-input rounded-sm hover:bg-accent focus:outline-none"
          aria-label="Mois suivant"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Grid for the days */}
      <div className="grid grid-cols-7 text-center">
        {/* Week Day Headers */}
        {weekDays.map((day) => (
          <div key={day} className="text-xs font-medium text-muted-foreground w-8 h-8 flex items-center justify-center">
            {day}
          </div>
        ))}

        {/* Empty cells for alignment */}
        {emptyDays.map((_, index) => (
          <div key={`empty-${index}`} className="w-8 h-8"></div>
        ))}

        {/* Dates */}
        {daysInMonth.map((day) => {
            let isSelected = false;
            let isInRange = false;
            let isRangeStart = false;
            let isRangeEnd = false;

            if (mode === 'range' && selected) {
                const range = selected as { from?: Date; to?: Date };
                isRangeStart = !!range.from && isSameDay(day, range.from);
                isRangeEnd = !!range.to && isSameDay(day, range.to);
                isSelected = isRangeStart || isRangeEnd;
                // A day is in range if it's between a defined start and end
                isInRange = !!(range.from && range.to) && isAfter(day, range.from) && isBefore(day, range.to);
            } else if (mode === 'single' && selected) {
                isSelected = isSameDay(day, selected as Date);
            }

            return (
              <button
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "w-8 h-8 text-sm flex items-center justify-center rounded-sm transition-colors",
                  "hover:bg-accent/50",
                  // Apply range background if it's between start and end
                  isInRange && "bg-accent/30",
                  // Apply selected style for single dates or range start/end
                  isSelected && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {format(day, "d")}
              </button>
            )
        })}
      </div>
    </div>
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
