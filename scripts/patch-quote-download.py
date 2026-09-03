from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    if new in text:
        print(f"{label}: already installed")
        return
    if old not in text:
        raise SystemExit(f"{label}: expected source fragment not found")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"{label}: patched")


replace_once(
    "api/proxy.js",
    """function setPrivatePdfHeaders(res, filename) {\n  res.setHeader('Content-Type', 'application/pdf');\n  res.setHeader('Content-Disposition', `inline; filename=\"${filename}\"`);""",
    """function setPrivatePdfHeaders(res, filename, disposition = 'inline') {\n  res.setHeader('Content-Type', 'application/pdf');\n  res.setHeader('Content-Disposition', `${disposition}; filename=\"${filename}\"`);""",
    "PDF response disposition",
)

replace_once(
    "api/proxy.js",
    """      setPrivatePdfHeaders(res, `contrato-${String(result.folio || 'xph').replace(/[^a-z0-9-]/gi, '_')}.pdf`);\n      return res.status(200).send(pdf);""",
    """      const filename = `contrato-${String(result.folio || 'xph').replace(/[^a-z0-9-]/gi, '_')}.pdf`;\n      const disposition = String(req.query?.download || '') === '1' ? 'attachment' : 'inline';\n      setPrivatePdfHeaders(res, filename, disposition);\n      return res.status(200).send(pdf);""",
    "Admin PDF download mode",
)

replace_once(
    "src/components/BusinessAdminPanel.tsx",
    """</a>}<button onClick={() => createLink(contract)}""",
    """</a>}<a href={`${adminContractPdfUrl(contract.id, 'latest', contractPdfRevision(contract))}&download=1`} download className=\"inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/5 px-3 py-2 text-xs font-semibold text-[#F5D76E] hover:bg-[#D4AF37]/10\"><Download className=\"h-4 w-4\" />Descargar PDF</a><button onClick={() => createLink(contract)}""",
    "Contract and quote download button",
)
