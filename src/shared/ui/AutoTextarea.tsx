import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

/**
 * A textarea that grows with its text. CSS field-sizing isn't in iOS
 * WebKit yet, so the height is set from scrollHeight.
 */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function AutoTextarea(props, ref) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={inner} rows={1} {...props} />;
});
