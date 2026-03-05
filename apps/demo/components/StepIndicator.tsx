'use client';

import { STEP_TITLES } from '@/lib/constants';

interface StepIndicatorProps {
  currentStep: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEP_TITLES.map((title, i) => (
        <div key={title} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < currentStep
                  ? 'bg-green-600 text-white'
                  : i === currentStep
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < currentStep ? '\u2713' : i}
            </div>
            <span
              className={`text-[11px] mt-1 ${
                i === currentStep ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}
            >
              {title}
            </span>
          </div>
          {i < STEP_TITLES.length - 1 && (
            <div
              className={`h-0.5 w-full min-w-[16px] ${
                i < currentStep ? 'bg-green-600' : 'bg-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
