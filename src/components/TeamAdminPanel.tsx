import React, { useState } from 'react';
import { CalendarPlus, Mail, Plus, ShieldCheck, UserCog, Users } from 'lucide-react';
import { BusinessSnapshot, TeamAssignment, TeamFunction, TeamUser } from '../types/business';
import { inviteTeamUser, saveTeamAssignment, saveTeamFunction, saveTeamUser } from '../utils/adminApi';

const today = () => new Date().toISOString().slice(0, 10);
const inputClass = 'w-full rounded-xl border border-white/10 bg-[#0B0F17] px-3 py-3 text-sm text-white outline-none focus:border-[#D4AF37]/60';
const defaultFunctions = ['Administrador', 'Seguimiento', 'Fotografía', 'Video', 'Maquillaje', 'Edición', 'Ventas', 'Asistente', 'Drone', 'Segundo fotógrafo', 'Coordinación', 'Otro'];
const permissionOptions = [
  ['CRM_READ', 'Ver CRM'], ['CRM_WRITE', 'Registrar seguimientos'], ['CLIENTS_READ', 'Ver clientes asignados'],
  ['CLIENTS_WRITE', 'Actualizar operación'], ['CALENDAR', 'Calendario asignado'], ['EMAIL_SEND', 'Enviar correos permitidos'], ['GALLERIES', 'Galerías asignadas'],
];

const blankUser = (): Partial<TeamUser> => ({ name: '', lastName: '', displayName: '', email: '', phone: '', functionId: '', functionName: '', role: 'COLLABORATOR', status: 'INVITADO', permissions: ['CLIENTS_READ', 'CALENDAR'], notes: '' });
const blankFunction = (): Partial<TeamFunction> => ({ name: '', status: 'ACTIVA' });
const blankAssignment = (): Partial<TeamAssignment> => ({ clientId: '', eventId: '', userId: '', functionName: '', activityType: 'Evento', scheduleSource: 'EVENT', startDate: today(), startTime: '', endDate: today(), endTime: '', notes: '', status: 'ACTIVA', syncStatus: 'Pendiente' });

interface Props {
  snapshot: BusinessSnapshot;
  onSnapshotChange: React.Dispatch<React.SetStateAction<BusinessSnapshot>>;
  notify: (message: string) => void;
  superAdminEmail?: string;
}

