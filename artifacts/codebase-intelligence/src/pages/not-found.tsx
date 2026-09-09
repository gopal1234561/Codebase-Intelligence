import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background px-5">
      <Card className="w-full max-w-md mx-4 border-border bg-card shadow-lg">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-not-found-title">
              404 Page Not Found
            </h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground" data-testid="text-not-found-description">
            This route is not part of the analysis workspace.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
