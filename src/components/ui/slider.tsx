"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes } from "react";

interface SliderProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  valueDisplay?: string;
}

export function Slider({ label, valueDisplay, className, ...props }: SliderProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{label}</label>
          {valueDisplay && (
            <span className="text-sm text-muted-foreground">{valueDisplay}</span>
          )}
        </div>
      )}
      <input
        type="range"
        className={cn(
          "w-full cursor-pointer appearance-none rounded-lg bg-muted",
          "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
          "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary",
          className
        )}
        {...props}
      />
    </div>
  );
}
