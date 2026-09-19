import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { CatchUpPage } from '@/pages/CatchUpPage';
import { CreateTaskPage } from '@/pages/CreateTaskPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TaskDetailPage } from '@/pages/TaskDetailPage';
import { TimezonePage } from '@/pages/TimezonePage';
import { TodayPage } from '@/pages/TodayPage';
import { SearchPage } from '@/pages/SearchPage';
import { WeekPage } from '@/pages/WeekPage';
import { useSettingsButton } from '@/shared/lib/telegram';
import { useDeepLink } from './useDeepLink';

// Dev-only; the import is dropped from production builds.
const GalleryPage = import.meta.env.DEV
  ? lazy(() => import('@/pages/dev/GalleryPage').then((m) => ({ default: m.GalleryPage })))
  : null;

/** App-wide wiring that needs the router: deep links and ⋯ → Settings. */
function AppWiring() {
  const navigate = useNavigate();
  useDeepLink();
  useSettingsButton(() => navigate('/settings'));
  return null;
}

export function Router() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppWiring />
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/week" element={<WeekPage />} />
        <Route path="/upcoming" element={<Navigate to="/week" replace />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/catchup" element={<CatchUpPage />} />
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
