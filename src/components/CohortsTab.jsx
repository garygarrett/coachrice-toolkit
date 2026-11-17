import { useState, useEffect, useMemo } from 'react'
import { authFetch } from '../lib/authFetch'
import { emptyForm, missingItems } from '../lib/sof/formSpec'
import ObservationViewer from './ObservationViewer'
import LoadingBar from './LoadingBar'

// Admin > Users / Access Codes > Cohorts.
// An admin builds a cohort, types in the participant names (names only, no accounts), and assigns mentor
// coaches. The table shows each participant's Session Observation Form #1, #2, and #3 and who did them.
const C = { navy: '#00205B', gray: '#7C7E7F', border: '#e2e6ec', soft: '#f0f2f5', muted: '#6b7a99', lime: '#c9d647', orange: '#ff8200', blue: '#69cce6' }
const font = 'Montserrat, sans-serif'
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px', marginBottom: 16 }
const h2 = { fontSize: '1.05rem', fontWeight: 700, color: C.navy, margin: '0 0 10px', fontFamily: font }
const small = { fontSize: 13, color: C.muted, fontFamily: font }
const input = { padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem', fontFamily: font, background: '#fff', color: '#111' }
const primary = (off) => ({ background: off ? '#9aa6bd' : C.navy, color: '#fff', border: 'none', borderRadius: 6, padding: '0.55rem 1.2rem', fontSize: '0.9rem', fontWeight: 600, cursor: off ? 'not-allowed' : 'pointer', fontFamily: font })
const ghost = { background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: '0.85rem', cursor: 'pointer', color: '#374151', fontFamily: font }
const danger = { ...ghost, border: '1px solid #fca5a5', color: '#dc2626' }
const th = { textAlign: 'left', padding: '0.7rem 0.9rem', background: '#f9fafb', color: '#6b7280', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb', fontFamily: font }
const td = { padding: '0.7rem 0.9rem', color: '#374151', verticalAlign: 'middle', fontSize: '0.88rem', fontFamily: font, borderBottom: '1px solid #f0f2f5' }
const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const ROLE_LABEL = { mentor: 'Mentor coach', admin_tools: 'Admin (tools)', admin: 'Admin' }
// A to Z, ignoring capital letters.
const az = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' })

async function call(action, body) {
  const res = await authFetch(`/api/user-actions?action=${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Something went wrong (status ${res.status})`)
  return json
}

export default function CohortsTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [newName, setNewName] = useState('')
  const [renameValue, setRenameValue] = useState(null) // null = not renaming
  const [namesText, setNamesText] = useState('')
  const [mentorIds, setMentorIds] = useState([])
  const [codeIds, setCodeIds] = useState([]) // access codes (people who have not signed up yet) checked for this cohort
  const [newMentorKey, setNewMentorKey] = useState('') // mentor coach for names typed in "Add participants": 'u:<account id>' or 'c:<access code id>'
  const [editingPerson, setEditingPerson] = useState(null) // { id, name }
  const [record, setRecord] = useState(null)

  async function load(keepSelected = true) {
    setError('')
    try {
      const j = await call('cohort-admin-load')
      setData(j)
      setSelectedId((cur) => (keepSelected && j.cohorts.some((c) => c.id === cur) ? cur : [...j.cohorts].sort((a, b) => az(a.name, b.name))[0]?.id || ''))
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load(false) }, [])

  const cohort = data?.cohorts.find((c) => c.id === selectedId) || null
  const people = useMemo(() => (data ? data.participants.filter((p) => p.cohort_id === selectedId).sort((a, b) => az(a.full_name, b.full_name)) : []), [data, selectedId])
  const cohortsAZ = useMemo(() => [...(data?.cohorts || [])].sort((a, b) => az(a.name, b.name)), [data])
  const mentorsAZ = useMemo(() => [...(data?.mentors || [])].sort((a, b) => az(a.full_name || a.email, b.full_name || b.email)), [data])
  const mentorName = useMemo(() => Object.fromEntries((data?.mentors || []).map((m) => [m.id, m.full_name || m.email])), [data])
  const codesAZ = useMemo(() => [...(data?.pendingCodes || [])].sort((a, b) => az(a.label, b.label)), [data])
  const codeName = useMemo(() => Object.fromEntries((data?.pendingCodes || []).map((c) => [c.id, c.label])), [data])
  // 'u:<id>' = a signed-up mentor coach, 'c:<id>' = a mentor coach who has an access code but has not signed up yet.
  const keyOf = (p) => (p.mentor_id ? `u:${p.mentor_id}` : p.mentor_code_id ? `c:${p.mentor_code_id}` : '')
  const nameOfKey = (key) => (key.startsWith('u:') ? mentorName[key.slice(2)] : codeName[key.slice(2)]) || 'the mentor coach'
  const splitKey = (key) => ({ mentorId: key.startsWith('u:') ? key.slice(2) : null, mentorCodeId: key.startsWith('c:') ? key.slice(2) : null })

  const savedMentorIds = useMemo(() => (data ? data.assignments.filter((a) => a.cohort_id === selectedId).map((a) => a.user_id) : []), [data, selectedId])
  const savedMentorKey = [...savedMentorIds].sort().join(',')
  // Only mentor coaches assigned to this cohort can be given its participants.
  const savedCodeIds = useMemo(() => (data ? data.codeAssignments.filter((a) => a.cohort_id === selectedId).map((a) => a.code_id) : []), [data, selectedId])
  const savedCodeKey = [...savedCodeIds].sort().join(',')
  // Everyone a participant can be given to in this cohort, A to Z: signed-up mentor coaches and people still waiting to sign up.
  const mentorOptions = useMemo(() => [
    ...mentorsAZ.filter((m) => savedMentorIds.includes(m.id)).map((m) => ({ key: `u:${m.id}`, label: m.full_name || m.email })),
    ...codesAZ.filter((c) => savedCodeIds.includes(c.id)).map((c) => ({ key: `c:${c.id}`, label: `${c.label} (not signed up yet)` })),
  ].sort((a, b) => az(a.label, b.label)), [mentorsAZ, codesAZ, savedMentorIds, savedCodeIds])
  const unassignedCount = people.filter((p) => !p.mentor_id && !p.mentor_code_id).length

  // Switching cohorts clears any half-finished edits.
  useEffect(() => { setRenameValue(null); setEditingPerson(null); setNamesText(''); setNewMentorKey('') }, [selectedId])
  // The mentor checklist follows what is saved. It resets only when you switch cohorts or the saved list changes,
  // so unsaved checkbox changes survive other reloads (like adding a participant).
  useEffect(() => { setMentorIds(savedMentorKey ? savedMentorKey.split(',') : []) }, [selectedId, savedMentorKey])
  useEffect(() => { setCodeIds(savedCodeKey ? savedCodeKey.split(',') : []) }, [selectedId, savedCodeKey])

  const mentorsChanged = mentorIds.length !== savedMentorIds.length || mentorIds.some((id) => !savedMentorIds.includes(id))
    || codeIds.length !== savedCodeIds.length || codeIds.some((id) => !savedCodeIds.includes(id))

  // Observations by participant and form number.
  const forms = useMemo(() => {
    const m = {}
    ;(data?.observations || []).forEach((o) => { m[`${o.participant_id}:${o.form_number}`] = o })
    return m
  }, [data])

  async function run(label, fn, success) {
    setBusy(label); setError(''); setNotice('')
    try { await fn(); if (success) setNotice(success) } catch (e) { setError(e.message) }
    setBusy('')
  }

  const createCohort = () => run('create', async () => {
    const j = await call('cohort-save', { name: newName })
    setNewName('')
    await load(false)
    setSelectedId(j.cohort.id)
  }, 'Cohort created. Add participant names and assign mentor coaches below.')

  const renameCohort = () => run('rename', async () => {
    await call('cohort-save', { id: cohort.id, name: renameValue })
    setRenameValue(null)
    await load()
  }, 'Cohort renamed.')

  const deleteCohort = () => {
    const count = people.length
    const saved = (data?.observations || []).filter((o) => people.some((p) => p.id === o.participant_id)).length
    const msg = `Delete the cohort "${cohort.name}"?\n\nThis removes its ${count} participant name${count === 1 ? '' : 's'} and mentor assignments.` +
      (saved ? `\n${saved} saved observation${saved === 1 ? '' : 's'} will be kept, but will no longer be linked to a participant.` : '')
    if (!window.confirm(msg)) return
    run('delete', async () => { await call('cohort-delete', { id: cohort.id }); await load(false) }, 'Cohort deleted.')
  }

  const addNames = () => {
    const names = namesText.split(/\r?\n|;/).map((n) => n.trim()).filter(Boolean)
    run('add', async () => {
      const j = await call('participants-add', { cohortId: cohort.id, names, ...splitKey(newMentorKey) })
      setNamesText('')
      await load()
      setNotice(`Added ${j.added.length} participant${j.added.length === 1 ? '' : 's'}${j.skipped ? ` (${j.skipped} skipped: blank or already in this cohort)` : ''}.`)
    })
  }

  const savePerson = () => run('person', async () => {
    await call('participant-update', { id: editingPerson.id, full_name: editingPerson.name })
    setEditingPerson(null)
    await load()
  }, 'Name updated.')

  const removePerson = (p) => {
    const saved = [1, 2, 3].filter((n) => forms[`${p.id}:${n}`]).length
    const msg = `Remove ${p.full_name} from this cohort?` + (saved ? `\n\n${saved} saved observation${saved === 1 ? '' : 's'} will be kept, but will no longer be linked to a participant.` : '')
    if (!window.confirm(msg)) return
    run('remove', async () => { await call('participant-delete', { id: p.id }); await load() }, 'Participant removed.')
  }

  const saveMentors = () => run('mentors', async () => {
    const j = await call('cohort-mentors-set', { cohortId: cohort.id, userIds: mentorIds, codeIds })
    await load()
    setNotice(j.unassigned
      ? `Mentor coaches saved. ${j.unassigned} participant${j.unassigned === 1 ? '' : 's'} lost their mentor coach and ${j.unassigned === 1 ? 'is' : 'are'} now unassigned. Assign them in the table below.`
      : 'Mentor coaches saved.')
  })

  const setMentor = (p, key) => run(`mentor-${p.id}`, async () => {
    await call('participants-mentor-set', { ids: [p.id], ...splitKey(key) })
    await load()
  }, key
    ? `${p.full_name} assigned to ${nameOfKey(key)}.${key.startsWith('c:') ? ' They move to that mentor coach\u2019s account when they sign up.' : ''}`
    : `${p.full_name} is now unassigned.`)

  async function openObservation(id) {
    setBusy(`open-${id}`); setError('')
    try { setRecord(await call('obs-admin-get', { id })) } catch (e) { setError(e.message) }
    setBusy('')
  }

  if (record) return <ObservationViewer record={record} onBack={() => setRecord(null)} />

  const completeCount = people.reduce((n, p) => n + [1, 2, 3].filter((k) => {
    const o = forms[`${p.id}:${k}`]
    return o && missingItems({ ...emptyForm(), ...(o.form || {}) }).length === 0
  }).length, 0)

  return (
    <div style={{ fontFamily: font }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: C.navy, margin: 0 }}>Cohorts</h1>
      </div>
      <p style={{ ...small, marginTop: 0 }}>
        Build a cohort, type in the participant names, check the mentor coaches who work with it, then assign each participant to
        one mentor coach. A mentor coach sees only their own participants when they start a Session Observation Form, and picks
        Form #1, #2, or #3. Participants are names only. They do not sign in.
      </p>

      {error && <div style={{ background: '#fef2f2', color: '#b42318', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {notice && <div style={{ background: '#f0f9e8', color: '#3f6212', border: `1px solid ${C.lime}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{notice}</div>}
      {!data && !error && <LoadingBar />}

      {data && (
        <>
          <div style={card}>
            <h2 style={h2}>Choose or create a cohort</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {data.cohorts.length > 0 && (
                <select style={{ ...input, minWidth: 260 }} value={selectedId} onChange={(e) => setSelectedId(e.target.value)} aria-label="Cohort">
                  {cohortsAZ.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <input style={{ ...input, flex: '1 1 240px', maxWidth: 360 }} value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="New cohort name, e.g. CoachRICE Spring 2027" onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) createCohort() }} />
              <button style={primary(!newName.trim() || busy === 'create')} disabled={!newName.trim() || busy === 'create'} onClick={createCohort}>+ Create cohort</button>
            </div>
            {data.cohorts.length === 0 && <p style={{ ...small, margin: '12px 0 0' }}>No cohorts yet. Create the first one above.</p>}
          </div>

          {cohort && (
            <>
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {renameValue === null ? (
                    <>
                      <h2 style={{ ...h2, margin: 0, fontSize: '1.3rem', flex: 1 }}>{cohort.name}</h2>
                      <button style={ghost} onClick={() => setRenameValue(cohort.name)}>Rename</button>
                      <button style={danger} onClick={deleteCohort} disabled={busy === 'delete'}>Delete cohort</button>
                    </>
                  ) : (
                    <>
                      <input style={{ ...input, flex: 1, minWidth: 220 }} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                      <button style={primary(!renameValue.trim() || busy === 'rename')} disabled={!renameValue.trim() || busy === 'rename'} onClick={renameCohort}>Save name</button>
                      <button style={ghost} onClick={() => setRenameValue(null)}>Cancel</button>
                    </>
                  )}
                </div>
                <p style={{ ...small, margin: '8px 0 0' }}>
                  {people.length} participant{people.length === 1 ? '' : 's'} · {completeCount} of {people.length * 3} observation forms complete
                </p>
              </div>

              <div style={card}>
                <h2 style={h2}>Mentor coaches for this cohort</h2>
                <p style={{ ...small, margin: '0 0 10px' }}>Check the mentor coaches who work with this cohort, then save. You then give each participant to one of them in the table below. A mentor coach sees only the participants assigned to them.</p>
                {data.mentors.length === 0 && codesAZ.length === 0 && <p style={small}>No mentor coaches yet. Create a Mentor Coach access code in the Access Codes tab. You can assign participants to it right away.</p>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                  {mentorsAZ.map((m) => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontFamily: font, color: '#0f1c3a', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', background: mentorIds.includes(m.id) ? '#eef6ff' : '#fff' }}>
                      <input type="checkbox" checked={mentorIds.includes(m.id)}
                        onChange={(e) => setMentorIds((ids) => (e.target.checked ? [...ids, m.id] : ids.filter((x) => x !== m.id)))} />
                      <span>
                        <strong>{m.full_name || m.email}</strong>
                        <span style={{ display: 'block', fontSize: 11.5, color: C.muted }}>{ROLE_LABEL[m.role] || m.role}{m.is_active === false ? ' · Paused' : ''}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {codesAZ.length > 0 && (
                  <>
                    <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, margin: '16px 0 4px' }}>Has an access code, not signed up yet</div>
                    <p style={{ ...small, margin: '0 0 8px' }}>
                      Check someone here to give them this cohort&rsquo;s participants before they sign up. When they sign up with their access code,
                      the cohort and their participants move to their account automatically.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                      {codesAZ.map((c) => (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontFamily: font, color: '#0f1c3a', border: `1px dashed ${C.gray}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', background: codeIds.includes(c.id) ? '#fff7ed' : '#fff' }}>
                          <input type="checkbox" checked={codeIds.includes(c.id)}
                            onChange={(e) => setCodeIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id)))} />
                          <span>
                            <strong>{c.label}</strong>
                            <span style={{ display: 'block', fontSize: 11.5, color: C.muted }}>{c.role === 'admin' ? 'Admin access code' : 'Mentor coach access code'} · Not signed up yet</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
                {(data.mentors.length > 0 || codesAZ.length > 0) && (
                  <div style={{ marginTop: 12 }}>
                    <button style={primary(!mentorsChanged || busy === 'mentors')} disabled={!mentorsChanged || busy === 'mentors'} onClick={saveMentors}>
                      {busy === 'mentors' ? 'Saving…' : 'Save mentor coaches'}
                    </button>
                  </div>
                )}
              </div>

              <div style={card}>
                <h2 style={h2}>Add participants</h2>
                <p style={{ ...small, margin: '0 0 8px' }}>Type or paste names, one per line. Names already in this cohort are skipped.</p>
                <textarea style={{ ...input, width: '100%', minHeight: 100, resize: 'vertical', boxSizing: 'border-box' }} value={namesText}
                  onChange={(e) => setNamesText(e.target.value)} placeholder={'Jane Smith\nAlex Rivera'} />
                <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ ...small, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Mentor coach for these names
                    <select style={{ ...input, minWidth: 220 }} value={newMentorKey} onChange={(e) => setNewMentorKey(e.target.value)} aria-label="Mentor coach for new participants">
                      <option value="">Assign later</option>
                      {mentorOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  </label>
                  <button style={primary(!namesText.trim() || busy === 'add')} disabled={!namesText.trim() || busy === 'add'} onClick={addNames}>
                    {busy === 'add' ? 'Adding…' : 'Add participants'}
                  </button>
                </div>
                {mentorOptions.length === 0 && <p style={{ ...small, margin: '8px 0 0' }}>Check and save at least one mentor coach above to assign participants to them.</p>}
              </div>

              <div style={{ marginBottom: 8, ...h2 }}>Participants and their observation forms</div>
              {unassignedCount > 0 && (
                <div style={{ background: '#fff7ed', color: '#9a3412', border: `1px solid ${C.orange}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 10 }}>
                  {unassignedCount} participant{unassignedCount === 1 ? ' has' : 's have'} no mentor coach yet. No mentor coach can see them until you assign one in the Mentor coach column.
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <thead>
                  <tr>
                    <th style={th}>Participant</th>
                    <th style={th}>Mentor coach</th>
                    <th style={th}>Form #1</th>
                    <th style={th}>Form #2</th>
                    <th style={th}>Form #3</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.id}>
                      <td style={{ ...td, fontWeight: 600, color: C.navy }}>
                        {editingPerson?.id === p.id ? (
                          <span style={{ display: 'flex', gap: 6 }}>
                            <input style={{ ...input, padding: '0.35rem 0.5rem', width: 190 }} value={editingPerson.name} autoFocus
                              onChange={(e) => setEditingPerson({ id: p.id, name: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter' && editingPerson.name.trim()) savePerson() }} />
                            <button style={primary(!editingPerson.name.trim())} disabled={!editingPerson.name.trim()} onClick={savePerson}>Save</button>
                            <button style={ghost} onClick={() => setEditingPerson(null)}>Cancel</button>
                          </span>
                        ) : p.full_name}
                      </td>
                      <td style={td}>
                        <select style={{ ...input, padding: '0.35rem 0.5rem', minWidth: 170, borderColor: keyOf(p) ? '#d1d5db' : C.orange }}
                          value={keyOf(p)} disabled={busy === `mentor-${p.id}`}
                          onChange={(e) => setMentor(p, e.target.value)} aria-label={`Mentor coach for ${p.full_name}`}>
                          <option value="">Unassigned</option>
                          {keyOf(p) && !mentorOptions.some((m) => m.key === keyOf(p)) && <option value={keyOf(p)}>{nameOfKey(keyOf(p))}</option>}
                          {mentorOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                        </select>
                      </td>
                      {[1, 2, 3].map((n) => {
                        const o = forms[`${p.id}:${n}`]
                        if (!o) return <td key={n} style={{ ...td, color: C.gray }}>Not started</td>
                        const done = missingItems({ ...emptyForm(), ...(o.form || {}) }).length === 0
                        return (
                          <td key={n} style={td}>
                            <button onClick={() => openObservation(o.id)} disabled={busy === `open-${o.id}`}
                              style={{ ...ghost, padding: '0.3rem 0.6rem', textAlign: 'left', borderColor: done ? C.lime : C.orange }}
                              title="Open this saved observation (read only)">
                              <span style={{ fontWeight: 700, color: done ? '#3f6212' : '#b45309' }}>{done ? 'Complete' : 'In progress'}</span>
                              <span style={{ display: 'block', fontSize: 11, color: C.muted }}>
                                {mentorName[o.user_id] || 'Unknown mentor'} · {fmt(o.updated_at)}
                              </span>
                            </button>
                          </td>
                        )
                      })}
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button style={{ ...ghost, marginRight: 6 }} onClick={() => setEditingPerson({ id: p.id, name: p.full_name })}>Rename</button>
                        <button style={danger} onClick={() => removePerson(p)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                  {people.length === 0 && (
                    <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#999' }}>No participants yet. Add names above.</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  )
}
