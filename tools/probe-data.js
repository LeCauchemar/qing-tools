JSON.stringify({
  notes: (S.data.notes || []).length,
  noteSample: (S.data.notes || []).slice(0, 3).map((n) => String(n.text).slice(0, 24)),
  clips: (S.data.clips || []).length,
  clipSample: (S.data.clips || []).slice(0, 3).map((c) => c.kind + ':' + String(c.text || '').slice(0, 18)),
  mailItems: ((S.data.mail && S.data.mail.items) || []).length,
  mailSample: ((S.data.mail && S.data.mail.items) || []).slice(0, 3).map((m) => String(m.subject).slice(0, 20)),
  files: (S.data.files || []).length,
})