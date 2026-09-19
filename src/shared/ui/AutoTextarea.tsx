import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

/**
 * A textarea that grows with its text. CSS field-sizing isn't in iOS
 * WebKit yet, so the height is set from scrollHeight.
 */
export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}
