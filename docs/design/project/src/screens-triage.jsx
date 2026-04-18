// Variation C: Overdue-first triage stack

function Triage({ theme, density, onBack, tasks, onResolve }) {
  const { seedTasks } = window.Data;
  const overdue = tasks || seedTasks.filter(t => t.status==='overdue');
  const [i, setI] = useState(0);
  const total = overdue.length;
  const cur = overdue[i] || overdue[0];

  const next = () => {
    if (cur && onResolve) onResolve(cur.id);
    if (i >= total-1) { onBack?.(); return; }
    setI(x => x+1);
  };

  return (
    <>
      <TgTopBar
        leftLabel="Later"
        leftAction={onBack}
        title="Catch up"
        subtitle={`${Math.min(i+1,total)} of ${total} overdue`}
        rightLabel="Skip all"
        rightAction={onBack}
      />
      <div className="app-scroll" style={{padding:'8px 0 0'}}>
        <div style={{padding:'8px 18px 0', color:'var(--text-2)', font:'400 13px/1.4 Inter'}}>
          You have <b style={{color:'var(--text)'}}>{total} overdue</b>. Let's knock them out one by one.
        </div>

        <div className="triage-stack">
          {/* back card shadow */}
          {overdue.slice(i+1, i+3).map((t, idx) => (
            <div key={t.id} className="tri-card" style={{
              top: (idx+1)*10,
              transform:`scale(${1 - (idx+1)*0.04})`,
              opacity: 0.5 - idx*0.2,
              zIndex: 1,
            }}>
              <div style={{height:140}}/>
            </div>
          ))}
          {/* front card */}
          {cur && (
            <div className="tri-card" style={{ top:0, zIndex:5 }}>
              <div className="label">OVERDUE · {cur.time}</div>
              <div className="ti-title">{cur.title}</div>
              <div className="ti-meta">
                {cur.tag && <span className="pill tag"><Icons.Tag size={11} sw={2}/> {cur.tag}</span>}
                {cur.recur && <span className="pill tag"><Icons.Repeat size={11} sw={2}/> {cur.recur}</span>}
              </div>
              {cur.notes && <div className="ti-desc">{cur.notes}</div>}
            </div>
          )}
        </div>

        <div style={{padding:'16px 18px 6px', font:'600 11px/1 JetBrains Mono, monospace', color:'var(--text-2)', letterSpacing:'0.08em', textTransform:'uppercase'}}>
          Quick snooze
        </div>
        <div className="snooze-chips">
          {[
            {l:'+15m', t:'3:02 PM'},
            {l:'+1h',  t:'3:47 PM'},
            {l:'Tonight', t:'7:00 PM'},
            {l:'Tomorrow', t:'9:00 AM'},
          ].map((c,i)=>(
            <div className="chip" key={i} onClick={next}>
              {c.l}<span className="t">{c.t}</span>
            </div>
          ))}
        </div>

        <div className="tri-actions" style={{position:'static', padding:'12px 12px 8px'}}>
          <button className="danger" onClick={next}><Icons.Trash size={16}/>Delete</button>
          <button onClick={next}><Icons.Snooze size={16}/>Snooze</button>
          <button className="primary" onClick={next}><Icons.Check size={16} sw={2}/>Done</button>
        </div>
      </div>
    </>
  );
}

window.Triage = Triage;
