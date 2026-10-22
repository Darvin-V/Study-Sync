import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, Button } from '../components';
import { ROUTES } from '../config/routes';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="stack" style={{ gap: 'var(--space-6)', padding: 'var(--space-8) 0' }} id="page-not-found">
      <EmptyState
        title="404 — Page Not Found"
        description="The requested learning space or page could not be located in StudySync AI."
        id="not-found-empty-state"
        action={
          <Button
            variant="primary"
            onClick={() => navigate(ROUTES.HOME)}
            id="btn-back-home"
          >
            Return to Dashboard
          </Button>
        }
      />
    </div>
  );
}

export default NotFound;
