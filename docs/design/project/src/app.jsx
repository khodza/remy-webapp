// App root — Design canvas showing all screens + Tweaks

const { useState: uS, useEffect: uE } = React;

const ACCENTS = {
  indigo: { h: 265 },
  amber:  { h: 60  },
  violet: { h: 305 },
  green:  { h: 150 },
  coral:  { h: 20  },
  mono:   { h: 265, mono: true },
};

function App(){
  const [theme, setTheme]   = uS('light');
  const [density, setDensity] = uS('cozy');
  const [accent, setAccent] = uS('indigo');
  const [showOver, setShowOver] = uS(true);
  const [tweaksOpen, setTweaksOpen] = uS(false);

  // Listen for edit-mode messages from host
  uE(()=>{
    const handler = (e)=>{
      if(!e.data) return;
      if(e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if(e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({type:'__edit_mode_available'}, '*');
    return ()=>window.removeEventListener('message', handler);
  }, []);

  // Apply accent CSS vars
  uE(()=>{
    const a = ACCENTS[accent];
    const root = document.documentElement;
    if (a.mono){
      root.style.setProperty('--accent', theme==='dark' ? '#F2F3F5' : '#0B0B0F');
      root.style.setProperty('--accent-soft', theme==='dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)');
      root.style.setProperty('--accent-fg', theme==='dark' ? '#0B0B0F' : '#fff');
    } else {
      const L = theme === 'dark' ? 72 : 62;
      const C = theme === 'dark' ? 0.13 : 0.14;
      const Lsoft = theme === 'dark' ? 30 : 94;
      const Csoft = theme === 'dark' ? 0.05 : 0.03;
      root.style.setProperty('--accent', `oklch(${L}% ${C} ${a.h})`);
      root.style.setProperty('--accent-soft', `oklch(${Lsoft}% ${Csoft} ${a.h})`);
      root.style.setProperty('--accent-fg', '#fff');
    }
  }, [accent, theme]);

  const push = (edits) => window.parent.postMessage({type:'__edit_mode_set_keys', edits}, '*');

  return (
    <>
      <div className="canvas">
        <div className="canvas-header">
          <h1>Remy — Telegram Mini App</h1>
          <span className="sub">3 flow variations · detail · create · {theme} · {accent}</span>
        </div>

        {/* Row 1: main flow screens */}
        <div className="grid">
          <Cell label="A" title="Today — list view">
            <Phone theme={theme} density={density} label="01 Home · List">
              <HomeA theme={theme} density={density} showOverdue={showOver}/>
            </Phone>
          </Cell>
          <Cell label="B" title="Today — timeline rail">
            <Phone theme={theme} density={density} label="02 Home · Timeline">
              <Timeline theme={theme} density={density}/>
            </Phone>
          </Cell>
          <Cell label="C" title="Catch-up — triage stack">
            <Phone theme={theme} density={density} label="03 Triage · Overdue">
              <Triage theme={theme} density={density}/>
            </Phone>
          </Cell>
        </div>

        <div style={{height:36}}/>

        <div className="grid">
          <Cell label="D" title="Task detail — edit">
            <Phone theme={theme} density={density} label="04 Detail · Edit">
              <Detail theme={theme} density={density}/>
            </Phone>
          </Cell>
          <Cell label="E" title="New reminder — NL first">
            <Phone theme={theme} density={density} label="05 Create · NL">
              <Create theme={theme} density={density}/>
            </Phone>
          </Cell>
          <Cell label="F" title="Upcoming — agenda">
            <Phone theme={theme} density={density} label="06 Upcoming · Agenda">
              <Agenda theme={theme} density={density}/>
            </Phone>
          </Cell>
        </div>

        <div className="canvas-header" style={{marginTop:48}}>
          <h1>Settings & profile</h1>
          <span className="sub">hub · notifications & quiet hours · time zone · connected accounts</span>
        </div>

        <div className="grid">
          <Cell label="G" title="Settings — hub">
            <Phone theme={theme} density={density} label="07 Settings · Hub">
              <SettingsHub theme={theme} density={density}/>
            </Phone>
          </Cell>
          <Cell label="H" title="Notifications & quiet hours">
            <Phone theme={theme} density={density} label="08 Settings · Notifications">
              <SettingsNotif theme={theme} density={density}/>
            </Phone>
          </Cell>
          <Cell label="I" title="Time zone & region">
            <Phone theme={theme} density={density} label="09 Settings · Region">
              <SettingsRegion theme={theme} density={density}/>
            </Phone>
          </Cell>
        </div>

        <div style={{height:36}}/>

        <div className="grid" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
          <Cell label="J" title="Connected accounts">
            <Phone theme={theme} density={density} label="10 Settings · Connected">
              <SettingsConnected theme={theme} density={density}/>
            </Phone>
          </Cell>
          <Cell label="K" title="Categories — list">
            <Phone theme={theme} density={density} label="11 Settings · Categories">
              <SettingsCategories theme={theme} density={density}/>
            </Phone>
          </Cell>
          <Cell label="L" title="Category — edit">
            <Phone theme={theme} density={density} label="12 Settings · Category edit">
              <CategoryEditorStandalone theme={theme} density={density}/>
            </Phone>
          </Cell>
        </div>
      </div>

      {/* Tweaks panel */}
      <div className={`tweaks${tweaksOpen?' open':''}`}>
        <h3>Tweaks</h3>
        <label>
          <span>Theme</span>
          <div className="seg">
            {['light','dark'].map(k=>(
              <button key={k} className={theme===k?'on':''} onClick={()=>setTheme(k)}>{k}</button>
            ))}
          </div>
        </label>
        <label>
          <span>Density</span>
          <div className="seg">
            {['cozy','compact'].map(k=>(
              <button key={k} className={density===k?'on':''} onClick={()=>setDensity(k)}>{k}</button>
            ))}
          </div>
        </label>
        <label style={{flexDirection:'column', alignItems:'flex-start', gap:6}}>
          <span>Accent</span>
          <div className="swatches">
            {Object.keys(ACCENTS).map(k=>{
              const a = ACCENTS[k];
              const bg = a.mono ? '#333' : `oklch(62% 0.14 ${a.h})`;
              return <button key={k} className={accent===k?'on':''} style={{background:bg}} onClick={()=>setAccent(k)} title={k}/>;
            })}
          </div>
        </label>
        <label>
          <span>Overdue banner</span>
          <div className="seg">
            <button className={showOver?'on':''} onClick={()=>setShowOver(true)}>on</button>
            <button className={!showOver?'on':''} onClick={()=>setShowOver(false)}>off</button>
          </div>
        </label>
      </div>
    </>
  );
}

function Cell({ label, title, children }){
  return (
    <div className="cell">
      <div className="cell-label">
        <span>{label}</span><span className="dot"/><b>{title}</b>
      </div>
      {children}
    </div>
  );
}

// Standalone wrapper to show the Category editor in the canvas
function CategoryEditorStandalone(){
  return <CategoryEditor
    cat={{ id:'c1', name:'Work', color:'indigo', count:14 }}
    onCancel={()=>{}}
    onSave={()=>{}}
    onDelete={()=>{}}
  />;
}

// Agenda (upcoming days list) — simple sixth screen
function Agenda({ theme, density }){
  const { upcomingDays } = window.Data;
  return (
    <>
      <TgTopBar leftLabel="Today" title="Upcoming" subtitle="next 7 days" rightLabel="Filter"/>
      <div className="app-scroll">
        {upcomingDays.map((d, i)=>(
          <div key={i}>
            <div className="section-title">
              <span>{d.day}</span>
              <span className="count">{d.date}</span>
            </div>
            <div className="card">
              {d.items.map((it, j)=>(
                <div className="task-row" key={j}>
                  <div className="check"/>
                  <div className="body">
                    <div className="t-title">{it.title}</div>
                    <div className="t-meta">
                      <span className="pill time"><Icons.Clock size={11} sw={2}/> {it.time}</span>
                      {it.tag && <span className="pill tag"><Icons.Tag size={11} sw={2}/> {it.tag}</span>}
                      {it.recur && <span className="pill tag"><Icons.Repeat size={11} sw={2}/> {it.recur}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{height:20}}/>
      </div>
      <MainButton icon={<Icons.Plus size={16} sw={2.2}/>}>New reminder</MainButton>
    </>
  );
}

/*EDITMODE-BEGIN*/const TWEAK_DEFAULTS = {
  "theme": "light",
  "density": "cozy",
  "accent": "indigo",
  "showOverdue": true
}/*EDITMODE-END*/;

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
