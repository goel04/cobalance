import { Compass } from 'lucide-react';
import { ButtonLink, EmptyState } from '@/components/ui';

export default function NotFoundPage() {
  return (
    <div className="container-page py-20">
      <EmptyState
        icon={<Compass className="h-6 w-6" />}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink to="/">Go home</ButtonLink>
            <ButtonLink to="/products" variant="outline">
              Explore products
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
