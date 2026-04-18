// Categories screen — manage task tags

const CAT_COLORS = [
  { k:'indigo', h:265 },
  { k:'violet', h:305 },
  { k:'coral',  h:20  },
  { k:'amber',  h:60  },
  { k:'green',  h:150 },
  { k:'teal',   h:200 },
  { k:'slate',  h:250, c:0.02 },
];

const CAT_ICONS = {
  Work:'💼', Personal:'🌿', Errand:'🛍', Home:'🏠', Health:'🩺',
  Finance:'💳', Learning:'📚', Family:'👨‍👩‍👧'
};

const INITIAL_CATS = [
  { id:'c1', name:'Work',     color:'indigo', count:14 },
  { id:'c2', name:'Personal', color:'green',  count:9 },
  { id:'c3', name:'Errand',   color:'amber',  count:5 },
  { id:'c4', name:'Home',     color:'coral',  count:4 },
  { id:'c5', name:'Health',   color:'teal',   count:3 },
  { id:'c6', name:'Finance',  color:'violet', count:2 },
  { id:'c7', name:'Learning', color:'slate',  count:1 },
];

function colorCss(k){
  const c = CAT_COLORS.find(x=>x.k===k);
  if(!c) return 'oklch(62% 0.14 265)';
  return `oklch(62% ${c.c ?? 0.14} ${c.h})`;
}

function SettingsCategories({ theme, density }){
  const [cats, setCats] = useState(INITIAL_CATS);
  const [editing, setEditing] = useState(null); // category being edited

  if (editing) {
    return <CategoryEditor
      cat={editing}
      onCancel={()=>setEditing(null)}
      onSave={(next)=>{
        setCats(xs => xs.map(c => c.id===next.id ? next : c));
        setEditing(null);
      }}
      onDelete={(id)=>{
        setCats(xs => xs.filter(c => c.id !== id));
        setEditing(null);
      }}
    />;
  }

  return (
    <>
      <TgTopBar leftLabel="Back" title="Categories" rightLabel="Done"/>
      <div className="app-scroll">
        <div style={{padding:'6px 18px 0', color:'var(--text-2)', font:'400 13px/1.45 Inter'}}>
          Organize tasks with categories. Remy will suggest one when you say things like "for work" or "at home" in chat.
        </div>

        <div className="section-title">
          <span>Your categories</span>
          <span className="count">{cats.length}</span>
        </div>
        <div className="card">
          {cats.map(c => (
            <div className="cat-row" key={c.id} onClick={()=>setEditing(c)}>
              <div className="swatch" style={{background:colorCss(c.color)}}>
                <span style={{fontSize:15}}>{CAT_ICONS[c.name] || '◦'}</span>
              </div>
              <div className="body">
                <div className="ti">{c.name}</div>
                <div className="sub">{c.count} task{c.count===1?'':'s'}</div>
              </div>
              <div className="count-pill">{c.count}</div>
              <svg width="14" height="18" viewBox="0 0 14 18" className="drag" fill="currentColor">
                <circle cx="4" cy="4"  r="1.3"/><circle cx="10" cy="4"  r="1.3"/>
                <circle cx="4" cy="9"  r="1.3"/><circle cx="10" cy="9"  r="1.3"/>
                <circle cx="4" cy="14" r="1.3"/><circle cx="10" cy="14" r="1.3"/>
              </svg>
            </div>
          ))}
          <div className="add-row" onClick={()=>setEditing({ id:'new'+Date.now(), name:'', color:'indigo', count:0 })}>
            <div className="plus-sq"><Icons.Plus size={16} sw={2.2}/></div>
            Add category
          </div>
        </div>

        <div className="section-title"><span>Behavior</span></div>
        <div className="card">
          <div className="nav-row">
            <div className="lbl">Auto-suggest from chat</div>
            <div className="toggle on accent"/>
          </div>
          <div className="nav-row">
            <div className="lbl">Show uncategorized</div>
            <div className="toggle on"/>
          </div>
          <div className="nav-row">
            <div className="lbl">Default category</div>
            <div className="val">Personal</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
          <div className="nav-row">
            <div className="lbl">Sort by</div>
            <div className="val">Most used</div>
            <Icons.Chev size={14} className="chev"/>
          </div>
        </div>

        <div style={{height:16}}/>
      </div>
    </>
  );
}

