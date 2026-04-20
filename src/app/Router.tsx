import { createHashRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import HomePage from '../pages/HomePage';
import ArticleListPage from '../pages/ArticleListPage';
import FavoritesPage from '../pages/FavoritesPage';
import SettingsPage from '../pages/SettingsPage';
import HistoryPage from '../pages/HistoryPage';

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'articles', element: <ArticleListPage /> },
      { path: 'favorites', element: <FavoritesPage /> },
      { path: 'favorites/:folderId', element: <FavoritesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'history', element: <HistoryPage /> },
    ],
  },
]);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};