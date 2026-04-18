import { backButton } from '@telegram-apps/sdk-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useBackButton(show = true) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!backButton.isMounted()) return undefined;

    if (show) {
      backButton.show();
      return backButton.onClick(() => {
        navigate(-1);
      });
    }

    backButton.hide();
    return undefined;
  }, [show, navigate]);
}
