'use client';

import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';

interface DateRangePickerProps {
  value: { start: Date; end: Date };
  onChange: (range: { start: Date; end: Date }) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [preset, setPreset] = useState('24h');

  const presets = [
    { value: '1h', label: 'Last Hour', range: () => ({ start: subDays(new Date(), 1/24), end: new Date() }) },
    { value: '24h', label: 'Last 24 Hours', range: () => ({ start: subDays(new Date(), 1), end: new Date() }) },
    { value: '7d', label: 'Last 7 Days', range: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
    { value: '30d', label: 'Last 30 Days', range: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
    { value: '90d', label: 'Last 90 Days', range: () => ({ start: subDays(new Date(), 90), end: new Date() }) },
    { value: '1m', label: 'This Month', range: () => {
      const now = new Date();
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    }},
    { value: '3m', label: 'Last 3 Months', range: () => ({ start: subMonths(new Date(), 3), end: new Date() }) },
  ];

  const handlePresetChange = (presetValue: string) => {
    setPreset(presetValue);
    const selected = presets.find((p) => p.value === presetValue);
    if (selected) {
      onChange(selected.range());
    }
  };

  const handlePrev = () => {
    const duration = value.end.getTime() - value.start.getTime();
    const newStart = new Date(value.start.getTime() - duration);
    const newEnd = new Date(value.end.getTime() - duration);
    onChange({ start: newStart, end: newEnd });
  };

  const handleNext = () => {
    const duration = value.end.getTime() - value.start.getTime();
    const newStart = new Date(value.start.getTime() + duration);
    const newEnd = new Date(value.end.getTime() + duration);

    // Don't go into the future
    if (newEnd <= new Date()) {
      onChange({ start: newStart, end: newEnd });
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1">
            <Select value={preset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-[200px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm font-medium">
            {format(value.start, 'MMM d, yyyy')} - {format(value.end, 'MMM d, yyyy')}
          </div>

          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
