interface ProgressDotsProps {
  total: number;
  completed: number;
  current: number;
}

export function ProgressDots({ total, completed, current }: ProgressDotsProps) {
  return (
    <div
      className="progress-dots"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={Math.max(total, 1)}
      aria-valuenow={Math.min(current + 1, Math.max(total, 1))}
      aria-label={`第 ${Math.min(current + 1, total)} 个，共 ${total} 个`}
    >
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={[
            'progress-dots__dot',
            index < completed ? 'is-done' : '',
            index === current ? 'is-current' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ))}
      <span className="progress-dots__count" aria-hidden="true">
        {Math.min(current + 1, total)} / {total}
      </span>
    </div>
  );
}
