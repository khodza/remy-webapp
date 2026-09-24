import type { ReactNode } from 'react';

/** An empty state names what to do next. */
export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-3 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-rule px-5 py-7 text-center">
      {icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
          {icon}
        </span>
      ) : null}
      <p className="text-[15px] font-extrabold text-text">{title}</p>
      {body ? <p className="max-w-[34ch] text-[13px] font-semibold text-muted">{body}</p> : null}
      {action}
    </div>
  );
}

/** Full-screen message (errors, auth problems, outside Telegram). */
export function Placeholder({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      {icon ? (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          {icon}
        </span>
      ) : null}
      <h1 className="text-[20px] font-extrabold tracking-tight text-text">{title}</h1>
      {body ? <p className="max-w-[32ch] text-[14px] font-semibold text-muted">{body}</p> : null}
      {action}
    </main>
  );
}
