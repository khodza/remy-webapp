// Detail sheet — edit a task

function Detail({ theme, density }) {
  const [title, setTitle] = useState('Pick up prescription at Walgreens');
  const [notes, setNotes] = useState('Olivia mentioned they close at 9. Use pharmacy drive-through.');
  const [time,  setTime]  = useState('Today · 3:15 PM');
  return (
    <>
      <TgTopBar leftLabel="Back" title="Reminder" rightLabel="Save" onDots={()=>{}}/>
      <div className="app-scroll">

        <div className="detail-hero">
          <div className="h-title" contentEditable suppressContentEditableWarning
               onBlur={e=>setTitle(e.currentTarget.textContent)}>{title}</div>
          <div className="h-meta">
            <span className="pill time"><Icons.Clock size={11} sw={2}/> 3:15 PM · in 28 min</span>
            <span className="pill tag"><Icons.Tag size={11} sw={2}/> Errand</span>
          </div>
        </div>

        <div className="field-group">
          <div className="field">
            <div className="k">When</div>
            <div className="v"><Icons.Calendar size={16} stroke="var(--accent)"/>{time}</div>
            <Icons.Chev size={14} stroke="var(--text-3)"/>
          </div>
          <div className="field">
            <div className="k">Repeat</div>
            <div className="v" style={{color:'var(--text-2)'}}>Never</div>
            <Icons.Chev size={14} stroke="var(--text-3)"/>
          </div>
          <div className="field">
            <div className="k">Tag</div>
            <div className="v"><span className="pill tag"><Icons.Tag size={11} sw={2}/> Errand</span></div>
            <Icons.Chev size={14} stroke="var(--text-3)"/>
          </div>
          <div className="field">
            <div className="k">Priority</div>
            <div className="v" style={{color:'var(--text-2)'}}>Normal</div>
            <Icons.Chev size={14} stroke="var(--text-3)"/>
          </div>
        </div>

        <div className="section-title" style={{paddingTop:6}}>
          <span>Notes</span>
        </div>
        <div className="field-group">
          <div className="field edit" style={{alignItems:'flex-start', padding:'12px 14px'}}>
            <textarea rows={3} defaultValue={notes} style={{minHeight:60, font:'400 14px/1.5 Inter', color:'var(--text)'}}/>
          </div>
        </div>

        <div className="section-title"><span>Quick snooze</span></div>
        <div className="snooze-chips">
          <div className="chip">+15m<span className="t">3:30 PM</span></div>
          <div className="chip">+1h<span className="t">4:15 PM</span></div>
          <div className="chip">Tonight<span className="t">7:00 PM</span></div>
          <div className="chip">Tomorrow<span className="t">9:00 AM</span></div>
        </div>

        <div style={{padding:'14px 12px 0'}}>
          <div className="card plain" style={{padding:0}}>
            <div className="field" style={{color:'var(--danger)', cursor:'pointer'}}>
              <Icons.Trash size={16}/> <div className="v" style={{color:'var(--danger)'}}>Delete reminder</div>
            </div>
          </div>
        </div>

        <div style={{height:16}}/>
      </div>

      <MainButton icon={<Icons.Check size={16} sw={2.2}/>}>Mark as done</MainButton>
    </>
  );
}

window.Detail = Detail;
