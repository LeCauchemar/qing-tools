(async () => { applyStyle('island'); applyTheme('dark'); setPinned(true); S.grace = Date.now() + 600000; setMode('compact'); await new Promise(r=>setTimeout(r,700)); return 'ok'; })()
