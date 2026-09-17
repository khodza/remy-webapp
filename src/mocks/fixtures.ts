import {
  addDays,
  addMinutes,
  addMonths,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
  subDays,
  subHours,
  subMinutes,
} from 'date-fns';
import type { Recurrence, TaskStatus, User } from '@/shared/api';

/** In-memory task record as the backend would store it (dates as Date). */
export interface MockTask {
  id: string;
  description: string;
  scheduledAt: Date;
  status: TaskStatus;
  recurrence: Recurrence | null;
  createdAt: Date;
  updatedAt: Date;
}

const at = (base: Date, hour: number, minute = 0): Date =>
  setSeconds(setMinutes(setHours(base, hour), minute), 0);

let nextId = 1;
export function newId(): string {
  // 24-hex like a Mongo ObjectId so the UI/router behave as in production.
  return (nextId++).toString(16).padStart(24, '0');
}

function make(
  description: string,
  scheduledAt: Date,
  opts: { status?: TaskStatus; recurrence?: Recurrence | null; ageDays?: number } = {},
): MockTask {
  const created = subDays(new Date(), opts.ageDays ?? 3);
  return {
    id: newId(),
    description,
    scheduledAt,
    status: opts.status ?? 'pending',
    recurrence: opts.recurrence ?? null,
    createdAt: created,
    updatedAt: created,
  };
}

/** Realistic day: 2 overdue, 3 later today (one weekly), 2 done, 2 tomorrow, 1 monthly. */
export function buildFixtures(now = new Date()): MockTask[] {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  return [
    make('Call the dentist to move the appointment', subHours(now, 3), { ageDays: 2 }),
    make('Pay the electricity bill', subMinutes(now, 77), {
      recurrence: { type: 'monthly' },
      ageDays: 40,
    }),
    make('Send standup notes to Alisher', addMinutes(now, 43)),
    make('Pick up dry cleaning', at(today, 18)),
    make('Call mom', at(today, 19), { recurrence: { type: 'weekly' }, ageDays: 20 }),
    make('Morning run', at(today, 7), { status: 'completed', recurrence: { type: 'weekdays' } }),
    make('Reply to the landlord', at(today, 10), { status: 'completed' }),
    make('Dentist', at(tomorrow, 10)),
    make('Football with Bekzod', at(tomorrow, 19, 30)),
    make('Rent', at(addMonths(today, 1), 10), { recurrence: { type: 'monthly' }, ageDays: 60 }),
  ];
}

export const mockUser: User = {
  id: '000000000000000000000abc',
  telegramUserId: Number(import.meta.env.VITE_MOCK_TG_USER_ID) || 123456789,
  firstName: 'Remy',
  lastName: 'Dev',
  username: 'remy_dev',
  timezone: 'Asia/Tashkent',
};
