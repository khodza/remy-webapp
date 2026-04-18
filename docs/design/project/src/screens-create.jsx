// Create — natural language first, with AI parse preview

function Create({ theme, density }) {
  const [text, setText] = useState('Remind me to call mom tomorrow at 5 PM');
  const parsed = useMemo(()=> parseNL(text), [text]);

  return (
    <>
      <TgTopBar leftLabel="Cancel" title="New reminder" rightLabel="Add"/>
      <div className="app-scroll" style={{padding:'8px 0 0'}}>

        <div className="form-title">What should Remy remember?</div>
        <div className="form-subtitle">Type naturally — Remy picks up the time, person, and repeat for you.</div>

        <div className="nl-input">
          <textarea
            value={text}
            onChange={e=>setText(e.target.value)}
            placeholder="e.g. Water plants every Sunday morning"
          />
          <div className="nl-hint">{text.length} chars</div>
        </div>

        {parsed && (
          <div className="nl-parse">
            <div className="ic"><Icons.Sparkle size={16}/></div>
            <div className="txt">
              Parsed as <b>{parsed.title}</b> · <b>{parsed.when}</b>
              {parsed.recur && <> · <b>{parsed.recur}</b></>}
            </div>
          </div>
        )}

        <div className="section-title"><span>Or set manually</span></div>
        <div className="field-group">
          <div className="field">
            <div className="k">When</div>
            <div className="v"><Icons.Calendar size={16} stroke="var(--accent)"/>Tomorrow</div>
            <Icons.Chev size={14} stroke="var(--text-3)"/>
          </div>
          <div className="field">
            <div className="k">Time</div>
            <div className="v"><Icons.Clock size={16} stroke="var(--accent)"/>5:00 PM</div>
            <Icons.Chev size={14} stroke="var(--text-3)"/>
          </div>
          <div className="field">
            <div className="k">Repeat</div>
            <div className="v" style={{color:'var(--text-2)'}}>Never</div>
            <Icons.Chev size={14} stroke="var(--text-3)"/>
          </div>
          <div className="field">
            <div className="k">Tag</div>
            <div className="v" style={{color:'var(--text-2)'}}>Personal</div>
            <Icons.Chev size={14} stroke="var(--text-3)"/>
          </div>
        </div>

        <div className="section-title"><span>Suggestions</span></div>
        <div className="card">
          {[
            {t:'Ping Dana about the lease paperwork', w:'Thu, 2 PM'},
            {t:'Buy flowers for Amal\'s birthday',     w:'Sat'},
            {t:'Cancel trial before 30 Apr',           w:'Apr 30'},
          ].map((s,i)=>(
            <div className="task-row" key={i}>
              <div style={{width:22,height:22,borderRadius:6, background:'var(--accent-soft)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)', marginTop:2, flexShrink:0}}>
                <Icons.Plus size={14} sw={2.2}/>
              </div>
              <div className="body">
                <div className="t-title">{s.t}</div>
                <div className="t-meta">
                  <span className="pill time"><Icons.Clock size={11} sw={2}/> {s.w}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{height:20}}/>
      </div>

      <MainButton icon={<Icons.Check size={16} sw={2.2}/>}>Add reminder</MainButton>
    </>
  );
}

// Tiny fake NL parser for preview
function parseNL(text){
  if(!text) return null;
  const lc = text.toLowerCase();
  let title = text.replace(/^remind\s+me\s+to\s+/i,'').trim();
  title = title.split(/\b(tomorrow|today|tonight|next|every|at|on)\b/i)[0].trim();
  let when = 'Later';
  if (/tomorrow/i.test(lc)) when = 'Tomorrow';
  else if (/tonight/i.test(lc)) when = 'Tonight';
  else if (/today/i.test(lc)) when = 'Today';
  const tMatch = lc.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (tMatch) when += ` · ${tMatch[1]}${tMatch[2]?':'+tMatch[2]:''} ${tMatch[3].toUpperCase()}`;
  let recur = null;
  if (/every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|day|week|month)/i.test(lc)){
    recur = 'Repeats ' + lc.match(/every\s+\w+/i)[0];
  }
  return { title: title.charAt(0).toUpperCase()+title.slice(1), when, recur };
}

window.Create = Create;
