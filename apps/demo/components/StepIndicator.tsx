'use client';

const PIPELINE_STAGES = [
  { label: 'AI Decision', sub: 'Model output' },
  { label: 'Hash & Sign', sub: 'KMS signature' },
  { label: 'On-Chain', sub: 'Blockchain anchor' },
  { label: 'Verify', sub: '3-layer check' },
  { label: 'Proof', sub: 'Audit artifact' },
] as const;

interface PipelineIndicatorProps {
  /** How many pipeline stages are complete (0–5) */
  completedStages: number;
  /** Which stage is currently active (-1 if none) */
  activeStage: number;
}

export function PipelineIndicator({ completedStages, activeStage }: PipelineIndicatorProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      {PIPELINE_STAGES.map((stage, i) => {
        const done = i < completedStages;
        const active = i === activeStage;
        return (
          <div key={stage.label} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done
                    ? 'bg-green-600 text-white'
                    : active
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? '\u2713' : i + 1}
              </div>
              <span
                className={`text-[11px] mt-1 font-medium ${
                  active ? 'text-foreground' : done ? 'text-green-700' : 'text-muted-foreground'
                }`}
              >
                {stage.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{stage.sub}</span>
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <div
                className={`h-0.5 w-full min-w-[12px] mt-4 ${
                  i < completedStages ? 'bg-green-600' : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
