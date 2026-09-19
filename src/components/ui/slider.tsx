"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, useId } from "react";

interface SliderProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  valueDisplay?: string;
  /** 读屏播报的值描述（如 "1.5 倍速"），不经 DOM 透传 */
  ariaValuetext?: string;
}

export function Slider({ label, valueDisplay, className, ariaValuetext, ...props }: SliderProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          {/* htmlFor/id 关联 + aria-valuetext，读屏可播报当前值 */}
          <label htmlFor={id} className="text-sm font-medium">
            {label}
          </label>
          {valueDisplay && (
            <span className="text-sm text-muted-foreground">{valueDisplay}</span>
          )}
        </div>
      )}
      <input
        id={label ? id : undefined}
        type="range"
        aria-valuetext={ariaValuetext ?? valueDisplay}
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
