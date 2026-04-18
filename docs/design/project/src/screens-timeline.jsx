// Variation B: Timeline rail for today

function Timeline({ theme, density }) {
  const { timelineToday, TODAY_LABEL } = window.Data;
  return (
    <>
      <TgTopBar
        leftLabel="Close"
        title="Today"
        subtitle={TODAY_LABEL}
        rightLabel="Week"
        rightAction={()=>{}}
      />
      <div className="app-scroll">
        <div className="stats" style={{marginBottom:10}}>
          <div className="stat"><div className="n over">2</div><div className="l">Overdue</div></div>
          <div className="stat"><div className="n">5</div><div className="l">To go</div></div>
          <div className="stat"><div className="n">2</div><div className="l">Done</div></div>
        </div>

        <div className="tl-rail">
          {timelineToday.map((it, i) => {
            if (it.state === 'now') {
              return (
                <div className="tl-group" key={i} style={{marginBottom:14, position:'relative'}}>
                  <div className="tl-time" style={{color:'var(--danger)'}}>
                    {it.time}<span className="ampm">{it.ampm}</span>
                  </div>
                  <div className="tl-dot overdue"/>
                  <div style={{
                    padding:'4px 0', font:'600 11px/1 JetBrains Mono, monospace',
                    color:'var(--danger)', letterSpacing:'0.08em', textTransform:'uppercase'
                  }}>
                    NOW
                  </div>
                </div>
              );
            }
            return (
              <div className="tl-group" key={i}>
                <div className="tl-time">
                  {it.time}<span className="ampm">{it.ampm}</span>
                </div>
                <div className={`tl-dot ${it.state==='overdue'?'overdue':it.state==='done'?'past':''}`}/>
                <div className={`tl-card ${it.state==='done'?'done':''}`}>
                  <div className="tl-title">{it.title}</div>
                  <div className="tl-meta">
                    {it.state==='overdue' && <span className="pill overdue">overdue</span>}
                    {it.tag && <span className="pill tag"><Icons.Tag size={11} sw={2}/> {it.tag}</span>}
                    {it.recur && <span className="pill tag"><Icons.Repeat size={11} sw={2}/> {it.recur}</span>}
                    {it.flag && <span className="pill tag" style={{color:'var(--warn)'}}><Icons.Flag size={11} sw={2}/></span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{padding:'6px 24px 20px', color:'var(--text-3)', font:'500 11px/1.4 JetBrains Mono, monospace', textAlign:'center'}}>
          end of today · swipe down for tomorrow
        </div>
      </div>

      <MainButton icon={<Icons.Plus size={16} sw={2.2}/>}>New reminder</MainButton>
    </>
  );
}

window.Timeline = Timeline;
