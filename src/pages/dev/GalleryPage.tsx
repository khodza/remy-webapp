import { Bell, Clock, Inbox, Repeat, Tag } from 'lucide-react';
import { useState } from 'react';
import { useMainButton } from '@/shared/lib/telegram';
import {
  Button,
  CheckCircle,
  Chip,
  Empty,
  FieldRow,
  Group,
  Pill,
  Screen,
  SectionHeader,
  Segmented,
  Sheet,
  SheetOption,
  SkeletonRows,
  toast,
  Toggle,
} from '@/shared/ui';

/** Dev-only (#/dev/gallery): every kit component in both themes. */
export function GalleryPage() {
  const [view, setView] = useState<'timeline' | 'list'>('timeline');
  const [on, setOn] = useState(true);
  const [done, setDone] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [repeat, setRepeat] = useState('none');
  useMainButton({ text: 'New reminder', onClick: () => toast({ message: 'MainButton tapped' }) });

  return (
    <Screen>
      <div className="flex items-center justify-between px-4 pt-3">
        <h1 className="text-[22px] font-extrabold tracking-tight">Kit</h1>
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'timeline', label: 'Timeline' },
            { value: 'list', label: 'List' },
          ]}
        />
      </div>

      <SectionHeader label="Pills" />
      <div className="flex flex-wrap gap-1.5 px-4">
        <Pill>Inbox</Pill>
        <Pill tone="accent">Work</Pill>
        <Pill tone="danger">2 h late</Pill>
        <Pill tone="ok">Done</Pill>
        <Pill tone="warn">Snoozed ×4</Pill>
      </div>

      <SectionHeader label="Rows" right="Edit" />
      <Group>
        <div className="grid min-h-14 grid-cols-[44px_1fr_28px] items-center gap-2.5 px-3.5 py-2">
          <span className="tnum text-[13px] font-extrabold text-danger">09:00</span>
          <div className="min-w-0">
            <p className={done ? 'text-[15px] font-bold text-muted line-through' : 'text-[15px] font-bold'}>Pay the electricity bill</p>
            <div className="mt-0.5 flex gap-1">
              <Pill tone="danger">5 h late</Pill>
              <Pill>
                <Repeat size={11} /> Monthly
              </Pill>
            </div>
          </div>
          <CheckCircle done={done} onToggle={() => setDone(!done)} label="Mark as done" tone="danger" />
        </div>
        <FieldRow icon={<Clock size={16} />} label="When" value="Today · 14:47" onClick={() => setSheet(true)} />
        <FieldRow icon={<Repeat size={16} />} iconTone="warn" label="Repeat" value={repeat === 'none' ? 'Never' : repeat} onClick={() => setSheet(true)} />
        <FieldRow icon={<Bell size={16} />} iconTone="ok" label="Nudges" hint="Re-ping until you act" trailing={<Toggle checked={on} onChange={setOn} label="Nudges" />} />
        <FieldRow icon={<Tag size={16} />} iconTone="danger" label="Delete" danger onClick={() => toast({ message: 'Deleted “Pay the bill”', action: { label: 'Undo', onClick: () => toast({ message: 'Restored' }) } })} />
      </Group>

      <SectionHeader label="Snooze" />
      <div className="grid grid-cols-4 gap-1.5 px-4">
        <Chip label="+1 h" sub="15:47" onClick={() => toast({ message: 'Snoozed to 15:47' })} />
        <Chip label="Tonight" sub="20:00" onClick={() => undefined} />
        <Chip label="Tomorrow" sub="09:00" onClick={() => undefined} />
        <Chip label="Pick…" onClick={() => setSheet(true)} />
      </div>

      <SectionHeader label="Buttons" />
      <div className="flex flex-wrap gap-2 px-4">
        <Button variant="primary">Primary</Button>
        <Button>Secondary</Button>
        <Button variant="danger">Delete</Button>
        <Button variant="ghost">Ghost</Button>
      </div>

      <SectionHeader label="Loading" />
      <SkeletonRows count={2} />

      <SectionHeader label="Empty" />
      <Empty icon={<Inbox size={20} />} title="Inbox is empty" body="Todos without a time land here. Say “buy milk” to the bot." />

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Repeat">
        {['none', 'Every day', 'Every weekday', 'Every week', 'Every month'].map((option) => (
          <SheetOption
            key={option}
            label={option === 'none' ? 'Never' : option}
            selected={repeat === option}
            onClick={() => {
              setRepeat(option);
              setSheet(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
