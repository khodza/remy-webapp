import { CalendarCheck, Mail, RefreshCw, TriangleAlert, Unplug } from 'lucide-react';
import { useState } from 'react';
import {
  googleFailureMessage,
  useConnectGoogle,
  useDisconnectGoogle,
  useSelectGoogleCalendar,
} from '@/features/integrations';
import { openExternalLink, useHapticFeedback, useMainButton } from '@/shared/lib/telegram';
import {
  Button,
  CheckCircle,
  Empty,
  FieldRow,
  Group,
  Screen,
  SectionHeader,
  Sheet,
  SkeletonRows,
  toast,
} from '@/shared/ui';

/**
 * Google Calendar in the brief: connect (consent happens in the system
 * browser, the page polls until the account shows up), pick calendars,
 * disconnect. Read-only on Google's side; tasks reach calendars via the feed.
 */
export function GoogleCalendarPage() {
  const haptic = useHapticFeedback();
  const { status, connect, waiting, stopWaiting } = useConnectGoogle((connected) => {
    haptic.notify('success');
    toast({ message: connected.email ? `Connected as ${connected.email}` : 'Google Calendar connected' });
  });
  const disconnect = useDisconnectGoogle();
  const select = useSelectGoogleCalendar();
  const [confirming, setConfirming] = useState(false);

  const data = status.data;
  const configured = data?.configured ?? false;
  const connected = data?.connected ?? false;

  const startConnect = () => {
    if (connect.isPending) return;
    connect.mutate(undefined, {
      onSuccess: ({ url }) => {
        if (!openExternalLink(url)) toast({ message: "Couldn't open Google. Try again.", tone: 'danger' });
      },
      onError: (error) => {
        haptic.notify('error');
        toast({ message: googleFailureMessage('connect', error), tone: 'danger' });
      },
    });
  };

  useMainButton({
    text: 'Connect Google Calendar',
    onClick: startConnect,
    visible: configured && !connected,
    loading: connect.isPending,
  });

  const refresh = () => {
    void status.refetch().then((result) => {
      if (result.data && !result.data.connected)
        toast({ message: 'Not connected yet. Finish the Google sign-in first.' });
    });
  };

  return (
    <Screen>
      <h1 className="px-4 pb-1 pt-3 text-[21px] font-extrabold tracking-[-0.02em]">Google Calendar</h1>
      <p className="px-4 pb-3 text-[13.5px] font-semibold text-muted">
        Your day's events in the morning brief and /today. Remy only reads your calendar; nothing is written to Google.
      </p>

      {status.isPending ? (
        <SkeletonRows count={2} />
      ) : !data ? (
        <div className="pt-4">
          <Empty title="Couldn't check the Google connection" body="Check the connection and reopen this screen." />
        </div>
      ) : !configured ? (
        <p className="mx-4 flex gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[12.5px] font-bold text-warn">
          <TriangleAlert size={16} className="mt-px shrink-0" />
          <span>
            Not set up on this server yet: the API needs <code>GOOGLE_CLIENT_ID</code>,{' '}
            <code>GOOGLE_CLIENT_SECRET</code> and <code>GOOGLE_REDIRECT_URL</code> in its environment (see the backend
            README).
          </span>
        </p>
      ) : !connected ? (
        <>
          <Group>
            <div className="px-3.5 py-3 text-[13.5px] font-semibold text-muted">
              Tap <span className="font-extrabold text-text">Connect Google Calendar</span>: Google opens in your
              browser, you sign in and allow read-only access, and the bot confirms in the chat. Then come back here.
            </div>
          </Group>
          <Group className="mt-3">
            <FieldRow
              icon={<RefreshCw size={16} className={waiting ? 'animate-spin' : undefined} />}
              iconTone="ok"
              label={waiting ? 'Waiting for Google…' : "I've connected, refresh"}
              hint={
                waiting ? 'Checking every 5 seconds for two minutes. Tap to check now.' : 'Checks the connection again'
              }
              onClick={refresh}
            />
          </Group>
          {waiting ? (
            <p className="px-4 pt-2 text-[12.5px] font-semibold text-muted">
              Nothing happened?{' '}
              <button type="button" className="font-extrabold text-accent" onClick={stopWaiting}>
                Stop waiting
              </button>{' '}
              and connect again.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <Group>
            <FieldRow icon={<Mail size={16} />} label="Connected as" value={data.email ?? 'Google account'} />
          </Group>

          <SectionHeader label="Calendars in the brief" />
          {data.calendars ? (
            <>
              <Group>
                {data.calendars.map((calendar) => (
                  <FieldRow
                    key={calendar.id}
                    icon={<CalendarCheck size={16} />}
                    iconTone={calendar.selected ? 'ok' : 'accent'}
                    label={calendar.summary}
                    trailing={
                      <CheckCircle
                        done={calendar.selected}
                        label={calendar.summary}
                        disabled={select.isPending}
                        onToggle={() => {
                          const selected = !calendar.selected;
                          haptic.selection();
                          select.mutate(
                            { id: calendar.id, selected },
                            {
                              onSuccess: () =>
                                toast({
                                  message: selected
                                    ? `${calendar.summary} added to the brief`
                                    : `${calendar.summary} left out of the brief`,
                                }),
                              onError: (error) => {
                                haptic.notify('error');
                                toast({ message: googleFailureMessage('select', error), tone: 'danger' });
                              },
                            },
                          );
                        }}
                      />
                    }
                  />
                ))}
              </Group>
              <p className="px-4 pt-2 text-[12.5px] font-semibold text-muted">
                Untick them all and the brief falls back to your primary calendar.
              </p>
            </>
          ) : (
            <>
              <p className="mx-4 flex gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[12.5px] font-bold text-warn">
                <TriangleAlert size={16} className="mt-px shrink-0" />
                Google didn't answer, so the calendar list is missing. The brief keeps using the ones you picked.
              </p>
              <Group className="mt-3">
                <FieldRow icon={<RefreshCw size={16} />} iconTone="ok" label="Try again" onClick={refresh} />
              </Group>
            </>
          )}

          <Group className="mt-5">
            <FieldRow
              icon={<Unplug size={16} />}
              iconTone="danger"
              label="Disconnect Google Calendar"
              danger
              onClick={() => setConfirming(true)}
            />
          </Group>
        </>
      )}

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Disconnect Google Calendar?"
        footer={
          <Button
            variant="danger"
            block
            disabled={disconnect.isPending}
            onClick={() =>
              disconnect.mutate(undefined, {
                onSuccess: () => {
                  setConfirming(false);
                  haptic.notify('warning');
                  toast({ message: 'Google Calendar disconnected.' });
                },
                onError: (error) => {
                  haptic.notify('error');
                  toast({ message: googleFailureMessage('disconnect', error), tone: 'danger' });
                },
              })
            }
          >
            {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        }
      >
        <p className="text-[14px] font-semibold text-muted">
          Remy forgets the account and gives its access back to Google. The brief stops showing your events; you can
          connect again any time.
        </p>
      </Sheet>
    </Screen>
  );
}
