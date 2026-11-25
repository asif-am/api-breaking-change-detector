import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Browser scroll restoration is unreliable in an SPA, so reset on route change. */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
