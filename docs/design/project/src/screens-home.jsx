// Home — Variation A: Today list + overdue banner + stats
// Now with internal nav: home ↔ triage (Catch-up)

function HomeA({ theme, density, showOverdue=true, accent }) {
  const { seedTasks, NOW_LABEL, TODAY_LABEL } = window.Data;
  const [tasks, setTasks] = useState(seedTasks);
  const [nav, setNav] = useState('home'); // 'home' | 'triage'
  const [dismissBanner, setDismissBanner] = useState(false);

  const toggle = (t) => setTasks(xs => xs.map(x => x.id===t.id ? {...x, status: x.status==='done'?'pending':'done'} : x));

  const overdue = tasks.filter(t => t.status==='overdue');
  const todayPending = tasks.filter(t => t.status==='pending' && t.when >= -60);
  const done = tasks.filter(t => t.status==='done');

  const openTriage = () => setNav('triage');
  const backHome = () => setNav('home');

  if (nav === 'triage') {
    return <Triage onBack={backHome} tasks={overdue} onResolve={(id)=>{
      setTasks(xs => xs.map(x => x.id===id ? {...x, status:'done'} : x));
    }}/>;
  }

  const showCatchupBanner = overdue.length >= 2 && !dismissBanner;

  return (
    <>
      <TgTopBar
        leftLabel="Close"
        title="Remy"
        subtitle="minimini app"
        onDots={()=>{}}
      />
      <div className="app-scroll">
        <div className="greeting">
          <div className="hello">{TODAY_LABEL} · {NOW_LABEL}</div>
          <div className="big">Good afternoon, <em>Max</em></div>
        </div>

        <div className="stats">
          <div
            className={"stat tappable"+(overdue.length?" over":"")}
            onClick={overdue.length ? openTriage : undefined}
          >
            <div className={"n "+(overdue.length?"over":"")}>{overdue.length}</div>
            <div className="l">Overdue</div>
            {overdue.length>0 && (
              <div className="hint">CATCH UP <Icons.ArrowRight size={10} sw={2.4}/></div>
            )}
          </div>
          <div className="stat"><div className="n">{todayPending.length}</div><div className="l">Upcoming</div></div>
          <div className="stat"><div className="n">{done.length}</div><div className="l">Done today</div></div>
        </div>

        {showCatchupBanner && (
          <div className="catchup-banner" onClick={openTriage}>
            <div className="cb-close" onClick={(e)=>{ e.stopPropagation(); setDismissBanner(true);}}>
              <Icons.Close size={12} sw={2.4}/>
            </div>
            <div className="cb-ic"><Icons.Sparkle size={20}/></div>
            <div className="cb-body">
              <div className="cb-title">Catch up in 2 min</div>
              <div className="cb-sub">{overdue.length} overdue · review one at a time</div>
            </div>
            <div className="cb-arrow"><Icons.ArrowRight size={18} sw={2}/></div>
          </div>
        )}

        {showOverdue && overdue.length>0 && (
          <Section title="Overdue" count={overdue.length}
                   right={<span onClick={openTriage} style={{cursor:'pointer', color:'var(--accent)', font:'600 11px/1 Inter'}}>CATCH UP ↗</span>}>
            <div className="card">
              {overdue.map(t => <TaskRow key={t.id} t={t} onToggle={toggle} />)}
            </div>
          </Section>
        )}

        <Section title="Later today" count={todayPending.length}>
          <div className="card">
            {todayPending.length === 0
              ? <div className="empty">
                  <div className="em-ic"><Icons.Sparkle/></div>
                  <h4>Inbox zero for today</h4>
                  <p>Send Remy a message to capture anything new.</p>
                </div>
              : todayPending.map(t => <TaskRow key={t.id} t={t} onToggle={toggle} />)}
          </div>
        </Section>

        <Section title="Completed" count={done.length}>
          <div className="card">
            {done.map(t => <TaskRow key={t.id} t={t} onToggle={toggle} />)}
          </div>
        </Section>

        <div style={{height:20}}/>
      </div>

      <MainButton icon={<Icons.Plus size={16} sw={2.2}/>}>
        New reminder
      </MainButton>
    </>
  );
}

window.HomeA = HomeA;
