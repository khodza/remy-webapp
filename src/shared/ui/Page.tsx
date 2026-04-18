import type { PropsWithChildren } from 'react';
import { useBackButton } from '@/shared/lib/telegram';

export function Page({
  children,
  back = true,
}: PropsWithChildren<{ back?: boolean }>) {
  useBackButton(back);
  return <>{children}</>;
}
