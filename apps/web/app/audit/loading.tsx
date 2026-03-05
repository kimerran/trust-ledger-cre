export default function AuditLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-9 w-36 bg-muted rounded" />
        <div className="h-5 w-48 bg-muted rounded mt-2" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}
