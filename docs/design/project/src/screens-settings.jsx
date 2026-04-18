// Settings screens — 4 screens: hub, notifications, region, connected

function SettingsHub({ theme, density }){
  return (
    <>
      <TgTopBar leftLabel="Close" title="Settings" onDots={()=>{}}/>
      <div className="app-scroll">

        <div className="set-hero">
          <div className="avatar">MK</div>
          <div className="who">
            <div className="name">Max Kowalski</div>
            <div className="handle">@maxkowalski</div>
            <a className="link">Edit profile <Icons.Chev size={12} sw={2.2}/></a>
          </div>
        </div>

        <div className="section-title"><span>Reminders</span></div>
        <div className="card">
          <div className="nav-row">
            <div className="ic"><Icons.Bell size={16}/></div>
            <div className="lbl">Notifications</div>
            <div className="val">All · 5m early</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row">
            <div className="ic warn"><Icons.Clock size={16}/></div>
            <div className="lbl">Quiet hours</div>
            <div className="val">10 PM – 7 AM</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row">
            <div className="ic green"><Icons.Repeat size={16}/></div>
            <div className="lbl">Overdue escalation</div>
            <div className="val">After 30m</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
        </div>

        <div className="section-title"><span>Organization</span></div>
        <div className="card">
          <div className="nav-row">
            <div className="ic"><Icons.Tag size={16}/></div>
            <div className="lbl">Categories</div>
            <div className="val">7</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row">
            <div className="ic"><Icons.Flag size={16}/></div>
            <div className="lbl">Priority levels</div>
            <div className="val">3 levels</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
        </div>

        <div className="section-title"><span>Region</span></div>
        <div className="card">
          <div className="nav-row">
            <div className="ic neutral"><Icons.Cal2 size={16}/></div>
            <div className="lbl">Time zone</div>
            <div className="val">New York</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row">
            <div className="ic neutral"><Icons.Clock size={16}/></div>
            <div className="lbl">Time format</div>
            <div className="val">12-hour</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row">
            <div className="ic neutral"><Icons.Tag size={16}/></div>
            <div className="lbl">Language</div>
            <div className="val">English (US)</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row">
            <div className="ic neutral"><Icons.Cal2 size={16}/></div>
            <div className="lbl">Week starts on</div>
            <div className="val">Monday</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
        </div>

        <div className="section-title"><span>Integrations</span></div>
        <div className="card">
          <div className="nav-row">
            <div className="ic"><Icons.Calendar size={16}/></div>
            <div className="lbl">Connected accounts</div>
            <div className="val">2 linked</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row">
            <div className="ic"><Icons.Sparkle size={16}/></div>
            <div className="lbl">AI suggestions</div>
            <div className="toggle on accent"/>
          </div>
          <div className="nav-row">
            <div className="ic"><Icons.Voice size={16}/></div>
            <div className="lbl">Voice transcription</div>
            <div className="val">English + RU</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
        </div>

        <div className="section-title"><span>Account</span></div>
        <div className="card">
          <div className="nav-row">
            <div className="ic neutral"><Icons.Inbox size={16}/></div>
            <div className="lbl">Export tasks</div>
            <div className="val">CSV · iCal</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row">
            <div className="ic neutral"><Icons.Notes size={16}/></div>
            <div className="lbl">Privacy & data</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row">
            <div className="ic danger"><Icons.Trash size={16}/></div>
            <div className="lbl" style={{color:'var(--danger)'}}>Delete all data</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
        </div>

        <div style={{padding:'20px 18px 10px', textAlign:'center', color:'var(--text-3)', font:'500 11px/1.5 JetBrains Mono, monospace'}}>
          remy v1.4.2 · tap logo 7× for debug
        </div>

      </div>
    </>
  );
}

