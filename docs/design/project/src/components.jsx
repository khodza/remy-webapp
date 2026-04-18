// Shared components used across screens

const { useState, useEffect, useRef, useMemo } = React;

// Telegram-style top bar (original, not Telegram-branded)
function TgTopBar({ leftLabel='Close', leftAction, title, subtitle, rightLabel, rightAction, theme='light', onDots }) {
  return (
    <div className="tg-topbar">
      <div className="side">
        {leftLabel && (
          <button className="tg-btn" onClick={leftAction}>{leftLabel}</button>
        )}
      </div>
      <div className="title">
        {title && <div className="name">{title}</div>}
        {subtitle && <div className="meta">{subtitle}</div>}
      </div>
      <div className="side right">
        {rightLabel && <button className="tg-btn" onClick={rightAction}>{rightLabel}</button>}
        {onDots && <button className="icon-btn" onClick={onDots}><Icons.Dots size={18}/></button>}
      </div>
    </div>
  );
}

// Phone shell with theme + density applied
function Phone({ theme='light', density='cozy', children, label }) {
  return (
    <div className={`phone theme-${theme} density-${density}`} data-screen-label={label}>
      {children}
    </div>
  );
}

// MainButton area (Telegram Mini App convention)
function MainButton({ children, onClick, variant='primary', icon }) {
  return (
    <div className="tg-mainbutton">
      <button className={variant === 'ghost' ? 'ghost' : ''} onClick={onClick}>
        {icon}{children}
      </button>
    </div>
  );
}

// Task row (A / default list style)
function TaskRow({ t, onToggle, onOpen }) {
  const cls = 't' + (t.status === 'done' ? ' done' : '') + (t.status === 'overdue' ? ' overdue' : '');
  return (
    <div className={`task-row${t.status==='done'?' done':''}${t.status==='overdue'?' overdue':''}`} onClick={onOpen}>
      <div className="check" onClick={(e)=>{ e.stopPropagation(); onToggle?.(t); }}>
        {t.status==='done' && <Icons.Check size={14} sw={2.2}/>}
      </div>
      <div className="body">
        <div className="t-title">{t.title}</div>
        <div className="t-meta">
          {t.status==='overdue'
            ? <span className="pill overdue"><Icons.Clock size={11} sw={2}/> {t.time} · overdue</span>
            : <span className="pill time"><Icons.Clock size={11} sw={2}/> {t.time}</span>
          }
          {t.tag && <span className="pill tag"><Icons.Tag size={11} sw={2}/> {t.tag}</span>}
          {t.recur && <span className="pill tag"><Icons.Repeat size={11} sw={2}/> {t.recur}</span>}
          {t.flag && <span className="pill tag" style={{color:'var(--warn)'}}><Icons.Flag size={11} sw={2}/></span>}
        </div>
      </div>
    </div>
  );
}

// Section title
function Section({ title, count, children, right }) {
  return (
    <>
      <div className="section-title">
        <span>{title}</span>
        <span className="count">{right || count}</span>
      </div>
      {children}
    </>
  );
}

Object.assign(window, { TgTopBar, Phone, MainButton, TaskRow, Section });