function CategoryEditor({ cat, onCancel, onSave, onDelete }){
  const [name, setName] = useState(cat.name || '');
  const [color, setColor] = useState(cat.color || 'indigo');
  const isNew = cat.id.startsWith('new');

  return (
    <>
      <TgTopBar
        leftLabel="Cancel" leftAction={onCancel}
        title={isNew ? 'New category' : 'Edit category'}
        rightLabel="Save" rightAction={()=>onSave({...cat, name: name.trim() || 'Untitled', color})}
      />
      <div className="app-scroll">

        <div style={{padding:'18px 18px 8px', display:'flex', alignItems:'center', gap:14}}>
          <div className="swatch" style={{
            width:64, height:64, borderRadius:16,
            background:colorCss(color),
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:28, boxShadow:'0 8px 20px rgba(0,0,0,0.1)'
          }}>
            {CAT_ICONS[name] || '◦'}
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{font:'500 11px/1 JetBrains Mono, monospace', color:'var(--text-2)', letterSpacing:'0.06em', textTransform:'uppercase'}}>PREVIEW</div>
            <div style={{marginTop:8, display:'flex', gap:6, flexWrap:'wrap'}}>
              <span className="pill" style={{background:colorCss(color), color:'#fff', borderColor:'transparent'}}>
                {name || 'Untitled'}
              </span>
              <span className="pill tag">7 tasks</span>
            </div>
          </div>
        </div>

        <div className="section-title"><span>Name</span></div>
        <div className="field-group" style={{padding:'4px 0'}}>
          <div className="field edit" style={{
            padding:'14px 16px',
            display:'flex', alignItems:'center', gap:12
          }}>
            <div style={{
              width:30, height:30, borderRadius:8,
              background:'var(--accent-soft)', color:'var(--accent)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
            }}>
              <Icons.Tag size={16}/>
            </div>
            <input
              type="text"
              value={name}
              onChange={e=>setName(e.target.value.slice(0, 24))}
              placeholder="e.g. Side project"
              autoFocus
              style={{
                flex:1, minWidth:0, border:0, outline:'none', background:'transparent',
                font:'500 17px/1.3 Inter', letterSpacing:'-0.015em', color:'var(--text)',
                padding:'4px 0'
              }}
            />
            <span style={{
              font:'500 11px/1 JetBrains Mono, monospace', color:'var(--text-3)',
              flexShrink:0, fontVariantNumeric:'tabular-nums'
            }}>{name.length}/24</span>
          </div>
        </div>
        <div style={{padding:'4px 18px 0', font:'400 12px/1.4 Inter', color:'var(--text-2)'}}>
          Shown as a tag on every task in this category.
        </div>

        <div className="section-title"><span>Color</span></div>
        <div className="card" style={{padding:'4px 0'}}>
          <div className="color-grid">
            {CAT_COLORS.map(c => (
              <button
                key={c.k}
                className={color===c.k ? 'on' : ''}
                onClick={()=>setColor(c.k)}
                style={{background: colorCss(c.k)}}
                aria-label={c.k}
              />
            ))}
          </div>
        </div>

        <div className="section-title"><span>Icon</span></div>
        <div className="card">
          <div className="color-grid" style={{gridTemplateColumns:'repeat(8, 1fr)'}}>
            {['💼','🌿','🛍','🏠','🩺','💳','📚','👨‍👩‍👧','✏️','🎯','🏃','🍳','🎨','🧘','✈️','☕'].map((em,i)=>(
              <button key={i} style={{
                background:'var(--surface-2)', fontSize:18, display:'flex',
                alignItems:'center', justifyContent:'center'
              }}>{em}</button>
            ))}
          </div>
        </div>

        {!isNew && (
          <>
            <div className="section-title"><span>Triggers</span></div>
            <div className="card">
              <div className="nav-row">
                <div className="lbl">Auto-tag when chat mentions</div>
                <Icons.Chev size={14} className="chev"/>
              </div>
              <div style={{padding:'4px 14px 12px', display:'flex', gap:6, flexWrap:'wrap'}}>
                {['work','office','standup','boss','deadline'].map(k=>(
                  <span key={k} className="pill tag" style={{fontFamily:'JetBrains Mono, monospace'}}>#{k}</span>
                ))}
                <span className="pill tag" style={{color:'var(--accent)', borderColor:'var(--accent)', borderStyle:'dashed'}}>+ add</span>
              </div>
            </div>

            <div style={{padding:'14px 12px 0'}}>
              <div className="card plain" style={{padding:0}}>
                <div className="field" style={{color:'var(--danger)', cursor:'pointer'}} onClick={()=>onDelete(cat.id)}>
                  <Icons.Trash size={16}/>
                  <div className="v" style={{color:'var(--danger)'}}>Delete category</div>
                </div>
              </div>
              <div style={{padding:'8px 6px 16px', color:'var(--text-2)', font:'400 11px/1.4 Inter'}}>
                Tasks in this category will become uncategorized. This can't be undone.
              </div>
            </div>
          </>
        )}

        <div style={{height:20}}/>
      </div>
    </>
  );
}

Object.assign(window, { SettingsCategories });
