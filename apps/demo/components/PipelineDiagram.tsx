'use client';

const stages = [
  { label: 'AI Decision', icon: '1', desc: 'Model output' },
  { label: 'Hash & Sign', icon: '2', desc: 'KMS signature' },
  { label: 'On-Chain', icon: '3', desc: 'Blockchain anchor' },
  { label: 'Verify', icon: '4', desc: '3-layer check' },
  { label: 'Proof', icon: '5', desc: 'Audit artifact' },
];

interface PipelineDiagramProps {
  activeStep?: number;
}

export function PipelineDiagram({ activeStep = -1 }: PipelineDiagramProps) {
  return (
    <div className="flex items-center justify-between gap-1 py-4">
      {stages.map((stage, i) => (
        <div key={stage.label} className="flex items-center flex-1">
          <div className="flex flex-col items-center text-center flex-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                i <= activeStep
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {stage.icon}
            </div>
            <span className="text-xs font-medium mt-1.5">{stage.label}</span>
            <span className="text-[10px] text-muted-foreground">{stage.desc}</span>
          </div>
          {i < stages.length - 1 && (
            <div
              className={`h-0.5 w-full min-w-[20px] mx-1 transition-colors ${
                i < activeStep ? 'bg-primary' : 'bg-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