function SettingsNotif({ theme, density }){
  const [nudge, setNudge] = useState(5);
  const [esc, setEsc] = useState(true);
  const [quiet, setQuiet] = useState(true);
  const [sound, setSound] = useState(true);
  const [preview, setPreview] = useState(true);
  return (
    <>
      <TgTopBar leftLabel="Back" title="Notifications"/>
      <div className="app-scroll">

        <div className="section-title"><span>Timing</span></div>
        <div className="card">
          <div className="nav-row">
            <div className="lbl">Early nudge</div>
            <div className="stepper">
              <button onClick={()=>setNudge(Math.max(0, nudge-5))}>−</button>
              <div className="v">{nudge}m</div>
              <button onClick={()=>setNudge(nudge+5)}>+</button>
            </div>
          </div>
          <div className="nav-row">
            <div className="lbl">Overdue escalation</div>
            <div className={`toggle${esc?' on':''}`} onClick={()=>setEsc(!esc)}/>
          </div>
          <div className="nav-row">
            <div className="lbl">Daily brief at 8 AM</div>
            <div className="toggle on"/>
          </div>
        </div>

        {esc && (
          <div className="escalation">
            <Icons.Sparkle size={16}/>
            <div className="t">
              If ignored, Remy will re-ping after <b>30 min</b>, then <b>1 hour</b>, then stop. You can change this inline when a reminder fires.
            </div>
          </div>
        )}

        <div className="section-title"><span>Quiet hours</span></div>
        <div className="quiet-visual">
          <div className="qv-head">
            <span className="lab">MUTED WINDOW</span>
            <span className="rng">22:00 → 07:00</span>
          </div>
          <div className="qv-bar">
            {/* 24h bar — quiet 22-07 wraps around; draw two segments */}
            <div className="quiet" style={{left:'0%', width:`${(7/24)*100}%`}}/>
            <div className="quiet" style={{left:`${(22/24)*100}%`, width:`${(2/24)*100}%`}}/>
            <div className="now" style={{left:`${(14.78/24)*100}%`}}/>
          </div>
          <div className="qv-ticks">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
          </div>
        </div>

        <div className="card">
          <div className="nav-row">
            <div className="lbl">Enable quiet hours</div>
            <div className={`toggle${quiet?' on':''}`} onClick={()=>setQuiet(!quiet)}/>
          </div>
          <div className="nav-row">
            <div className="lbl">From</div>
            <div className="val">10:00 PM</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row">
            <div className="lbl">Until</div>
            <div className="val">7:00 AM</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row">
            <div className="lbl">Queue & deliver in the morning</div>
            <div className="toggle on"/>
          </div>
          <div className="nav-row">
            <div className="lbl">Allow urgent only (flagged)</div>
            <div className={`toggle${preview?' on':''}`} onClick={()=>setPreview(!preview)}/>
          </div>
        </div>

        <div className="section-title"><span>Delivery</span></div>
        <div className="card">
          <div className="nav-row">
            <div className="lbl">Sound</div>
            <div className={`toggle${sound?' on':''}`} onClick={()=>setSound(!sound)}/>
          </div>
          <div className="nav-row">
            <div className="lbl">Show content preview</div>
            <div className="toggle on"/>
          </div>
          <div className="nav-row">
            <div className="lbl">Vibrate</div>
            <div className="toggle on"/>
          </div>
        </div>

        <div style={{height:12}}/>
      </div>
    </>
  );
}

function SettingsRegion({ theme, density }){
  const zones = [
    { city:'New York',     tz:'America/New_York',    off:'UTC−4', time:'2:47 PM', cur:true },
    { city:'London',       tz:'Europe/London',       off:'UTC+1', time:'7:47 PM' },
    { city:'Berlin',       tz:'Europe/Berlin',       off:'UTC+2', time:'8:47 PM' },
    { city:'Warsaw',       tz:'Europe/Warsaw',       off:'UTC+2', time:'8:47 PM' },
    { city:'Dubai',        tz:'Asia/Dubai',          off:'UTC+4', time:'10:47 PM' },
    { city:'Tashkent',     tz:'Asia/Tashkent',       off:'UTC+5', time:'11:47 PM' },
    { city:'Tokyo',        tz:'Asia/Tokyo',          off:'UTC+9', time:'3:47 AM' },
  ];
  return (
    <>
      <TgTopBar leftLabel="Back" title="Time zone" rightLabel="Auto"/>
      <div className="app-scroll">

        <div className="clock-card">
          <div className="clock">
            <div className="h"/>
            <div className="m"/>
          </div>
          <div className="info">
            <div className="tz">America/New_York</div>
            <div className="t">14:47:22</div>
            <div className="d">Friday, April 18 · UTC−4 · EDT</div>
          </div>
        </div>

        <div className="escalation">
          <Icons.Sparkle size={16}/>
          <div className="t">Remy uses this zone to parse times you send in chat. Say <b>"5 PM London time"</b> to override per-task.</div>
        </div>

        <div className="section-title"><span>Pick a zone</span></div>
        <div style={{margin:'0 12px 8px'}}>
          <div style={{
            display:'flex', alignItems:'center', gap:8, padding:'10px 12px',
            background:'var(--surface)', border:'1px solid var(--hairline)', borderRadius:12
          }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--text-3)" strokeWidth="1.7" strokeLinecap="round">
              <circle cx="9" cy="9" r="5"/><path d="M13 13l4 4"/>
            </svg>
            <span style={{font:'400 14px/1 Inter', color:'var(--text-3)'}}>Search city or zone…</span>
          </div>
        </div>

        <div className="card">
          {zones.map((z,i)=>(
            <div className="picker-row" key={i}>
              <div style={{flex:1}}>
                <div className="pl">{z.city}</div>
                <div className="pv" style={{fontSize:11, color:'var(--text-3)', marginTop:2}}>{z.tz}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="pv">{z.time}</div>
                <div style={{font:'500 10px/1 JetBrains Mono, monospace', color:'var(--text-3)', marginTop:3}}>{z.off}</div>
              </div>
              {z.cur && <div className="check" style={{marginLeft:8}}><Icons.Check size={16} sw={2.4}/></div>}
            </div>
          ))}
        </div>

        <div style={{height:12}}/>
      </div>
    </>
  );
}

