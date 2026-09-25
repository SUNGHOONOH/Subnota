import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

interface UseWindowViewportOptions {
  setWindowWidth: Dispatch<SetStateAction<number>>;
}

export const useWindowViewport = ({
  setWindowWidth,
}: UseWindowViewportOptions) => {
  // `windowWidth` state stays at App's original hook position so the session
  // boot effect order and persisted React state identity do not change.
  const [isWindowResizing, setWindowResizing] = useState(false);

  useEffect(() => {
    let idleTimer = 0;
    const update = () => {
      setWindowWidth(window.innerWidth);
      setWindowResizing(true);
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setWindowResizing(false), 180);
    };
    setWindowWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener('resize', update);
    };
  }, [setWindowWidth]);

  return { isWindowResizing };
};
