from pathlib import Path

path = Path('src/components/BusinessAdminPanel.tsx')
text = path.read_text()

props_anchor = "interface Props {\n"
task_types = """type BackgroundTaskStatus = 'running' | 'success' | 'error';
type BackgroundTask = {
  id: string;
  title: string;
  detail: string;
  status: BackgroundTaskStatus;
  progress?: number;
  startedAt: string;
  updatedAt: string;
};

"""
if task_types not in text:
    if props_anchor not in text:
        raise SystemExit('Props anchor not found')
    text = text.replace(props_anchor, task_types + props_anchor, 1)

state_anchor = "  const [modalNotice, setModalNotice] = useState('');\n"
state_insert = """  const [modalNotice, setModalNotice] = useState('');
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const [importingCsv, setImportingCsv] = useState(false);
"""
if state_insert not in text:
    if state_anchor not in text:
        raise SystemExit('modalNotice state anchor not found')
    text = text.replace(state_anchor, state_insert, 1)

refresh_anchor = "  const refresh = async (force = true) => {\n"
helpers = """  const startBackgroundTask = (id: string, title: string, detail: string, progress?: number) => {
    const timestamp = now();
    setBackgroundTasks((current) => [{ id, title, detail, status: 'running', progress, startedAt: timestamp, updatedAt: timestamp }, ...current.filter((item) => item.id !== id)].slice(0, 6));
  };

  const updateBackgroundTask = (id: string, patch: Partial<Omit<BackgroundTask, 'id' | 'startedAt'>>) => {
    setBackgroundTasks((current) => current.map((item) => item.id === id ? { ...item, ...patch, updatedAt: now() } : item));
  };

  const dismissBackgroundTask = (id: string) => setBackgroundTasks((current) => current.filter((item) => item.id !== id));

  useEffect(() => {
    if (!modalNotice) return;
    const timer = window.setTimeout(() => setModalNotice(''), 6500);
    return () => window.clearTimeout(timer);
  }, [modalNotice]);

"""
if helpers not in text:
    if refresh_anchor not in text:
        raise SystemExit('refresh anchor not found')
    text = text.replace(refresh_anchor, helpers + refresh_anchor, 1)

old_import_start = """    if (file.size > 5_000_000) return setModalNotice('El CSV debe pesar máximo 5 MB.');
    setBusy(true);
    try {
      const rows = parseCsvText(await file.text());
      if (rows.length < 2) throw new Error('El CSV no contiene registros para importar.');
      if (rows.length > 501) throw new Error('Por seguridad, importa máximo 500 clientes por archivo.');
      const headers = rows[0].map(normalizeCsvHeader);
"""
new_import_start = """    if (file.size > 5_000_000) return setModalNotice('El CSV debe pesar máximo 5 MB.');
    if (importingCsv) return setModalNotice('Ya hay una importación CSV en curso. Puedes seguir usando el resto del panel.');
    const taskId = 'client-csv-import';
    setImportingCsv(true);
    startBackgroundTask(taskId, 'Importando clientes', `Leyendo ${file.name}…`, 2);
    try {
      const rows = parseCsvText(await file.text());
      if (rows.length < 2) throw new Error('El CSV no contiene registros para importar.');
      if (rows.length > 501) throw new Error('Por seguridad, importa máximo 500 clientes por archivo.');
      const totalRows = rows.length - 1;
      updateBackgroundTask(taskId, { detail: `${totalRows} registro(s) detectados. Validando columnas…`, progress: 5 });
      const headers = rows[0].map(normalizeCsvHeader);
"""
if old_import_start in text:
    text = text.replace(old_import_start, new_import_start, 1)
elif new_import_start not in text:
    raise SystemExit('import start anchor not found')

loop_anchor = """      for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const cells = rows[rowIndex];
"""
loop_new = """      for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const cells = rows[rowIndex];
        updateBackgroundTask(taskId, { detail: `Procesando ${rowIndex} de ${totalRows}…`, progress: Math.max(5, Math.round((rowIndex / totalRows) * 95)) });
"""
if loop_new not in text:
    if loop_anchor not in text:
        raise SystemExit('CSV loop anchor not found')
    text = text.replace(loop_anchor, loop_new, 1)