export const TeamAdminPanel: React.FC<Props> = ({ snapshot, onSnapshotChange, notify, superAdminEmail }) => {
  const [userDraft, setUserDraft] = useState<Partial<TeamUser>>(blankUser);
  const [functionDraft, setFunctionDraft] = useState<Partial<TeamFunction>>(blankFunction);
  const [assignmentDraft, setAssignmentDraft] = useState<Partial<TeamAssignment>>(blankAssignment);
  const [busy, setBusy] = useState(false);

  const persistFunction = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const saved = await saveTeamFunction(functionDraft);
      onSnapshotChange((previous) => ({ ...previous, teamFunctions: [saved, ...previous.teamFunctions.filter((item) => item.id !== saved.id)] }));
      setFunctionDraft(blankFunction()); notify('Función de equipo guardada.');
    } catch (error: any) { notify(error?.message || 'No se pudo guardar la función.'); }
    finally { setBusy(false); }
  };

  const persistUser = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const selectedFunction = snapshot.teamFunctions.find((item) => item.id === userDraft.functionId);
      const saved = await saveTeamUser({ ...userDraft, functionName: selectedFunction?.name || userDraft.functionName, role: 'COLLABORATOR' });
      onSnapshotChange((previous) => ({ ...previous, users: [saved, ...previous.users.filter((item) => item.id !== saved.id)] }));
      setUserDraft(blankUser()); notify('Colaborador guardado. Sus permisos no cambian por el nombre de su función.');
    } catch (error: any) { notify(error?.message || 'No se pudo guardar el usuario.'); }
    finally { setBusy(false); }
  };

  const sendInvite = async (user: TeamUser) => {
    setBusy(true);
    try {
      const result = await inviteTeamUser(user.id);
      onSnapshotChange((previous) => ({ ...previous, users: previous.users.map((item) => item.id === result.user.id ? result.user : item) }));
      notify(`Invitación enviada a ${user.email}. Caduca en 7 días.`);
    } catch (error: any) { notify(error?.message || 'No se pudo enviar la invitación.'); }
    finally { setBusy(false); }
  };

  const persistAssignment = async (event: React.FormEvent, allowOverride = false) => {
    event.preventDefault(); setBusy(true);
    try {
      const user = snapshot.users.find((item) => item.id === assignmentDraft.userId);
      const client = snapshot.clients.find((item) => item.id === assignmentDraft.clientId);
      const result = await saveTeamAssignment({ ...assignmentDraft, eventId: client?.eventId || '', functionName: user?.functionName || '', endDate: assignmentDraft.endDate || assignmentDraft.startDate }, allowOverride);
      onSnapshotChange((previous) => ({ ...previous, assignments: [result.assignment, ...previous.assignments.filter((item) => item.id !== result.assignment.id)] }));
      setAssignmentDraft(blankAssignment());
      notify(result.assignment.syncStatus === 'Sincronizado' ? 'Personal asignado y Calendar del colaborador actualizado.' : `Personal asignado. Calendar: ${result.assignment.syncStatus}.`);
    } catch (error: any) {
      if (error.conflict && !allowOverride) {
        const conflict = error.conflict as TeamAssignment;
        const proceed = window.confirm(`Este colaborador ya tiene una actividad de ${conflict.startTime || '00:00'} a ${conflict.endTime || 'sin hora final'}. ¿Deseas asignarlo de todos modos?`);
        if (proceed) { setBusy(false); return persistAssignment(event, true); }
      }
      notify(error?.message || 'No se pudo guardar la asignación.');
    } finally { setBusy(false); }
  };

  const togglePermission = (permission: string) => {
    const current = userDraft.permissions || [];
    setUserDraft({ ...userDraft, permissions: current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission] });
  };

  return <div className="space-y-5">
    <section className="rounded-2xl border border-[#D4AF37]/20 bg-[#161C28] p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#D4AF37]" /><h3 className="font-semibold">Super Admin</h3></div><div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4"><div className="font-semibold">Javier García</div><div className="text-xs text-gray-400">{superAdminEmail || 'Cuenta principal'} · Rol técnico SUPER_ADMIN</div><p className="mt-2 text-xs text-emerald-200">Es la única cuenta que puede administrar usuarios, permisos, integraciones, Gmail y todas las finanzas.</p></div></section>

    <section className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]"><form onSubmit={persistFunction} className="rounded-2xl border border-white/10 bg-[#161C28] p-5"><div className="flex items-center gap-2"><UserCog className="h-5 w-5 text-[#D4AF37]" /><h3 className="font-semibold">Funciones personalizables</h3></div><input list="xph-team-functions" value={functionDraft.name || ''} onChange={(event) => setFunctionDraft({ ...functionDraft, name: event.target.value })} placeholder="Ej. Fotografía" className={`${inputClass} mt-4`} required /><datalist id="xph-team-functions">{defaultFunctions.map((name) => <option key={name} value={name} />)}</datalist><select value={functionDraft.status || 'ACTIVA'} onChange={(event) => setFunctionDraft({ ...functionDraft, status: event.target.value as TeamFunction['status'] })} className={`${inputClass} mt-3`}><option>ACTIVA</option><option>INACTIVA</option></select><button disabled={busy} className="mt-3 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black"><Plus className="mr-2 inline h-4 w-4" />{functionDraft.id ? 'Actualizar función' : 'Crear función'}</button><div className="mt-4 flex flex-wrap gap-2">{snapshot.teamFunctions.map((item) => <button type="button" key={item.id} onClick={() => setFunctionDraft(item)} className={`rounded-full border px-3 py-1.5 text-xs ${item.status === 'ACTIVA' ? 'border-emerald-400/30 text-emerald-200' : 'border-white/10 text-gray-500'}`}>{item.name}</button>)}</div></form>

    <form onSubmit={persistUser} className="rounded-2xl border border-white/10 bg-[#161C28] p-5"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-[#D4AF37]" /><h3 className="font-semibold">Usuarios / equipo</h3></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={userDraft.name || ''} onChange={(event) => setUserDraft({ ...userDraft, name: event.target.value })} placeholder="Nombre real" className={inputClass} required /><input value={userDraft.lastName || ''} onChange={(event) => setUserDraft({ ...userDraft, lastName: event.target.value })} placeholder="Apellidos" className={inputClass} /><input value={userDraft.displayName || ''} onChange={(event) => setUserDraft({ ...userDraft, displayName: event.target.value })} placeholder="Nombre visible" className={inputClass} /><input type="email" value={userDraft.email || ''} onChange={(event) => setUserDraft({ ...userDraft, email: event.target.value })} placeholder="Correo de Google" className={inputClass} required /><input value={userDraft.phone || ''} onChange={(event) => setUserDraft({ ...userDraft, phone: event.target.value })} placeholder="Teléfono" className={inputClass} /><select value={userDraft.functionId || ''} onChange={(event) => { const selected = snapshot.teamFunctions.find((item) => item.id === event.target.value); setUserDraft({ ...userDraft, functionId: event.target.value, functionName: selected?.name || '' }); }} className={inputClass}><option value="">Selecciona función</option>{snapshot.teamFunctions.filter((item) => item.status === 'ACTIVA').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={userDraft.status || 'INVITADO'} onChange={(event) => setUserDraft({ ...userDraft, status: event.target.value as TeamUser['status'] })} className={inputClass}><option>INVITADO</option><option>ACTIVO</option><option>INACTIVO</option></select><div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-gray-400">Rol técnico: <strong className="text-white">COLLABORATOR</strong></div><textarea value={userDraft.notes || ''} onChange={(event) => setUserDraft({ ...userDraft, notes: event.target.value })} placeholder="Notas" className={`${inputClass} min-h-20 sm:col-span-2`} /></div><div className="mt-4"><div className="text-xs font-semibold text-gray-300">Permisos explícitos</div><div className="mt-2 grid gap-2 sm:grid-cols-2">{permissionOptions.map(([id, label]) => <label key={id} className="flex items-center gap-2 rounded-lg border border-white/10 p-2.5 text-xs"><input type="checkbox" checked={(userDraft.permissions || []).includes(id)} onChange={() => togglePermission(id)} />{label}</label>)}</div><p className="mt-2 text-xs text-gray-500">La función “Administrador” no concede permisos administrativos ni SUPER_ADMIN.</p></div><div className="mt-4 flex gap-2"><button type="button" onClick={() => setUserDraft(blankUser())} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm">Limpiar</button><button disabled={busy} className="rounded-xl bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-black">{userDraft.id ? 'Actualizar usuario' : 'Guardar usuario'}</button></div></form></section>

    <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5"><h3 className="font-semibold">Colaboradores registrados</h3><div className="mt-4 grid gap-3 lg:grid-cols-2">{snapshot.users.map((user) => <article key={user.id} className="rounded-xl border border-white/10 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{user.displayName || `${user.name} ${user.lastName}`.trim()}</div><div className="text-xs text-gray-400">{user.functionName || 'Sin función'} · {user.status}</div><div className="mt-1 text-xs text-gray-500">{user.email}</div></div><span className={`rounded-full px-2 py-1 text-[10px] ${user.googleConnected ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-200'}`}>{user.googleConnected ? 'Google conectado' : 'Sin conectar'}</span></div><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => setUserDraft(user)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#D4AF37]">Editar</button><button onClick={() => sendInvite(user)} disabled={busy || user.status === 'INACTIVO'} className="rounded-lg border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs text-sky-200 disabled:opacity-40"><Mail className="mr-1 inline h-3.5 w-3.5" />Invitar con Google</button></div></article>)}{!snapshot.users.length && <p className="text-sm text-gray-500">Aún no hay colaboradores. Crea una función y registra el primer usuario real.</p>}</div></section>

    <section className="rounded-2xl border border-white/10 bg-[#161C28] p-5"><div className="flex items-center gap-2"><CalendarPlus className="h-5 w-5 text-[#D4AF37]" /><h3 className="font-semibold">Personal asignado y conflictos</h3></div><form onSubmit={(event) => persistAssignment(event)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><select value={assignmentDraft.clientId || ''} onChange={(event) => { const client = snapshot.clients.find((item) => item.id === event.target.value); setAssignmentDraft({ ...assignmentDraft, clientId: event.target.value, eventId: client?.eventId || '', activityType: client?.eventType || 'Evento', scheduleSource: 'EVENT', startDate: client?.eventDate || today(), endDate: client?.eventDate || today(), startTime: client?.eventTime || '' }); }} className={inputClass} required><option value="">Selecciona cliente</option>{snapshot.clients.filter((item) => item.recordType === 'Cliente').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={assignmentDraft.userId || ''} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, userId: event.target.value })} className={inputClass} required><option value="">Selecciona colaborador</option>{snapshot.users.filter((item) => item.status !== 'INACTIVO').map((item) => <option key={item.id} value={item.id}>{item.displayName || item.name} · {item.functionName}</option>)}</select><select value={assignmentDraft.scheduleSource || 'EVENT'} onChange={(event) => { const source = event.target.value as TeamAssignment['scheduleSource']; const client = snapshot.clients.find((item) => item.id === assignmentDraft.clientId); setAssignmentDraft({ ...assignmentDraft, scheduleSource: source, activityType: source === 'SESSION' ? client?.preSessionType || 'Sesión previa' : source === 'EVENT' ? client?.eventType || 'Evento' : assignmentDraft.activityType, startDate: source === 'SESSION' ? client?.preSessionDate || today() : source === 'EVENT' ? client?.eventDate || today() : assignmentDraft.startDate, endDate: source === 'SESSION' ? client?.preSessionDate || today() : source === 'EVENT' ? client?.eventDate || today() : assignmentDraft.endDate, startTime: source === 'SESSION' ? client?.preSessionTime || '' : source === 'EVENT' ? client?.eventTime || '' : assignmentDraft.startTime, endTime: source === 'SESSION' ? client?.preSessionEndTime || '' : assignmentDraft.endTime }); }} className={inputClass}><option value="EVENT">Horario del evento</option><option value="SESSION">Horario de la sesión</option><option value="MANUAL">Horario manual</option></select><select value={assignmentDraft.status || 'ACTIVA'} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, status: event.target.value as TeamAssignment['status'] })} className={inputClass}><option>ACTIVA</option><option>CANCELADA</option></select><input value={assignmentDraft.activityType || ''} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, activityType: event.target.value })} placeholder="Actividad" className={inputClass} /><input type="date" value={assignmentDraft.startDate || today()} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, startDate: event.target.value, endDate: assignmentDraft.endDate || event.target.value })} className={inputClass} required /><input type="time" value={assignmentDraft.startTime || ''} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, startTime: event.target.value })} className={inputClass} /><input type="date" value={assignmentDraft.endDate || assignmentDraft.startDate || today()} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, endDate: event.target.value })} className={inputClass} /><input type="time" value={assignmentDraft.endTime || ''} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, endTime: event.target.value })} className={inputClass} /><textarea value={assignmentDraft.notes || ''} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, notes: event.target.value })} placeholder="Notas para proveedor" className={`${inputClass} min-h-16 lg:col-span-3`} /><button disabled={busy} className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-black">Asignar y sincronizar</button></form><div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs text-[#D4AF37]"><tr><th className="p-3">Colaborador</th><th className="p-3">Cliente / actividad</th><th className="p-3">Horario</th><th className="p-3">Calendar</th><th className="p-3"></th></tr></thead><tbody className="divide-y divide-white/10">{snapshot.assignments.map((assignment) => { const user = snapshot.users.find((item) => item.id === assignment.userId); const client = snapshot.clients.find((item) => item.id === assignment.clientId); return <tr key={assignment.id}><td className="p-3">{user?.displayName || user?.name || 'Usuario'}</td><td className="p-3">{client?.name || 'Cliente'}<div className="text-xs text-gray-500">{assignment.activityType} · {assignment.scheduleSource === 'SESSION' ? 'Sesión vinculada' : assignment.scheduleSource === 'MANUAL' ? 'Horario manual' : 'Evento vinculado'}</div></td><td className="p-3">{assignment.startDate} · {assignment.startTime || 'Sin hora'}–{assignment.endTime || 'Sin hora'}</td><td className="p-3">{assignment.syncStatus}</td><td className="p-3"><button onClick={() => setAssignmentDraft(assignment)} className="text-xs text-[#D4AF37]">Editar</button></td></tr>; })}</tbody></table></div></section>
  </div>;
};
