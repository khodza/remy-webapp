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
import type {
  Category,
  Priority,
  Recurrence,
  Settings,
  SourceType,
  TaskStatus,
  User,
} from '@/shared/api';
import { DEFAULT_SETTINGS } from '@/shared/api';

/** In-memory task record as the backend would store it (dates as Date). */
export interface MockTask {
  id: string;
  description: string;
  notes: string | null;
  /** null = todo (Inbox). */
  scheduledAt: Date | null;
  status: TaskStatus;
  recurrence: Recurrence | null;
  /** IANA zone the task was created in. */
  timezone: string;
  /** One-off snooze of a recurring task; the series time stays put. */
  snoozedUntil: Date | null;
  leadMinutes: number | null;
  priority: Priority;
  categoryId: string | null;
  source: {
    type: SourceType;
    originalText: string | null;
    messageId: number | null;
    forwardedFrom: string | null;
  };
  completedAt: Date | null;
  completionsCount: number;
  /** Times snoozed or delayed, ever. */
  snoozeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const MOCK_TIMEZONE = 'Asia/Tashkent';

/** When the reminder fires — mirrors the backend's nextFireAt. Null for todos. */
export function nextFireAt(
  task: Pick<MockTask, 'scheduledAt' | 'snoozedUntil'>,
): Date | null {
  return task.snoozedUntil ?? task.scheduledAt;
}

const at = (base: Date, hour: number, minute = 0): Date =>
  setSeconds(setMinutes(setHours(base, hour), minute), 0);

let nextId = 1;
export function newId(): string {
  // 24-hex like a Mongo ObjectId so the UI/router behave as in production.
  return (nextId++).toString(16).padStart(24, '0');
}

// Stable ids so fixtures can point at categories.
export const CATEGORY_IDS = {
  work: 'c00000000000000000000001',
  home: 'c00000000000000000000002',
  health: 'c00000000000000000000003',
  errand: 'c00000000000000000000004',
  personal: 'c00000000000000000000005',
} as const;

export function buildCategories(): Category[] {
  return [
    { id: CATEGORY_IDS.work, name: 'Work', emoji: '💼', color: '#5B5BD6', keywords: ['standup', 'meeting', 'report', 'deadline', 'review'] },
    { id: CATEGORY_IDS.home, name: 'Home', emoji: '🏠', color: '#12B76A', keywords: ['rent', 'bill', 'landlord', 'clean', 'repair'] },
    { id: CATEGORY_IDS.health, name: 'Health', emoji: '🩺', color: '#F04438', keywords: ['dentist', 'doctor', 'vitamins', 'run', 'gym'] },
    { id: CATEGORY_IDS.errand, name: 'Errand', emoji: '🛒', color: '#F79009', keywords: ['buy', 'pick up', 'groceries', 'dry cleaning'] },
    { id: CATEGORY_IDS.personal, name: 'Personal', emoji: '🙂', color: '#0E9F9E', keywords: ['mom', 'dad', 'call', 'birthday', 'football'] },
  ];
}

export function buildSettings(): Settings {
  return structuredClone(DEFAULT_SETTINGS);
}

type MakeOpts = Partial<
  Pick<
    MockTask,
    | 'status'
    | 'recurrence'
    | 'notes'
    | 'priority'
    | 'categoryId'
    | 'leadMinutes'
    | 'completionsCount'
    | 'snoozeCount'
  >
> & {
  ageDays?: number;
  source?: Partial<MockTask['source']>;
};

export function makeTask(
  description: string,
  scheduledAt: Date | null,
  opts: MakeOpts = {},
): MockTask {
  const created = subDays(new Date(), opts.ageDays ?? 3);
  const status = opts.status ?? 'pending';
  return {
    id: newId(),
    description,
    notes: opts.notes ?? null,
    scheduledAt,
    status,
    recurrence: opts.recurrence ?? null,
    timezone: MOCK_TIMEZONE,
    snoozedUntil: null,
    leadMinutes: opts.leadMinutes ?? null,
    priority: opts.priority ?? 'normal',
    categoryId: opts.categoryId ?? null,
    source: {
      type: 'text',
      originalText: null,
      messageId: null,
      forwardedFrom: null,
      ...opts.source,
    },
    completedAt: status === 'completed' ? (scheduledAt ?? created) : null,
    completionsCount: opts.completionsCount ?? 0,
    snoozeCount: opts.snoozeCount ?? 0,
    createdAt: created,
    updatedAt: created,
  };
}

/** Realistic day: 2 overdue, 3 later today, 2 done, 2 tomorrow, 1 monthly, 2 todos. */
export function buildFixtures(now = new Date()): MockTask[] {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  return [
    makeTask('Call the dentist to move the appointment', subHours(now, 3), {
      ageDays: 2,
      priority: 'high',
      categoryId: CATEGORY_IDS.health,
      notes: 'Ask for a Friday slot, not Thursday. Bring the insurance card.',
      leadMinutes: 30,
      // Snoozed often: the detail screen shows "Snoozed 5 times".
      snoozeCount: 5,
      source: {
        type: 'forward',
        originalText: 'Your slot on Thu 10:00 is confirmed. Reply to change.',
        forwardedFrom: "Dr. Karimova's clinic",
        messageId: 4121,
      },
    }),
    makeTask('Pay the electricity bill', subMinutes(now, 77), {
      recurrence: { type: 'monthly' },
      ageDays: 40,
      categoryId: CATEGORY_IDS.home,
      completionsCount: 1,
    }),
    makeTask('Send standup notes to Alisher', addMinutes(now, 43), {
      categoryId: CATEGORY_IDS.work,
      source: { type: 'voice', originalText: 'remind me to send standup notes to Alisher in forty minutes' },
    }),
    makeTask('Pick up dry cleaning', at(today, 18), { categoryId: CATEGORY_IDS.errand }),
    makeTask('Call mom', at(today, 19), {
      recurrence: { type: 'weekly' },
      ageDays: 20,
      categoryId: CATEGORY_IDS.personal,
      completionsCount: 2,
    }),
    makeTask('Morning run', at(today, 7), {
      status: 'completed',
      categoryId: CATEGORY_IDS.health,
    }),
    makeTask('Reply to the landlord', at(today, 10), {
      status: 'completed',
      categoryId: CATEGORY_IDS.home,
    }),
    makeTask('Dentist', at(tomorrow, 10), { categoryId: CATEGORY_IDS.health, priority: 'high' }),
    makeTask('Football with Bekzod', at(tomorrow, 19, 30), { categoryId: CATEGORY_IDS.personal }),
    // Rules only the chat can create: the picker must show them as "Custom".
    makeTask('Gym', at(addDays(today, 2), 7), {
      recurrence: { type: 'weekly', byWeekday: [1, 4] },
      categoryId: CATEGORY_IDS.health,
      source: { type: 'text', originalText: 'gym every mon and thu at 7am' },
    }),
    makeTask("Mom's birthday", at(addMonths(today, 2), 9), {
      recurrence: { type: 'yearly' },
      categoryId: CATEGORY_IDS.personal,
      leadMinutes: 60,
    }),
    makeTask('Rent', at(addMonths(today, 1), 10), {
      recurrence: { type: 'monthly' },
      ageDays: 60,
      categoryId: CATEGORY_IDS.home,
    }),
    makeTask('Buy new headphones', null, {
      ageDays: 1,
      categoryId: CATEGORY_IDS.personal,
      source: { type: 'text', originalText: 'someday: buy new headphones' },
    }),
    makeTask('Book the Samarkand trip', null, {
      ageDays: 4,
      priority: 'low',
      notes: 'Afrosiyob train is faster than driving.',
      source: { type: 'miniapp' },
    }),
  ];
}

export const mockUser: User = {
  id: '000000000000000000000abc',
  telegramUserId: Number(import.meta.env.VITE_MOCK_TG_USER_ID) || 123456789,
  firstName: 'Remy',
  lastName: 'Dev',
  username: 'remy_dev',
  timezone: MOCK_TIMEZONE,
};
