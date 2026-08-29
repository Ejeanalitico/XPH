import proxyHandler from './proxy.js';

function requestAction(req) {
  const queryAction = req?.query?.action;
  if (queryAction) return String(Array.isArray(queryAction) ? queryAction[0] : queryAction).trim();
  try {
    return new URL(String(req?.url || ''), 'https://www.xaviph.com').searchParams.get('action') || '';
  } catch (_) {
    return '';
  }
}

function isMobileSigningRequest(req) {
  const mobileHint = String(req?.headers?.['sec-ch-ua-mobile'] || '');
  const userAgent = String(req?.headers?.['user-agent'] || '');
  if (mobileHint === '?1') return true;
  return /(iphone|ipod|android.+mobile|windows phone|iemobile|opera mini)/i.test(userAgent);
}

function contractKey(contract) {
  const clientId = String(contract?.clientId || '').trim();
  const folio = String(contract?.folio || '').trim();
  if (clientId || folio) return `${clientId}::${folio}`;
  return String(contract?.id || '');
}

function contractTimestamp(contract) {
  const raw = contract?.updatedAt || contract?.createdAt || contract?.sentAt || '';
  const value = Date.parse(String(raw));
  return Number.isFinite(value) ? value : 0;
}

function isDesktopInvalidated(contract) {
  return String(contract?.tokenStatus || '').trim() === 'INVALIDADO_ESCRITORIO';
}

function normalizeContracts(contracts) {
  if (!Array.isArray(contracts)) return contracts;

  const list = contracts.filter(Boolean);
  const keysWithUsableContract = new Set(
    list
      .filter((contract) => !isDesktopInvalidated(contract))
      .map(contractKey)
      .filter(Boolean),
  );

  return list
    .filter((contract) => {
      if (!isDesktopInvalidated(contract)) return true;
      const key = contractKey(contract);
      return !key || !keysWithUsableContract.has(key);
    })
    .sort((left, right) => {
      const leftUsable = isDesktopInvalidated(left) ? 0 : 1;
      const rightUsable = isDesktopInvalidated(right) ? 0 : 1;
      if (leftUsable !== rightUsable) return rightUsable - leftUsable;
      return contractTimestamp(right) - contractTimestamp(left);
    });
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  let output = payload;
  if (payload.snapshot && typeof payload.snapshot === 'object' && Array.isArray(payload.snapshot.contracts)) {
    output = {
      ...output,
      snapshot: {
        ...payload.snapshot,
        contracts: normalizeContracts(payload.snapshot.contracts),
      },
    };
  }

  if (Array.isArray(payload.contracts)) {
    output = { ...output, contracts: normalizeContracts(payload.contracts) };
  }

  return output;
}

export default async function handler(req, res) {
  const action = requestAction(req);

  // A desktop preview must never destroy a valid signing link. The original
  // endpoint used to invalidate the token merely by opening it on a computer.
  // Keep the phone-only signing rule, but leave the token intact.
  if (
    req.method === 'GET' &&
    (action === 'contractView' || action === 'contractPdf') &&
    !isMobileSigningRequest(req)
  ) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(410).json({
      status: 'error',
      message: 'Esta liga de firma solo funciona en un teléfono. La liga sigue activa; ábrela desde tu celular.',
    });
  }

  // The CRM historically used Array.find() for a client's contract. When a
  // client had an old desktop-invalidated record plus a newer active upload,
  // the stale record could be selected first. Normalize contract collections
  // at the API boundary so current/usable contracts are returned first and a
  // superseded INVALIDADO_ESCRITORIO duplicate is hidden when a usable record
  // with the same client + folio exists.
  const originalJson = typeof res.json === 'function' ? res.json.bind(res) : null;
  if (originalJson) {
    res.json = (payload) => originalJson(normalizePayload(payload));
  }

  return proxyHandler(req, res);
}
