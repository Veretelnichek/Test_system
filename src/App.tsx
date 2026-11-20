import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth, homePath } from '@/features/auth/auth-context'
import { FullScreenLoader, RequireAuth, RoleRoute } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { ForgotPasswordPage, ResetPasswordPage } from '@/features/auth/password-pages'
import { PendingPage } from '@/features/auth/pending-page'
import { AppShell } from '@/features/layout/app-shell'
import { StudentDashboard } from '@/features/dashboard/student-dashboard'
import { CuratorDashboard } from '@/features/dashboard/curator-dashboard'
import { BoardPage } from '@/features/board/board-page'
import { BoardsPage } from '@/features/boards/boards-page'
import { ModulesPage } from '@/features/modules/modules-page'
import { ReviewsPage } from '@/features/reviews/reviews-page'
import { StudentsPage } from '@/features/students/students-page'
import { AnalyticsPage } from '@/features/analytics/analytics-page'
import { NotificationsPage } from '@/features/notifications/notifications-page'
import { ProfilePage } from '@/features/profile/profile-page'
import { JoinPage } from '@/features/profile/join-page'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/data'
import { LogoMark } from '@/components/ui/logo'

function RootRedirect() {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={homePath(session.profile.role)} replace />
}

function AppIndexRedirect() {
  const { profile } = useAuth()
  if (!profile) return <Navigate to="/login" replace />
  return <Navigate to={homePath(profile.role)} replace />
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-900 px-6 text-center">
      <LogoMark className="h-11 w-11" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">404</p>
      <EmptyState
        title="Страница не найдена"
        description="Возможно, ссылка устарела или у вас нет доступа к этому разделу."
        action={<Button onClick={() => window.location.assign('/')}>На главную</Button>}
      />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/pending" element={<PendingPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<AppIndexRedirect />} />

          <Route element={<RoleRoute role="student" />}>
            <Route path="home" element={<StudentDashboard />} />
            <Route path="board" element={<BoardPage />} />
            <Route path="modules" element={<ModulesPage />} />
            <Route path="join" element={<JoinPage />} />
          </Route>

          <Route element={<RoleRoute role="curator" />}>
            <Route path="overview" element={<CuratorDashboard />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="boards" element={<BoardsPage />} />
            <Route path="boards/:studentId" element={<BoardPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
          </Route>

          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
