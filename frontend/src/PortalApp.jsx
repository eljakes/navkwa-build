import { useEffect, useMemo, useState } from 'react'
import { Building2, ClipboardList, FolderKanban, LogOut, MessageSquare, Send, ShieldCheck, Upload, WalletCards } from 'lucide-react'
import { portalApi, portalToken } from './lib/portalApi'
import './PortalApp.css'

const itemTypes = {
  client: ['approval_request', 'variation_request', 'rfi', 'meeting_minutes', 'invoice_query'],
  consultant: ['drawing_review', 'technical_comment', 'submittal', 'rfi', 'inspection_request', 'digital_approval'],
  supplier: ['purchase_order_acknowledgement', 'delivery_schedule', 'invoice_submission', 'payment_status_query', 'document_upload'],
  subcontractor: ['work_package_update', 'daily_report', 'safety_document', 'attendance_update', 'progress_update'],
  inspector: ['inspection_schedule', 'inspection_finding', 'compliance_report', 'inspection_signoff'],
  investor_owner: ['executive_report', 'budget_report', 'project_health_update'],
}

const label = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const errorText = (error) => Object.values(error?.errors || {}).flat().join(' ') || error.message
const accessRank = { view: 1, comment: 2, submit: 3, approve: 4, manage: 5 }
const canAccess = (access, required) => (accessRank[access?.access_level] || 0) >= accessRank[required]

export default function PortalApp() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const invite = params.get('invite')
  const reset = params.get('reset')
  const [session, setSession] = useState(null)
  const [mode, setMode] = useState(invite ? 'accept' : reset ? 'reset' : 'login')
  const [form, setForm] = useState({ company: params.get('company') || '', email: params.get('email') || '', password: '', password_confirmation: '', mfa_code: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      setSession(await portalApi.workspace())
    } catch (err) {
      portalToken(null)
      setSession(null)
      if (err.status !== 401) setError(errorText(err))
    }
  }

  useEffect(() => { if (portalToken()) load() }, [])

  async function authenticate(event) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      let result
      if (mode === 'accept') result = await portalApi.accept({ ...form, token: invite })
      else if (mode === 'reset') {
        await portalApi.reset({ ...form, token: reset }); setMode('login'); setNotice('Password reset. Sign in now.'); return
      } else if (mode === 'forgot') {
        const response = await portalApi.forgot(form); setNotice(response.message); return
      } else result = await portalApi.login(form)
      portalToken(result.token)
      window.history.replaceState({}, '', '/portal')
      await load()
    } catch (err) { setError(errorText(err)) } finally { setBusy(false) }
  }

  async function logout() {
    try { await portalApi.logout() } finally { portalToken(null); setSession(null) }
  }

  if (!session) return <PortalAuth mode={mode} setMode={setMode} form={form} setForm={setForm} submit={authenticate} error={error} notice={notice} busy={busy} />
  return <PortalWorkspace data={session} refresh={load} logout={logout} error={error} setError={setError} notice={notice} setNotice={setNotice} />
}

function PortalAuth({ mode, setMode, form, setForm, submit, error, notice, busy }) {
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  return <main className="external-portal auth-shell">
    <section className="portal-auth-card">
      <div className="portal-brand"><ShieldCheck /><div><strong>Navkwa Build Portal</strong><small>Secure external project access</small></div></div>
      <h1>{mode === 'accept' ? 'Accept your invitation' : mode === 'reset' ? 'Set a new password' : mode === 'forgot' ? 'Reset portal access' : 'Portal sign in'}</h1>
      <p>Access only the projects and workflows your construction team has shared with you.</p>
      {error && <div className="portal-alert error">{error}</div>}{notice && <div className="portal-alert success">{notice}</div>}
      <form onSubmit={submit} className="portal-form">
        <label>Company code<input name="company" value={form.company} onChange={change} required /></label>
        <label>Email<input type="email" name="email" value={form.email} onChange={change} required /></label>
        {mode !== 'forgot' && <label>Password<input type="password" name="password" value={form.password} onChange={change} required /></label>}
        {['accept', 'reset'].includes(mode) && <label>Confirm password<input type="password" name="password_confirmation" value={form.password_confirmation} onChange={change} required /></label>}
        {mode === 'login' && <label>MFA code <small>(if enabled)</small><input name="mfa_code" inputMode="numeric" value={form.mfa_code} onChange={change} /></label>}
        <button disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in securely' : mode === 'forgot' ? 'Send reset link' : 'Continue'}</button>
      </form>
      {!['accept', 'reset'].includes(mode) && <button className="portal-link" onClick={() => setMode(mode === 'forgot' ? 'login' : 'forgot')}>{mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}</button>}
    </section>
  </main>
}

