'use strict';
/* 看大图：滚轮缩放（以光标为中心）、拖动平移、双击还原、Esc 关闭 */
(function () {
  const api = window.viewer || {};
  const params = new URLSearchParams(location.search);
  const url = params.get('url') || '';
  const title = params.get('title') || '';

  const stage = document.getElementById('stage');
  const img = document.getElementById('img');
  const zoomLabel = document.getElementById('zoom');
  const nameLabel = document.getElementById('name');

  nameLabel.textContent = title || decodeURIComponent((url.split('/').pop() || '').split('?')[0]) || '图片';
  nameLabel.title = nameLabel.textContent;

  const MIN = 0.08;
  const MAX = 8;
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let base = 1; // 「100%」= 适应窗口后的基准，双击回到这里

  function apply(smooth) {
    if (smooth) {
      stage.classList.add('smooth');
      clearTimeout(apply.t);
      apply.t = setTimeout(() => stage.classList.remove('smooth'), 220);
    } else {
      stage.classList.remove('smooth');
    }
    img.style.transform = 'translate(-50%, -50%) translate(' + tx.toFixed(2) + 'px, ' + ty.toFixed(2) + 'px) scale(' + scale.toFixed(4) + ')';
    zoomLabel.textContent = Math.round((scale / base) * 100) + '%';
  }

  function fit() {
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const nw = img.naturalWidth || sw;
    const nh = img.naturalHeight || sh;
    if (!sw || !sh) return;
    base = Math.min(1, (sw - 56) / nw, (sh - 56) / nh);
    if (!(base > 0)) base = 1;
    scale = base;
    tx = 0;
    ty = 0;
    apply(true);
  }

  function clampPan() {
    // 图比舞台小的时候不让它飘走；比舞台大时限制在边缘之内
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const w = (img.naturalWidth || sw) * scale;
    const h = (img.naturalHeight || sh) * scale;
    const mx = Math.max(0, (w - sw) / 2 + 24);
    const my = Math.max(0, (h - sh) / 2 + 24);
    tx = Math.max(-mx, Math.min(mx, tx));
    ty = Math.max(-my, Math.min(my, ty));
  }

  function zoomAt(cx, cy, factor) {
    const next = Math.max(MIN, Math.min(MAX, scale * factor));
    if (Math.abs(next - scale) < 0.0001) return;
    const sx = cx - stage.clientWidth / 2;
    const sy = cy - stage.clientHeight / 2;
    tx = sx - (sx - tx) * (next / scale);
    ty = sy - (sy - ty) * (next / scale);
    scale = next;
    clampPan();
    apply(false);
  }

  stage.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016));
    },
    { passive: false }
  );

  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, tx, ty, id: e.pointerId };
    stage.classList.add('dragging');
    try {
      stage.setPointerCapture(e.pointerId);
    } catch (_) {}
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    tx = drag.tx + (e.clientX - drag.x);
    ty = drag.ty + (e.clientY - drag.y);
    clampPan();
    apply(false);
  });
  const endDrag = (e) => {
    if (!drag) return;
    drag = null;
    stage.classList.remove('dragging');
    try {
      stage.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  stage.addEventListener('dblclick', () => {
    scale = base;
    tx = 0;
    ty = 0;
    apply(true);
  });

  document.getElementById('btnClose').addEventListener('click', () => api.close && api.close());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      api.close && api.close();
    } else if (e.key === '0') {
      scale = base;
      tx = 0;
      ty = 0;
      apply(true);
    } else if (e.key === '+' || e.key === '=') {
      zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1.2);
    } else if (e.key === '-') {
      zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1 / 1.2);
    }
  });

  window.addEventListener('resize', () => {
    // 窗口被拉大/拉小时，只把平移量收回边界，不重置缩放
    clampPan();
    apply(false);
  });

  img.addEventListener('load', () => {
    stage.classList.remove('loading');
    fit();
  });
  img.addEventListener('error', () => {
    stage.classList.remove('loading');
    nameLabel.textContent = '这张图读不出来';
  });

  stage.classList.add('loading');
  img.src = url || '';
  if (img.complete && img.naturalWidth) {
    stage.classList.remove('loading');
    fit();
  }
  window.addEventListener('focus', () => {
    // 只把标签页标题的状态补回来，不要重置缩放
    if (img.complete && img.naturalWidth) stage.classList.remove('loading');
  });
})();
