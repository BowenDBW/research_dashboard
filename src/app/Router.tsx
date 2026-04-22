import { createHashRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import HomePage from '../pages/HomePage';
import ArticleListPage from '../pages/ArticleListPage';
import FavoritesPage from '../pages/FavoritesPage';
import HistoryPage from '../pages/HistoryPage';
import DailyPage from '../pages/DailyPage';
import StatsPage from '../pages/StatsPage';

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'articles', element: <ArticleListPage /> },
      { path: 'favorites', element: <FavoritesPage /> },
      { path: 'favorites/:folderId', element: <FavoritesPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'daily', element: <DailyPage /> },
      { path: 'stats', element: <StatsPage /> },
    ],
  },
]);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};