old_import_end = """      cacheBusinessClients(known);
      setSnapshot((previous) => ({ ...previous, clients: known }));
      const detail = errors.length ? ` Detalles: ${errors.slice(0, 4).join(' | ')}${errors.length > 4 ? '…' : ''}` : '';
      setModalNotice(`CSV procesado: ${created} cliente(s) nuevos, ${updated} actualizado(s), ${skipped} omitido(s).${detail}`);
    } catch (error: any) {
      setModalNotice(error?.message || 'No se pudo importar el CSV.');
    } finally {
      setBusy(false);
    }
  };
"""
new_import_end = """      cacheBusinessClients(known);
      setSnapshot((previous) => ({ ...previous, clients: known }));
      const detail = errors.length ? ` Detalles: ${errors.slice(0, 4).join(' | ')}${errors.length > 4 ? '…' : ''}` : '';
      const message = `CSV procesado: ${created} cliente(s) nuevos, ${updated} actualizado(s), ${skipped} omitido(s).${detail}`;
      updateBackgroundTask(taskId, { status: 'success', detail: message, progress: 100 });
      setModalNotice(message);
    } catch (error: any) {
      const message = error?.message || 'No se pudo importar el CSV.';
      updateBackgroundTask(taskId, { status: 'error', detail: message });
      setModalNotice(message);
    } finally {
      setImportingCsv(false);
    }
  };
"""
if old_import_end in text:
    text = text.replace(old_import_end, new_import_end, 1)
elif new_import_end not in text:
    raise SystemExit('import end anchor not found')

old_sync_client = """  const syncCalendar = async (client: CrmClient) => {
    if (syncingClientId) return;
    setSyncingClientId(client.id);
    try {
      const saved = await syncClientCalendar(client);
      setSnapshot((prev) => ({ ...prev, clients: prev.clients.map((item) => item.id === saved.id ? saved : item) }));
      setModalNotice('Calendar fue rectificado: se actualizó el evento válido y se eliminaron duplicados verificados.');
    } catch (error: any) { setModalNotice(error?.message || 'No se pudo sincronizar Google Calendar.'); }
    finally { setSyncingClientId(''); }
  };
"""
new_sync_client = """  const syncCalendar = async (client: CrmClient) => {
    if (syncingClientId) return;
    const taskId = `calendar-client-${client.id}`;
    setSyncingClientId(client.id);
    startBackgroundTask(taskId, 'Sincronizando Calendar', `${client.name || 'Cliente'} · conciliando evento y sesión…`);
    try {
      const saved = await syncClientCalendar(client);
      setSnapshot((prev) => ({ ...prev, clients: prev.clients.map((item) => item.id === saved.id ? saved : item) }));
      const message = 'Calendar fue rectificado: se actualizó el evento válido y se eliminaron duplicados verificados.';
      updateBackgroundTask(taskId, { status: 'success', detail: message, progress: 100 });
      setModalNotice(message);
    } catch (error: any) {
      const message = error?.message || 'No se pudo sincronizar Google Calendar.';
      updateBackgroundTask(taskId, { status: 'error', detail: message });
      setModalNotice(message);
    } finally { setSyncingClientId(''); }
  };
"""
if old_sync_client in text:
    text = text.replace(old_sync_client, new_sync_client, 1)
elif new_sync_client not in text:
    raise SystemExit('syncCalendar anchor not found')

old_sync_all = """    if (syncingAllCalendars) return;
    setSyncingAllCalendars(true);
    try {
      const result = await syncAllClientCalendars();
      setSnapshot((current) => ({ ...current, clients: current.clients.map((item) => result.clients.find((saved) => saved.id === item.id) || item) }));
      const summary = result.summary;
      setModalNotice(`${summary.synchronized} expediente(s) reconciliados. ${summary.created} evento(s) creados, ${summary.updated} actualizados y ${summary.duplicatesDeleted} duplicado(s) verificado(s) eliminados.${summary.failed ? ` ${summary.failed} operación(es) requieren revisión.` : ''}`);
    } catch (error: any) {
      setModalNotice(error?.message || 'No se pudo reconciliar Google Calendar.');
    } finally {
      setSyncingAllCalendars(false);
    }
"""
new_sync_all = """    if (syncingAllCalendars) return;
    const taskId = 'calendar-sync-all';
    setSyncingAllCalendars(true);
    startBackgroundTask(taskId, 'Sincronización general', `${records.length} expediente(s) en cola. Puedes seguir trabajando en el panel.`);
    try {
      const result = await syncAllClientCalendars();
      setSnapshot((current) => ({ ...current, clients: current.clients.map((item) => result.clients.find((saved) => saved.id === item.id) || item) }));
      const summary = result.summary;
      const message = `${summary.synchronized} expediente(s) reconciliados. ${summary.created} evento(s) creados, ${summary.updated} actualizados y ${summary.duplicatesDeleted} duplicado(s) verificado(s) eliminados.${summary.failed ? ` ${summary.failed} operación(es) requieren revisión.` : ''}`;
      updateBackgroundTask(taskId, { status: summary.failed ? 'error' : 'success', detail: message, progress: 100 });
      setModalNotice(message);
    } catch (error: any) {
      const message = error?.message || 'No se pudo reconciliar Google Calendar.';
      updateBackgroundTask(taskId, { status: 'error', detail: message });
      setModalNotice(message);
    } finally {
      setSyncingAllCalendars(false);
    }
"""
if old_sync_all in text:
    text = text.replace(old_sync_all, new_sync_all, 1)
elif new_sync_all not in text:
    raise SystemExit('syncAll anchor not found')

