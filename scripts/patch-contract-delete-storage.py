from pathlib import Path
import re

# Patch frontend API: contract deletion must not depend on adminConfig/adminSaveConfig.
api_path = Path('src/utils/adminApi.ts')
api = api_path.read_text(encoding='utf-8')
start = api.find('type DeletedBusinessContractState = {')
end = api.find('export function readCachedBusinessSnapshot', start)
if start < 0 or end < 0:
    raise SystemExit('Could not locate deleted contract state block in adminApi.ts')
replacement = '''export async function loadBusinessSnapshot(force = false): Promise<BusinessSnapshot> {
  const data = await adminBusinessRequest<{ snapshot: BusinessSnapshot }>('adminBusinessSnapshot', { force });
  return normalizeBusinessSnapshot(data.snapshot);
}

export async function deleteBusinessContract(contractId: string): Promise<void> {
  const id = String(contractId || '').trim();
  if (!id) throw new Error('Contrato no identificado.');
  await adminBusinessRequest('adminContractDelete', { contractId: id });
  businessSnapshotCache = null;
}

'''
api = api[:start] + replacement + api[end:]
api_path.write_text(api, encoding='utf-8')

# Patch Vercel proxy: persist hidden contract ids inside a technical archived CRM row.
proxy_path = Path('api/proxy.js')
proxy = proxy_path.read_text(encoding='utf-8')

helper_anchor = 'function isGoogleDriveResumableUploadUrl(value) {'
if helper_anchor not in proxy:
    raise SystemExit('Could not locate proxy helper anchor')
helpers = r'''const CONTRACT_DELETE_STATE_ID = 'xph-system-contract-deletions';

function contractDeletionIdsFromClients(clients = []) {
  const state = (Array.isArray(clients) ? clients : []).find((item) => String(item?.id || '') === CONTRACT_DELETE_STATE_ID);
  if (!state) return [];
  try {
    const parsed = JSON.parse(String(state.internalNotes || '{}'));
    return Array.isArray(parsed?.deletedContractIds)
      ? [...new Set(parsed.deletedContractIds.map((id) => String(id || '').trim()).filter(Boolean))]
      : [];
  } catch (_) {
    return [];
  }
}

function withoutContractDeleteStateClient(clients = []) {
  return (Array.isArray(clients) ? clients : []).filter((item) => String(item?.id || '') !== CONTRACT_DELETE_STATE_ID);
}

function filterDeletedContractsFromSnapshot(snapshot) {
  const safeSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const clients = Array.isArray(safeSnapshot.clients) ? safeSnapshot.clients : [];
  const deletedIds = new Set(contractDeletionIdsFromClients(clients));
  return {
    ...safeSnapshot,
    clients: withoutContractDeleteStateClient(clients),
    contracts: (Array.isArray(safeSnapshot.contracts) ? safeSnapshot.contracts : [])
      .filter((contract) => !deletedIds.has(String(contract?.id || ''))),
  };
}

async function persistContractDeletion(contractId) {
  const id = String(contractId || '').trim();
  if (!id) throw new Error('Contrato no identificado.');
  const result = await forwardTransientBusinessAction('businessClients');
  const clients = Array.isArray(result?.clients) ? result.clients : [];
  const currentState = clients.find((item) => String(item?.id || '') === CONTRACT_DELETE_STATE_ID) || null;
  const deletedContractIds = contractDeletionIdsFromClients(clients);
  if (deletedContractIds.includes(id)) return deletedContractIds;
  const nextIds = [...deletedContractIds, id];
  const timestamp = new Date().toISOString();
  await forwardBusinessActionWithLockRetry('crmUpsert', {
    client: {
      ...(currentState || {}),
      id: CONTRACT_DELETE_STATE_ID,
      recordType: 'Prospecto',
      name: '[SISTEMA] Estado de contratos eliminados',
      phone: '',
      email: '',
      eventType: 'Sistema',
      eventDate: '',
      eventLocation: '',
      packageName: '',
      totalAmount: 0,
      paidAmount: 0,
      status: 'Archivado',
      source: 'Sistema XPH',
      notes: 'Registro técnico privado. No mostrar como prospecto o cliente.',
      internalNotes: JSON.stringify({ deletedContractIds: nextIds, updatedAt: timestamp }),
      nextAction: '',
      nextActionAt: '',
    },
  });
  return nextIds;
}

'''
proxy = proxy.replace(helper_anchor, helpers + helper_anchor, 1)

proxy = proxy.replace("      'adminContractFinalize',\n", "      'adminContractFinalize',\n      'adminContractDelete',\n", 1)
proxy = proxy.replace("adminContractCreateLink: 'CONTRACTS', adminOwnerSignatureSave: 'CONTRACTS', adminContractFinalize: 'CONTRACTS',", "adminContractCreateLink: 'CONTRACTS', adminOwnerSignatureSave: 'CONTRACTS', adminContractFinalize: 'CONTRACTS', adminContractDelete: 'SUPER_ADMIN',", 1)

submitted_anchor = "      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}\n\n      if (action === 'adminBusinessSnapshot') {"
if submitted_anchor not in proxy:
    raise SystemExit('Could not locate admin business submitted anchor')
submitted_replacement = """      try { submitted = JSON.parse(raw || '{}'); } catch (_) {}\n\n      if (action === 'adminContractDelete') {\n        const contractId = String(submitted.contractId || '').trim();\n        if (!contractId) return res.status(400).json({ status: 'error', message: 'Contrato no identificado.' });\n        await persistContractDeletion(contractId);\n        return res.status(200).json({ status: 'success', contractId, message: 'Contrato eliminado del panel.' });\n      }\n\n      if (action === 'adminBusinessSnapshot') {"""
proxy = proxy.replace(submitted_anchor, submitted_replacement, 1)

snapshot_anchor = "      if (action === 'adminBusinessSnapshot') {\n        const result = await forwardTransientBusinessAction('businessSnapshot');\n"
if snapshot_anchor not in proxy:
    raise SystemExit('Could not locate adminBusinessSnapshot anchor')
proxy = proxy.replace(snapshot_anchor, snapshot_anchor + "        result.snapshot = filterDeletedContractsFromSnapshot(result.snapshot);\n", 1)

clients_anchor = "      if (action === 'adminBusinessClients') {\n        const result = await forwardBusinessAction('businessClients');\n"
if clients_anchor not in proxy:
    raise SystemExit('Could not locate adminBusinessClients anchor')
proxy = proxy.replace(clients_anchor, clients_anchor + "        result.clients = withoutContractDeleteStateClient(result.clients);\n", 1)

proxy_path.write_text(proxy, encoding='utf-8')
print('Contract deletion storage patched successfully.')
