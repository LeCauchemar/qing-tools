(()=>{const n=S.data.notes.find(x=>x.id==='note_mwg8syvn_5');return api.notes.togglePin(n.id).then(r=>({unpin:r,pinned:!!S.data.notes.find(x=>x.id===n.id).pinned}))})()