function SettingsConnected({ theme, density }){
  return (
    <>
      <TgTopBar leftLabel="Back" title="Connected accounts"/>
      <div className="app-scroll">

        <div style={{padding:'6px 18px 0', color:'var(--text-2)', font:'400 13px/1.45 Inter'}}>
          Read-only calendars show up alongside your reminders so Remy knows when you're busy.
        </div>

        <div className="section-title"><span>Linked</span></div>
        <div className="card">
          <div className="nav-row conn-row">
            <div className="ic gcal">G</div>
            <div className="body">
              <div className="ti">Google Calendar</div>
              <div className="sub">max.k@gmail.com · 3 calendars · synced 2m ago</div>
            </div>
            <div className="status">Active</div>
          </div>
          <div className="nav-row conn-row">
            <div className="ic ical"></div>
            <div className="body">
              <div className="ti">iCloud Calendar</div>
              <div className="sub">maxk@icloud.com · 1 calendar · synced 14m ago</div>
            </div>
            <div className="status">Active</div>
          </div>
          <div className="nav-row conn-row">
            <div className="ic notion">N</div>
            <div className="body">
              <div className="ti">Notion</div>
              <div className="sub">Workspace "Personal" · paused</div>
            </div>
            <div className="status off">Paused</div>
          </div>
        </div>

        <div className="section-title"><span>Add new</span></div>
        <div className="card">
          <div className="nav-row conn-row">
            <div className="ic ghost"><Icons.Plus size={16}/></div>
            <div className="body">
              <div className="ti">Microsoft Outlook</div>
              <div className="sub">Calendar · Tasks · To-Do</div>
            </div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row conn-row">
            <div className="ic ghost"><Icons.Plus size={16}/></div>
            <div className="body">
              <div className="ti">Todoist</div>
              <div className="sub">Two-way sync for projects</div>
            </div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row conn-row">
            <div className="ic ghost"><Icons.Plus size={16}/></div>
            <div className="body">
              <div className="ti">Linear</div>
              <div className="sub">Sync tickets assigned to you</div>
            </div>
            <Icons.Chev size={14} className="chev"/>
          </div>
        </div>

        <div className="section-title"><span>Sync preferences</span></div>
        <div className="card">
          <div className="nav-row">
            <div className="lbl">Block time during events</div>
            <div className="toggle on"/>
          </div>
          <div className="nav-row">
            <div className="lbl">Avoid reminders during meetings</div>
            <div className="toggle on"/>
          </div>
          <div className="nav-row">
            <div className="lbl">Two-way sync (beta)</div>
            <div className="toggle"/>
          </div>
        </div>

        <div style={{padding:'14px 18px 10px', textAlign:'center'}}>
          <button style={{
            background:'transparent', border:0, color:'var(--danger)',
            font:'500 13px/1 Inter', cursor:'pointer', padding:8
          }}>Disconnect all accounts</button>
        </div>

        <div style={{height:12}}/>
      </div>
    </>
  );
}

Object.assign(window, { SettingsHub, SettingsNotif, SettingsRegion, SettingsConnected });