function PortalWorkspace({ data, refresh, logout, error, setError, notice, setNotice }) {
  const [tab, setTab] = useState('overview')
  const user = data.portal_user
  const accesses = data.accesses || []
  const projectId = accesses[0]?.project_id || ''
  const act = async (action, message) => { setError(''); setNotice(''); try { await action(); setNotice(message); await refresh() } catch (err) { setError(errorText(err)) } }
  return <div className="external-portal portal-shell">
    <aside><div className="portal-brand"><Building2 /><div><strong>{user.company?.name}</strong><small>{label(user.user_type)} Portal</small></div></div>
      <nav>{[['overview', 'Overview', FolderKanban], ['work', 'Work items', ClipboardList], ['messages', 'Messages', MessageSquare], ['security', 'Security', ShieldCheck]].map(([key, text, Icon]) => <button className={tab === key ? 'active' : ''} onClick={() => setTab(key)} key={key}><Icon size={17} />{text}</button>)}</nav>
      <button className="portal-signout" onClick={logout}><LogOut size={17} />Sign out</button>
    </aside>
    <main><header><div><small>Welcome, {user.name}</small><h1>{label(tab)}</h1></div><span className="portal-pill">{label(user.user_type)}</span></header>
      {error && <div className="portal-alert error">{error}</div>}{notice && <div className="portal-alert success">{notice}</div>}
      {tab === 'overview' && <Overview data={data} act={act} />}
      {tab === 'work' && <WorkItems data={data} projectId={projectId} act={act} />}
      {tab === 'messages' && <Messages data={data} projectId={projectId} act={act} />}
      {tab === 'security' && <Security user={user} act={act} />}
    </main>
  </div>
}

function Overview({ data, act }) {
  const user = data.portal_user
  const canSubmit = (data.accesses || []).some((access) => canAccess(access, 'submit'))
  const canApprove = (data.accesses || []).some((access) => canAccess(access, 'approve'))
  return <div className="portal-stack"><section className="portal-metrics"><Metric name="Projects" value={data.accesses?.length || 0} /><Metric name="Open items" value={(data.work_items || []).filter((item) => !['completed', 'closed', 'approved'].includes(item.status)).length} /><Metric name="Messages" value={data.messages?.length || 0} /><Metric name="Enabled features" value={data.features?.length || 0} /></section>
    <Card title="Shared projects"><Table headers={['Project', 'Status', 'Progress', 'Access', 'Expires']} rows={(data.accesses || []).map((access) => [access.project?.name, label(access.project?.status), `${access.project?.progress_percent || 0}%`, label(access.access_level), access.expires_at ? new Date(access.expires_at).toLocaleDateString() : 'No expiry'])} /></Card>
    {user.user_type === 'client' && <><Card title="Approvals"><Table headers={['Request', 'Project', 'Status', 'Action']} rows={(data.client_approvals || []).map((approval) => [approval.title, approval.project?.name, label(approval.status), approval.status === 'submitted' && canApprove ? <span key={`approval-${approval.id}`} className="portal-actions"><button onClick={() => act(() => portalApi.reviewApproval(approval.id, { status: 'approved' }), 'Approval recorded.')}>Approve</button><button className="danger" onClick={() => act(() => portalApi.reviewApproval(approval.id, { status: 'changes_required', decision_notes: 'Changes requested through the portal.' }), 'Changes requested.')}>Request changes</button></span> : approval.status === 'submitted' ? 'Approval access required' : 'Recorded'])} /></Card>{canSubmit ? <Payments data={data} act={act} /> : <Card title="Payment submissions"><p>Your current access is read-only. Ask the project team to grant <strong>Submit</strong> access before submitting payment evidence for verification.</p></Card>}</>}
    {user.user_type === 'consultant' && <Card title="Consultant submittals"><Table headers={['Submittal', 'Project', 'Discipline', 'Status']} rows={(data.consultant_submittals || []).map((item) => [item.title, item.project?.name, label(item.discipline), label(item.status)])} /></Card>}
    {user.user_type === 'supplier' && <Card title="Purchase orders"><Table headers={['PO', 'Status', 'Delivery', 'Amount']} rows={(data.purchase_orders || []).map((item) => [item.po_number, label(item.status), label(item.delivery_status), item.total_amount])} /></Card>}
    {user.user_type === 'inspector' && <Card title="Inspections"><Table headers={['Inspection', 'Type', 'Status']} rows={(data.inspections || []).map((item) => [item.inspection_number, label(item.type), label(item.status)])} /></Card>}
  </div>
}

