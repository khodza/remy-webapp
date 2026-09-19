import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CreateTaskPage } from '@/pages/CreateTaskPage';
import { HomePage } from '@/pages/HomePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TaskDetailPage } from '@/pages/TaskDetailPage';
import { TimezonePage } from '@/pages/TimezonePage';
import { UpcomingPage } from '@/pages/UpcomingPage';
import { useDeepLink } from './useDeepLink';

// Dev-only; the import is dropped from production builds.
const GalleryPage = import.meta.env.DEV
  ? lazy(() => import('@/pages/dev/GalleryPage').then((m) => ({ default: m.GalleryPage })))
  : null;

function DeepLink() {
  useDeepLink();
  return null;
}

export function Router() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DeepLink />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upcoming" element={<UpcomingPage />} />
        <Route path="/create" element={<CreateTaskPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/timezone" element={<TimezonePage />} />
        {GalleryPage && (
          <Route
            path="/dev/gallery"
            element={
              <Suspense fallback={null}>
                <GalleryPage />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