old_modal = """      {modalNotice && <div className=\"fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"business-notice-title\"><div className=\"w-full max-w-sm rounded-2xl border border-white/15 bg-[#161C28] p-6 text-center shadow-2xl\"><CheckCircle2 className=\"mx-auto h-10 w-10 text-emerald-400\" /><h3 id=\"business-notice-title\" className=\"mt-4 text-lg font-bold text-white\">Aviso</h3><p className=\"mt-2 break-words text-sm leading-6 text-gray-200\">{modalNotice}</p><button type=\"button\" autoFocus onClick={() => setModalNotice('')} className=\"mt-6 w-full rounded-xl bg-[#D4AF37] px-5 py-3 font-bold text-black\">OK</button></div></div>}\n"""
new_modal = """      {(backgroundTasks.length > 0 || modalNotice) && <aside className=\"pointer-events-none fixed bottom-4 right-4 z-[120] w-[min(92vw,410px)] space-y-2\" aria-live=\"polite\" aria-label=\"Actividad en segundo plano\">{backgroundTasks.slice(0, 5).map((task) => <div key={task.id} className={`pointer-events-auto overflow-hidden rounded-2xl border bg-[#161C28]/95 shadow-2xl shadow-black/40 backdrop-blur ${task.status === 'error' ? 'border-red-400/30' : task.status === 'success' ? 'border-emerald-400/25' : 'border-sky-300/25'}`}><div className=\"flex items-start gap-3 p-4\"><div className=\"mt-0.5 shrink-0\">{task.status === 'running' ? <Loader2 className=\"h-5 w-5 animate-spin text-sky-300\" /> : task.status === 'success' ? <CheckCircle2 className=\"h-5 w-5 text-emerald-300\" /> : <AlertTriangle className=\"h-5 w-5 text-red-300\" />}</div><div className=\"min-w-0 flex-1\"><div className=\"flex items-start justify-between gap-2\"><div><p className=\"text-sm font-bold text-white\">{task.title}</p><p className=\"mt-1 break-words text-xs leading-5 text-gray-300\">{task.detail}</p></div>{task.status !== 'running' && <button type=\"button\" onClick={() => dismissBackgroundTask(task.id)} className=\"rounded-lg p-1 text-gray-500 hover:bg-white/10 hover:text-white\" aria-label=\"Cerrar actividad\"><X className=\"h-4 w-4\" /></button>}</div>{task.status === 'running' && <div className=\"mt-3 h-1.5 overflow-hidden rounded-full bg-white/10\"><div className=\"h-full rounded-full bg-sky-300 transition-all duration-300\" style={{ width: `${Math.max(8, Math.min(100, task.progress || 18))}%` }} /></div>}</div></div></div>)}{modalNotice && <div className=\"pointer-events-auto flex items-start gap-3 rounded-2xl border border-[#D4AF37]/25 bg-[#161C28]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur\"><CheckCircle2 className=\"mt-0.5 h-5 w-5 shrink-0 text-[#D4AF37]\" /><div className=\"min-w-0 flex-1\"><p className=\"text-sm font-bold text-white\">Aviso</p><p className=\"mt-1 break-words text-xs leading-5 text-gray-300\">{modalNotice}</p></div><button type=\"button\" onClick={() => setModalNotice('')} className=\"rounded-lg p-1 text-gray-500 hover:bg-white/10 hover:text-white\" aria-label=\"Cerrar aviso\"><X className=\"h-4 w-4\" /></button></div>}</aside>}\n"""
if old_modal in text:
    text = text.replace(old_modal, new_modal, 1)
elif new_modal not in text:
    raise SystemExit('blocking modal anchor not found')

old_upload = """<label className={`inline-flex items-center justify-center gap-2 rounded-xl border border-sky-300/30 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-100 ${busy ? 'pointer-events-none opacity-40' : 'cursor-pointer'}`}><Upload className=\"h-4 w-4\" />Cargar CSV<input type=\"file\" accept=\".csv,text/csv,application/vnd.ms-excel\" className=\"hidden\" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0] || null; event.currentTarget.value = ''; if (file) void importClientsCsv(file); }} /></label>"""
new_upload = """<label className={`inline-flex items-center justify-center gap-2 rounded-xl border border-sky-300/30 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-100 ${importingCsv ? 'pointer-events-none opacity-40' : 'cursor-pointer'}`}><Upload className=\"h-4 w-4\" />{importingCsv ? 'Importando CSV…' : 'Cargar CSV'}<input type=\"file\" accept=\".csv,text/csv,application/vnd.ms-excel\" className=\"hidden\" disabled={importingCsv} onChange={(event) => { const file = event.currentTarget.files?.[0] || null; event.currentTarget.value = ''; if (file) void importClientsCsv(file); }} /></label>"""
if old_upload in text:
    text = text.replace(old_upload, new_upload, 1)
elif new_upload not in text:
    raise SystemExit('CSV upload control anchor not found')

path.write_text(text)
