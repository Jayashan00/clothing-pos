import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { UserCog, Plus, Pencil, ShieldCheck, History } from 'lucide-react';
import { db } from '../db/db';
import { useT } from '../i18n';
import { useAuth, ROLES, PERMS, hashPin } from '../store/auth';
import { uid, fmtDateTime } from '../lib/util';
import { Modal, toast, Field, Tabs, Toggle, Empty } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';

export default function Users() {
  const t = useT();
  const me = useAuth((s) => s.user);
  const [tab, setTab] = useState('users');
  const users = useLiveQuery(() => db.users.toArray(), []) || [];
  const log = useLiveQuery(() => (tab === 'audit' ? db.audit.orderBy('date').reverse().limit(300).toArray() : []), [tab]) || [];
  const uMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const [edit, setEdit] = useState(null);

  const save = async () => {
    const u = { ...edit, username: edit.username.trim().toLowerCase() };
    if (!u.name.trim() || !u.username) return toast.err(t('users.fill'));
    const dup = await db.users.where('username').equals(u.username).first();
    if (dup && dup.id !== u.id) return toast.err(t('users.taken'));
    if (edit._new && !/^\d{4,6}$/.test(edit.pin || '')) return toast.err(t('users.pinRule'));
    if (edit.pin && !/^\d{4,6}$/.test(edit.pin)) return toast.err(t('users.pinRule'));
    const admins = users.filter((x) => x.role === 'admin' && x.active && x.id !== u.id);
    if (!admins.length && (u.role !== 'admin' || !u.active)) return toast.err(t('users.lastAdmin'));
    const row = { id: u.id, name: u.name.trim(), username: u.username, role: u.role, active: u.active, pinHash: u.pinHash };
    if (edit.pin) row.pinHash = await hashPin(u.id, edit.pin);
    await db.users.put(row); toast.ok(t('common.saved')); setEdit(null);
  };

  return (
    <Page>
      <PageHeader title={t('nav.users')} help="users" icon={<UserCog size={24} />} actions={tab === 'users' ? <button className="btn btn-primary" onClick={() => setEdit({ id: uid(), name: '', username: '', role: 'cashier', active: true, pin: '', _new: true })}><Plus size={18} /> {t('users.add')}</button> : null} />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'users', label: t('nav.users') }, { id: 'roles', label: t('users.roles') }, { id: 'audit', label: t('users.audit') }]} /></div>
      {tab === 'users' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.map((u) => (
            <div key={u.id} className={`card p-4 flex items-center gap-3 ${u.active ? '' : 'opacity-50'}`}>
              <span className="w-12 h-12 rounded-full bg-saffron-500 text-ink grid place-items-center text-xl font-bold">{u.name.slice(0, 1)}</span>
              <div className="flex-1 min-w-0"><p className="font-bold truncate">{u.name} {u.id === me.id ? <span className="badge badge-green">{t('users.you')}</span> : null}</p><p className="text-sm muted">@{u.username}</p><span className="badge badge-blue">{t('role.' + u.role)}</span></div>
              <button className="icon-btn" onClick={() => setEdit({ ...u, pin: '' })} aria-label={t('common.edit')}><Pencil size={18} /></button>
            </div>
          ))}
        </div>
      ) : null}
      {tab === 'roles' ? (
        <div className="grid md:grid-cols-2 gap-3">
          {ROLES.map((r) => (
            <div key={r} className="card p-4"><p className="font-bold flex items-center gap-2 mb-2"><ShieldCheck size={18} className="text-indigo-600" /> {t('role.' + r)}</p>
              <p className="text-sm muted mb-2">{t('roleDesc.' + r)}</p>
              <div className="flex flex-wrap gap-1">{PERMS[r].includes('*') ? <span className="badge badge-green">{t('users.everything')}</span> : PERMS[r].map((p) => <span key={p} className="badge badge-blue">{t('perm.' + p)}</span>)}</div></div>
          ))}
        </div>
      ) : null}
      {tab === 'audit' ? (
        <div className="card overflow-x-auto">
          {!log.length ? <Empty icon={<History size={28} />} title={t('users.noAudit')} /> : (
            <table className="table"><thead><tr><th>{t('common.date')}</th><th>{t('common.user')}</th><th>{t('users.action')}</th><th>{t('users.details')}</th></tr></thead>
              <tbody>{log.map((a) => <tr key={a.id}><td className="text-sm whitespace-nowrap">{fmtDateTime(a.date)}</td><td>{uMap[a.userId] || '—'}</td><td><span className="badge badge-blue">{a.action}</span></td><td className="text-sm">{a.details}</td></tr>)}</tbody></table>
          )}
        </div>
      ) : null}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._new ? t('users.add') : t('users.edit')} size="sm" icon={<UserCog size={20} />}
        footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('common.save')}</button></>}>
        {edit ? <div className="space-y-3">
          <Field label={t('cust.name')}><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label={t('users.username')}><input className="input" value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} autoCapitalize="none" /></Field>
          <Field label={t('users.role')}><select className="input" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{t('role.' + r)}</option>)}</select></Field>
          <Field label={edit._new ? t('users.pin') : t('users.newPin')} hint={t('users.pinRule')}><input className="input text-xl tracking-widest" type="password" inputMode="numeric" maxLength={6} value={edit.pin} onChange={(e) => setEdit({ ...edit, pin: e.target.value.replace(/\D/g, '') })} /></Field>
          {edit.id !== me.id ? <Toggle label={t('users.active')} checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} /> : null}
        </div> : null}
      </Modal>
    </Page>
  );
}
