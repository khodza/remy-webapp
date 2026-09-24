import { CalendarPlus, Copy, RefreshCw, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { feedLinks, useCalendarFeed, useDisableCalendarFeed, useEnableCalendarFeed } from '@/features/data';
import { buildUrl } from '@/shared/api';
import { openExternalLink, useHapticFeedback } from '@/shared/lib/telegram';
import { Button, FieldRow, Group, Screen, SectionHeader, Sheet, SkeletonRows, toast, Toggle } from '@/shared/ui';

/** Reminders in Google / Apple Calendar through a private subscription link. */
export function CalendarFeedPage() {
  const feed = useCalendarFeed();
  const enable = useEnableCalendarFeed();
  const disable = useDisableCalendarFeed();
  const haptic = useHapticFeedback();
  const [renewing, setRenewing] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  const on = feed.data?.enabled ?? false;
  const links = feed.data?.path ? feedLinks(buildUrl(feed.data.path), window.location.origin) : null;
  const failed = () => toast({ message: "Couldn't change the calendar link. Try again.", tone: 'danger' });

  const copy = async () => {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.https);
      haptic.notify('success');
      toast({ message: 'Link copied' });
    } catch {
      // Some webviews block the clipboard: select it so a long-press copies.
      field.current?.select();
      toast({ message: 'Long-press the link to copy it' });
    }
  };

  return (
    <Screen>
      <h1 className="px-4 pb-1 pt-3 text-[21px] font-extrabold tracking-[-0.02em]">Calendar feed</h1>
      <p className="px-4 pb-3 text-[13.5px] font-semibold text-muted">
        See your reminders in Google or Apple Calendar next to everything else. Remy still does the reminding; the
        calendar only shows them.
      </p>

      {feed.isPending ? (
        <SkeletonRows count={2} />
      ) : (
        <Group>
          <FieldRow
            icon={<CalendarPlus size={16} />}
            label="Show reminders in my calendar"
            trailing={
              <Toggle
                checked={on}
                disabled={enable.isPending || disable.isPending}
                label="Calendar feed"
                onChange={(next) =>
                  next
                    ? enable.mutate(undefined, { onError: failed })
                    : disable.mutate(undefined, {
                        onSuccess: () => toast({ message: 'Feed off. The old link no longer works.' }),
                        onError: failed,
                      })
                }
              />
            }
          />
        </Group>
      )}

      {on && links ? (
        <>
          <SectionHeader label="Your private link" />
          <Group>
            <div className="flex items-center gap-2 px-3.5 py-2.5">
              <input
                ref={field}
                readOnly
                value={links.https}
                aria-label="Calendar link"
                onFocus={(event) => event.currentTarget.select()}
                className="tnum min-w-0 flex-1 truncate rounded-lg bg-past px-2.5 py-2 text-[12.5px] font-bold text-text outline-none"
              />
              <Button variant="primary" className="shrink-0 px-3" icon={<Copy size={15} />} onClick={() => void copy()}>
                Copy
              </Button>
            </div>
          </Group>
          <p className="px-4 pt-2 text-[12.5px] font-semibold text-muted">
            Anyone with this link can see your reminders. If it leaks, get a new one below.
          </p>
          {links.local ? (
            <p className="mx-4 mt-2 flex gap-2 rounded-xl bg-warn-soft px-3 py-2 text-[12.5px] font-bold text-warn">
              <TriangleAlert size={16} className="mt-px shrink-0" />
              This link points at this computer, so Google and Apple can't reach it. It works once Remy runs on a public
              address.
            </p>
          ) : null}

          <SectionHeader label="Add it" />
          <Group>
            <FieldRow
              label="Google Calendar"
              hint="Opens Google's “add by URL” page"
              onClick={() => openExternalLink(links.google)}
            />
            <FieldRow
              label="Apple Calendar"
              hint="Or: Settings → Calendar → Accounts → Add Subscribed Calendar"
              onClick={() => {
                if (!openExternalLink(links.webcal)) void copy();
              }}
            />
          </Group>
          <p className="px-4 pt-2 text-[12.5px] font-semibold text-muted">
            Calendars fetch it on their own schedule: Apple about every 15 minutes, Google every few hours. New
            reminders show up then.
          </p>

          <Group className="mt-5">
            <FieldRow
              icon={<RefreshCw size={16} />}
              iconTone="danger"
              label="Get a new link"
              danger
              onClick={() => setRenewing(true)}
            />
          </Group>
        </>
      ) : null}

      <Sheet
        open={renewing}
        onClose={() => setRenewing(false)}
        title="Get a new link?"
        footer={
          <Button
            variant="primary"
            block
            disabled={enable.isPending}
            onClick={() =>
              enable.mutate(undefined, {
                onSuccess: () => {
                  setRenewing(false);
                  toast({ message: 'New link ready. Add it to your calendar again.' });
                },
                onError: failed,
              })
            }
          >
            Get a new link
          </Button>
        }
      >
        <p className="text-[14px] font-semibold text-muted">
          The current link stops working at once, and calendars subscribed to it stop updating. You'll need to add the
          new link to them again.
        </p>
      </Sheet>
    </Screen>
  );
}
