import { ThemeProvider } from './ThemeProvider';
import { AppRouter } from './Router';

function App() {
  return (
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  );
}

export default App;