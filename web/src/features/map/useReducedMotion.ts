// F3-AC5 (§7.10): prefers-reduced-motion → замість частинок статичні стрілки.
import { useEffect, useState } from 'react';

const Q = '(prefers-reduced-motion: reduce)';
const read = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(Q).matches;

export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(Q), on = () => setReduce(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}
