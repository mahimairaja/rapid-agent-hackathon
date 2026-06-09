export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{message}</span>
    </div>
  );
}

export function EmptyState({
  icon = '📋',
  title = 'Nothing here yet',
  subtitle,
}: {
  icon?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">{icon}</span>
      <p className="empty-state-title">{title}</p>
      {subtitle && <p className="empty-state-sub">{subtitle}</p>}
    </div>
  );
}
