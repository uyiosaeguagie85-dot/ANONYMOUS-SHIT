import { useEffect, useMemo, useState } from 'react'
import { Ghost, Search, Plus, Flame, Clock3, ShieldCheck, Heart, MessageCircle, Upload, X, LogIn, Trash2, Flag, Sparkles, Image as ImageIcon, LogOut } from 'lucide-react'
import { supabase, isConfigured } from './supabase'

const demoPosts = [
  { id: 'demo-1', body: 'Some days you just need to disappear for a bit and come back stronger.', created_at: new Date(Date.now()-1000*60*12).toISOString(), likes_count: 128, comments_count: 14, media_url: null, media_type: null, author: 'ghost_8f2', demo: true },
  { id: 'demo-2', body: 'Unpopular opinion: midnight is the best time to think about literally everything.', created_at: new Date(Date.now()-1000*60*48).toISOString(), likes_count: 92, comments_count: 9, media_url: null, media_type: null, author: 'unknown.exe', demo: true },
  { id: 'demo-3', body: 'Reminder that you are allowed to start over. Nobody has to get a press release.', created_at: new Date(Date.now()-1000*60*130).toISOString(), likes_count: 76, comments_count: 6, media_url: null, media_type: null, author: 'moonlit', demo: true }
]

function ago(date) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000))
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes/60)}h ago`
  return `${Math.floor(minutes/1440)}d ago`
}

export default function App() {
  const [posts, setPosts] = useState(demoPosts)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('latest')
  const [query, setQuery] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [body, setBody] = useState('')
  const [media, setMedia] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [liked, setLiked] = useState([])
  const [adminMode, setAdminMode] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [reports, setReports] = useState([])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) { setProfile(null); setAdmin(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase) return
    loadPosts()
  }, [])

  useEffect(() => {
    if (session?.user) checkAdmin()
  }, [session])

  async function loadPosts() {
    if (!supabase) return
    const { data, error } = await supabase.from('posts').select('id, body, created_at, media_url, media_type, user_id, likes_count, comments_count').eq('is_removed', false).order('created_at', { ascending: false }).limit(60)
    if (!error && data) setPosts(data.map(p => ({...p, author: `ghost_${String(p.user_id || '').slice(0,5) || 'anon'}`})))
  }

  async function checkAdmin() {
    if (!supabase || !session?.user) return
    const { data } = await supabase.from('app_admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
    setAdmin(Boolean(data))
  }

  async function signInAnonymous() {
    if (!supabase) return setNotice('Connect Supabase first using the README setup steps.')
    const { error } = await supabase.auth.signInAnonymously()
    setNotice(error ? error.message : 'You are posting anonymously.')
  }

  async function signInGoogle() {
    if (!supabase) return setNotice('Connect Supabase first using the README setup steps.')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) setNotice(error.message)
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setNotice('Signed out.')
  }

  async function publish() {
    if (!body.trim() && !media) return setNotice('Write something or attach a photo/video first.')
    if (!supabase) return setNotice('The preview is running, but publishing needs Supabase configured.')
    if (!session) return signInAnonymous()
    setBusy(true)
    try {
      let media_url = null
      let media_type = null
      if (media) {
        const safeName = `${session.user.id}/${Date.now()}-${media.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error: uploadError } = await supabase.storage.from('post-media').upload(safeName, media, { upsert: false, contentType: media.type })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('post-media').getPublicUrl(safeName)
        media_url = data.publicUrl
        media_type = media.type.startsWith('video/') ? 'video' : 'image'
      }
      const { error } = await supabase.from('posts').insert({ body: body.trim(), media_url, media_type, user_id: session.user.id })
      if (error) throw error
      setBody(''); setMedia(null); setComposerOpen(false)
      await loadPosts()
      setNotice('Posted. You are officially a ghost 👻')
    } catch (e) { setNotice(e.message || 'Could not publish post.') }
    finally { setBusy(false) }
  }

  async function likePost(post) {
    if (liked.includes(post.id)) return
    setLiked(prev => [...prev, post.id])
    if (supabase && !post.demo) {
      const { error } = await supabase.rpc('increment_post_likes', { post_id: post.id })
      if (!error) loadPosts()
    } else {
      setPosts(prev => prev.map(p => p.id === post.id ? {...p, likes_count: (p.likes_count || 0) + 1} : p))
    }
  }

  async function reportPost(post) {
    const reason = window.prompt('Why are you reporting this post? (spam, harassment, unsafe, other)')
    if (!reason) return
    if (!supabase || post.demo) return setNotice('Reports are saved once Supabase is connected.')
    if (!session) return signInAnonymous()
    const { error } = await supabase.from('reports').insert({ post_id: post.id, reporter_id: session.user.id, reason: reason.slice(0,240) })
    setNotice(error ? error.message : 'Report submitted for review.')
  }

  async function deletePost(post) {
    if (!supabase || post.demo) {
      setPosts(prev => prev.filter(p => p.id !== post.id))
      return
    }
    const { error } = await supabase.from('posts').update({ is_removed: true }).eq('id', post.id)
    setNotice(error ? error.message : 'Post removed.')
    if (!error) loadPosts()
  }

  async function loadReports() {
    if (!supabase || !admin) return
    const { data, error } = await supabase.from('reports').select('id, reason, created_at, post_id, posts(body)').eq('status','open').order('created_at',{ascending:false})
    if (error) setNotice(error.message)
    else setReports(data || [])
  }

  async function resolveReport(report, remove) {
    if (!supabase || !admin) return
    if (remove) await supabase.from('posts').update({is_removed:true}).eq('id', report.post_id)
    const { error } = await supabase.from('reports').update({status:'resolved'}).eq('id', report.id)
    setNotice(error ? error.message : 'Report resolved.')
    loadReports(); loadPosts()
  }

  const visiblePosts = useMemo(() => {
    let result = [...posts]
    if (query.trim()) result = result.filter(p => (p.body || '').toLowerCase().includes(query.toLowerCase()))
    if (tab === 'trending') result.sort((a,b) => (b.likes_count || 0) - (a.likes_count || 0))
    return result
  }, [posts, query, tab])

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#"><span className="brand-icon"><Ghost size={23}/></span><span>ghost<span className="brand-accent">post</span><small>leave a trace, not a name</small></span></a>
      <button className={`nav-item ${!adminMode ? 'active' : ''}`} onClick={() => setAdminMode(false)}><Sparkles size={18}/> The Feed</button>
      <button className={`nav-item ${adminMode ? 'active' : ''}`} onClick={() => {setAdminMode(true); loadReports()}}><ShieldCheck size={18}/> Admin room {admin && <span className="admin-dot"/>}</button>
      <div className="sidebar-spacer"/>
      <div className="side-card"><div className="side-card-icon"><Ghost size={20}/></div><b>Your identity stays in the shadows.</b><p>Keep it kind. The internet is still made of people.</p></div>
      <div className="side-bottom">{session ? <button className="text-button" onClick={signOut}><LogOut size={16}/> Sign out</button> : <button className="text-button" onClick={signInAnonymous}><LogIn size={16}/> Enter anonymously</button>}<span className="status"><i/> {isConfigured ? 'System online' : 'Preview mode'}</span></div>
    </aside>

    <main className="main">
      <header className="topbar"><div><div className="eyebrow">THE INTERNET, WITHOUT THE INTRODUCTIONS</div><h1>{adminMode ? 'Admin room' : 'The feed'}<span className="title-glow">.</span></h1></div><button className="avatar" title="Sign in with Google for admin access" onClick={signInGoogle}><ShieldCheck size={19}/></button></header>
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}

      {adminMode ? <section className="admin-panel">
        <div className="admin-banner"><ShieldCheck size={25}/><div><h2>Restricted area</h2><p>{admin ? `Signed in as ${session?.user?.email || 'administrator'}` : 'Sign in with your approved Google account. Admin access is verified by the database.'}</p></div></div>
        {!admin ? <div className="empty-state"><ShieldCheck size={36}/><h3>Admin access required</h3><p>Use the shield button in the top corner to sign in with Google. Your email must be added to the secure admin table before this area unlocks.</p><button className="primary-button" onClick={signInGoogle}><LogIn size={17}/> Continue with Google</button></div> :
        <><div className="stats-grid"><div><small>OPEN REPORTS</small><strong>{reports.length}</strong></div><div><small>FEED POSTS</small><strong>{posts.filter(p=>!p.demo).length}</strong></div><div><small>ROLE</small><strong>ADMIN</strong></div></div><h3 className="section-title">Open reports</h3>
          {reports.length === 0 ? <p className="muted">No reports loaded. You're all caught up, or tap refresh.</p> : reports.map(r=><div className="report-row" key={r.id}><div><b>{r.posts?.body || 'Post unavailable'}</b><p>{r.reason} · {ago(r.created_at)}</p></div><button onClick={()=>resolveReport(r,false)}>Resolve</button><button className="danger-button" onClick={()=>resolveReport(r,true)}>Remove post</button></div>)}
          <button className="secondary-button" onClick={loadReports}>Refresh reports</button>
        </>}
      </section> : <>
        <div className="hero-card"><div className="hero-orb orb-one"/><div className="hero-orb orb-two"/><div className="hero-content"><div className="hero-tag"><span/> NO NAMES. NO PRESSURE.</div><h2>Say it without<br/><em>saying who.</em></h2><p>A little corner of the internet for thoughts, stories, and things you just need to get out.</p><button className="primary-button" onClick={() => setComposerOpen(true)}><Plus size={18}/> Drop a post</button></div><div className="hero-ghost"><Ghost size={112} strokeWidth={1.1}/><span className="ghost-spark spark-a">✦</span><span className="ghost-spark spark-b">✧</span></div></div>

        <div className="feed-toolbar"><div className="tabs"><button className={tab==='latest'?'selected':''} onClick={()=>setTab('latest')}><Clock3 size={16}/> Latest</button><button className={tab==='trending'?'selected':''} onClick={()=>setTab('trending')}><Flame size={16}/> Trending</button></div><label className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search the shadows"/></label></div>

        <section className="feed-list">{visiblePosts.map(post=><article className="post-card" key={post.id}><div className="post-head"><div className="mini-avatar"><Ghost size={18}/></div><div><b>{post.author || 'anonymous'}</b><span>{ago(post.created_at)} <i>·</i> <span className="anon-label">ANONYMOUS</span></span></div><button className="icon-button more" title="Report post" onClick={()=>reportPost(post)}><Flag size={17}/></button></div><p className="post-body">{post.body}</p>{post.media_url && (post.media_type==='video' ? <video className="post-media" src={post.media_url} controls /> : <img className="post-media" src={post.media_url} alt="Anonymous post attachment" />)}<div className="post-actions"><button className={liked.includes(post.id)?'liked':''} onClick={()=>likePost(post)}><Heart size={17} fill={liked.includes(post.id)?'currentColor':'none'}/>{post.likes_count || 0}</button><button onClick={()=>setNotice('Comments are coming in the next setup pass.')}><MessageCircle size={17}/>{post.comments_count || 0}</button>{(admin || (session?.user?.id && post.user_id===session.user.id)) && <button className="delete-action" onClick={()=>deletePost(post)}><Trash2 size={16}/> Remove</button>}</div></article>)}
          {visiblePosts.length===0 && <div className="empty-state"><Ghost size={32}/><h3>No ghosts found</h3><p>Try a different search.</p></div>}
        </section>
      </>}
      <footer>GHOSTPOST <span>·</span> MADE FOR THE UNHEARD <span>·</span> BE KIND OUT THERE</footer>
    </main>

    <aside className="right-rail"><div className="rail-top"><span className="live-pulse"/> LIVE FROM THE VOID</div><div className="trend-card"><div className="trend-title"><Flame size={18}/> Trending now</div><div className="trend-topic"><span>#01</span><div><b>late night thoughts</b><small>2.4k ghosts talking</small></div></div><div className="trend-topic"><span>#02</span><div><b>confessions</b><small>1.8k ghosts talking</small></div></div><div className="trend-topic"><span>#03</span><div><b>school & life</b><small>964 ghosts talking</small></div></div></div><div className="privacy-card"><ShieldCheck size={21}/><b>Anonymous by design</b><p>Your public profile doesn't need your real name. Don't share personal details in posts or images.</p></div><div className="rail-foot">A shadow is still a person.<br/>Treat each other accordingly. ♡</div></aside>

    {composerOpen && <div className="modal-backdrop" onClick={()=>setComposerOpen(false)}><section className="composer modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">NEW TRANSMISSION</span><h2>Drop your thoughts.</h2></div><button className="icon-button" onClick={()=>setComposerOpen(false)}><X size={20}/></button></div><textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={2000} placeholder="What's on your mind, ghost?"/><div className="composer-bottom"><label className="attach-button"><Upload size={17}/> Add photo/video<input type="file" accept="image/*,video/*" onChange={e=>setMedia(e.target.files?.[0] || null)}/></label><span>{body.length}/2000</span></div>{media && <div className="file-chip"><ImageIcon size={15}/>{media.name}<button onClick={()=>setMedia(null)}><X size={14}/></button></div>}<div className="composer-note"><Ghost size={16}/> Posting anonymously. Keep personal info out of your post.</div><button className="primary-button publish-button" disabled={busy} onClick={publish}>{busy?'Sending…':'Send into the void'} <span>↗</span></button></section></div>}
  </div>
}
