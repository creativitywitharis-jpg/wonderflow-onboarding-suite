import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

/**
 * A click-to-open calendar date picker that reads/writes a plain "YYYY-MM-DD"
 * string (drop-in replacement for <input type="date">). Themed to match the
 * app's inputs — pass the same input class you use elsewhere via `className`.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = value ? parseISO(value) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("flex items-center justify-between gap-2 text-left", className)}>
          <span className={selected ? "text-foreground" : "text-muted-foreground"}>
            {selected ? format(selected, "PP") : placeholder}
          </span>
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
