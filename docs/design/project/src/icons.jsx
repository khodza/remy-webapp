// Icon set — single-color line icons, 20×20 default
const Ic = ({ d, size = 20, stroke = 'currentColor', sw = 1.7, fill = 'none', style }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill={fill} stroke={stroke} strokeWidth={sw}
       strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d={d} />
  </svg>
);

const Icons = {
  Check:    (p) => <Ic d="M4 10.5l4 4 8-9" {...p} />,
  Plus:     (p) => <Ic d="M10 4v12M4 10h12" {...p} />,
  Close:    (p) => <Ic d="M5 5l10 10M15 5L5 15" {...p} />,
  Chev:     (p) => <Ic d="M7 4l6 6-6 6" {...p} />,
  ChevDown: (p) => <Ic d="M4 7l6 6 6-6" {...p} />,
  Back:     (p) => <Ic d="M12 4l-6 6 6 6" {...p} />,
  Clock:    (p) => <Ic d="M10 5v5l3 2" {...p} stroke={p?.stroke || 'currentColor'} />,
  Calendar: (p) => <Ic d="M4 6h12v10H4zM4 6V4M16 6V4M4 9h12" {...p} />,
  Bell:     (p) => <Ic d="M5 9a5 5 0 0110 0v4l1 2H4l1-2V9zM8 17a2 2 0 004 0" {...p} />,
  Snooze:   (p) => <Ic d="M6 5h4l-4 6h4M12 5h4l-4 4h4" {...p} />,
  Repeat:   (p) => <Ic d="M4 7h9a3 3 0 013 3M16 13H7a3 3 0 01-3-3M13 4l3 3-3 3M7 16l-3-3 3-3" {...p} />,
  Trash:    (p) => <Ic d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10M9 9v5M11 9v5" {...p} />,
  Edit:     (p) => <Ic d="M4 16l2-1 8-8-1-1-8 8-1 2zM12 5l1 1" {...p} />,
  Voice:    (p) => <Ic d="M10 4a2 2 0 012 2v4a2 2 0 01-4 0V6a2 2 0 012-2zM6 9a4 4 0 008 0M10 13v3" {...p} />,
  Tag:      (p) => <Ic d="M4 10l6-6h6v6l-6 6-6-6zM13 7h.01" {...p} />,
  Notes:    (p) => <Ic d="M5 4h10v12H5zM8 8h4M8 11h4" {...p} />,
  Inbox:    (p) => <Ic d="M4 10l2-6h8l2 6v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM4 10h4l1 2h2l1-2h4" {...p} />,
  Home:     (p) => <Ic d="M4 9l6-5 6 5v7H4z" {...p} />,
  Cal2:     (p) => <Ic d="M4 5h12v11H4zM4 5V3M16 5V3" {...p} />,
  Settings: (p) => <Ic d="M10 7a3 3 0 100 6 3 3 0 000-6zM10 2v2M10 16v2M2 10h2M16 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" {...p} sw={1.3} />,
  Mic:      (p) => <Ic d="M10 3a2 2 0 012 2v5a2 2 0 01-4 0V5a2 2 0 012-2zM5 10a5 5 0 0010 0M10 15v3" {...p} />,
  Dots:     (p) => <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="16" cy="10" r="1.6"/></svg>,
  Flag:     (p) => <Ic d="M5 17V4h8l-1 3 1 3H5" {...p} />,
  Sparkle:  (p) => <Ic d="M10 3l1.5 3.5L15 8l-3.5 1.5L10 13l-1.5-3.5L5 8l3.5-1.5L10 3zM15 13l.7 1.5L17 15l-1.3.5L15 17l-.7-1.5L13 15l1.3-.5L15 13z" {...p} />,
  Undo:     (p) => <Ic d="M7 6L4 9l3 3M4 9h8a4 4 0 010 8" {...p} />,
  ArrowRight:(p)=> <Ic d="M4 10h12M12 6l4 4-4 4" {...p} />,
};

window.Icons = Icons;
