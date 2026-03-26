import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

function App() {
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  );
}

export default App;