function WorkItems({ data, projectId, act }) {
  const eligibleAccesses = (data.accesses || []).filter((access) => canAccess(access, 'submit'))
  const [form, setForm] = useState({ project_id: eligibleAccesses[0]?.project_id || projectId, item_type: itemTypes[data.portal_user.user_type]?.[0] || '', title: '', description: '', file: null })
  const submit = (event) => { event.preventDefault(); const body = new FormData(); Object.entries(form).forEach(([key, value]) => value && body.append(key, value)); act(() => portalApi.submitWorkItem(body), 'Work item submitted.'); setForm((current) => ({ ...current, title: '', description: '', file: null })) }
  return <div className="portal-stack"><Card title="Submit to the project team">{eligibleAccesses.length ? <form className="portal-form portal-grid" onSubmit={submit}><label>Project<select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>{eligibleAccesses.map((access) => <option key={access.id} value={access.project_id}>{access.project?.name}</option>)}</select></label><label>Type<select value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })}>{(itemTypes[data.portal_user.user_type] || []).map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label><label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label><label>Attachment<input type="file" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} /></label><label className="wide">Details<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><button><Upload size={16} />Submit securely</button></form> : <p>Your access is read-only. Ask the project team to grant <strong>Submit</strong> access to send work items or files.</p>}</Card><Card title="Your work items"><Table headers={['Number', 'Title', 'Type', 'Status', 'Submitted']} rows={(data.work_items || []).map((item) => [item.item_number, item.title, label(item.item_type), label(item.status), new Date(item.created_at).toLocaleDateString()])} /></Card></div>
}

function Messages({ data, projectId, act }) {
  const eligibleAccesses = (data.accesses || []).filter((access) => canAccess(access, 'comment'))
  const [selectedProjectId, setSelectedProjectId] = useState(eligibleAccesses[0]?.project_id || projectId)
  const [message, setMessage] = useState('')
  const send = (event) => { event.preventDefault(); const body = new FormData(); body.append('project_id', selectedProjectId); body.append('message', message); act(() => portalApi.sendMessage(body), 'Message sent.'); setMessage('') }
  return <div className="portal-stack"><Card title="Message the project team">{eligibleAccesses.length ? <form className="portal-form" onSubmit={send}><label>Project<select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>{eligibleAccesses.map((access) => <option key={access.id} value={access.project_id}>{access.project?.name}</option>)}</select></label><label>Message<textarea value={message} onChange={(e) => setMessage(e.target.value)} required /></label><button><Send size={16} />Send</button></form> : <p>Your access is read-only. Ask the project team to grant <strong>Comment</strong> access or higher before sending messages.</p>}</Card><Card title="Conversation"><div className="portal-thread">{(data.messages || []).map((item) => <article key={item.id}><strong>{item.user_id ? 'Project team' : data.portal_user.name}</strong><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()}</small></article>)}</div></Card></div>
}

function Payments({ data, act }) {
  const eligibleAccesses = (data.accesses || []).filter((access) => canAccess(access, 'submit'))
  const first = eligibleAccesses[0]
  const [form, setForm] = useState({ project_id: first?.project_id || '', invoice_id: '', amount: '', currency: 'GHS', payment_method: 'bank_transfer', transaction_reference: '' })
  const submit = (event) => { event.preventDefault(); const body = new FormData(); Object.entries(form).forEach(([key, value]) => value && body.append(key, value)); act(() => portalApi.submitPayment(body), 'Payment evidence submitted for verification.') }
  return <Card title="Submit payment evidence"><form className="portal-form portal-grid" onSubmit={submit}><label>Project<select value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value, invoice_id: '' })}>{eligibleAccesses.map((access) => <option key={access.id} value={access.project_id}>{access.project?.name}</option>)}</select></label><label>Invoice<select value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}><option value="">General project payment</option>{(data.client_invoices || []).filter((invoice) => String(invoice.project_id) === String(form.project_id)).map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number}</option>)}</select></label><label>Amount<input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label><label>Method<select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile money</option><option value="cheque">Cheque</option><option value="card_reference">Card reference</option></select></label><label>Reference<input value={form.transaction_reference} onChange={(e) => setForm({ ...form, transaction_reference: e.target.value })} /></label><button><WalletCards size={16} />Submit for verification</button></form></Card>
}

function Security({ user, act }) {
  const [setup, setSetup] = useState(null); const [code, setCode] = useState('')
  return <Card title="Multi-factor authentication"><p>{user.mfa_enabled_at ? 'MFA is enabled for this portal account.' : 'Protect your external access with an authenticator app.'}</p>{!user.mfa_enabled_at && !setup && <button onClick={async () => setSetup(await portalApi.setupMfa())}>Set up MFA</button>}{setup && <div className="portal-form"><code>{setup.secret}</code><small>Add this secret to your authenticator app.</small><label>Verification code<input value={code} onChange={(e) => setCode(e.target.value)} /></label><button onClick={() => act(() => portalApi.enableMfa(code), 'MFA enabled.')}>Enable MFA</button></div>}</Card>
}

function Card({ title, children }) { return <section className="portal-card"><h2>{title}</h2>{children}</section> }
function Metric({ name, value }) { return <div><strong>{value}</strong><span>{name}</span></div> }
function Table({ headers, rows }) { return <div className="portal-table-wrap"><table><thead><tr>{headers.map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}{!rows.length && <tr><td colSpan={headers.length}>Nothing shared yet.</td></tr>}</tbody></table></div> }
