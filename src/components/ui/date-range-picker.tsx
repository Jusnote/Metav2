"use client"

import { useState, useEffect } from "react"
import { ChevronDownIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { ptBR } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  disabled?: boolean
}

export function DateRangePicker({ value, onChange, disabled }: DateRangePickerProps) {
  const [range, setRange] = useState<DateRange | undefined>(value)
  const [selectedPreset, setSelectedPreset] = useState<string>("")

  useEffect(() => {
    if (range?.from && range?.to) {
      const diffTime = Math.abs(range.to.getTime() - range.from.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // Check if the difference matches any preset
      const presets = [7, 15, 30, 60, 90]
      if (presets.includes(diffDays)) {
        setSelectedPreset(diffDays.toString())
      } else {
        setSelectedPreset("custom")
      }
    } else {
      setSelectedPreset("")
    }
  }, [range])

  const handleRangeChange = (newRange: DateRange | undefined) => {
    setRange(newRange)
    onChange?.(newRange)
  }

  const handleSetDayRange = (days: string) => {
    if (range?.from) {
      const endDate = new Date(range.from)
      endDate.setDate(endDate.getDate() + Number.parseInt(days))
      const newRange = { from: range.from, to: endDate }
      setRange(newRange)
      setSelectedPreset(days)
      onChange?.(newRange)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="w-full justify-between font-normal bg-transparent"
        >
          {range?.from && range?.to
            ? `${formatDate(range.from)} - ${formatDate(range.to)}`
            : "Selecione o período"}
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleRangeChange}
          locale={ptBR}
          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          fromDate={new Date()}
        />
        {range?.from && (
          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">Deste dia à:</span>
              <Select value={selectedPreset} onValueChange={handleSetDayRange}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder={selectedPreset === "custom" ? "..." : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
