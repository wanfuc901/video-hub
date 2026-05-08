/**
 * VHHub Loader v3
 * 3 cạnh tam giác bay vào từ ngoài màn hình theo đúng trục nghiêng của chúng
 */
(function () {
  const ACCENT = '#7C6CFC';
  const ease = 'cubic-bezier(0.16,1,0.3,1)';
  const delay = ms => new Promise(r => setTimeout(r, ms));

  // Inject loader DOM
  const overlay = document.createElement('div');
  overlay.id = 'vhLoaderOverlay';
  overlay.innerHTML = `
    <div id="vhLoaderInner">
      <svg id="vhLoaderSvg" width="80" height="80" viewBox="-10 -10 44 44" style="overflow:visible">
        <line id="vhEdgeLeft"  x1="12" y1="2"  x2="2"  y2="22" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round"/>
        <line id="vhEdgeRight" x1="12" y1="2"  x2="22" y2="22" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round"/>
        <line id="vhEdgeBot"   x1="2"  y1="22" x2="22" y2="22" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round"/>
        <path id="vhEdgeInner" d="M12 8l5 10H7l5-10z" fill="none" stroke="${ACCENT}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
      </svg>
      <div id="vhLoaderText">VH<span>HUB</span></div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #vhLoaderOverlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: #111;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.4s ease;
    }
    #vhLoaderInner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
    #vhLoaderText {
      opacity: 0;
      letter-spacing: 0.35em;
      font-size: 17px;
      font-weight: 800;
      color: #fff;
      font-family: 'Syne', sans-serif;
    }
    #vhLoaderText span {
      color: ${ACCENT};
    }
  `;

  document.head.appendChild(style);
  document.body.insertBefore(overlay, document.body.firstChild);

  async function runLoader() {
    await delay(200);

    const left  = document.getElementById('vhEdgeLeft');
    const right = document.getElementById('vhEdgeRight');
    const bot   = document.getElementById('vhEdgeBot');
    const inner = document.getElementById('vhEdgeInner');
    const text  = document.getElementById('vhLoaderText');

    const k = 6; // khoảng cách bay (units SVG * scale)

    // Cạnh TRÁI: trục ↙ (vector -10,+20) — bay vào từ góc trên-phải
    left.animate([
      { transform: `translate(${10*k}px,${-20*k}px)`, opacity: 0 },
      { transform: 'translate(0,0)', opacity: 1 }
    ], { duration: 750, fill: 'forwards', easing: ease });

    // Cạnh PHẢI: trục ↘ (vector +10,+20) — bay vào từ góc trên-trái
    await delay(70);
    right.animate([
      { transform: `translate(${-10*k}px,${-20*k}px)`, opacity: 0 },
      { transform: 'translate(0,0)', opacity: 1 }
    ], { duration: 750, fill: 'forwards', easing: ease });

    // Cạnh ĐÁY: thẳng đứng, bay từ dưới lên
    await delay(70);
    bot.animate([
      { transform: `translateY(${20*k}px)`, opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 }
    ], { duration: 750, fill: 'forwards', easing: ease });

    // Inner triangle pop
    await delay(580);
    inner.animate([
      { opacity: 0, transform: 'scale(0.2)', transformOrigin: '12px 15px' },
      { opacity: 1, transform: 'scale(1.12)', transformOrigin: '12px 15px' },
      { opacity: 1, transform: 'scale(1)',   transformOrigin: '12px 15px' }
    ], { duration: 360, fill: 'forwards', easing: 'cubic-bezier(0.34,1.56,0.64,1)' });

    // Text reveal
    await delay(260);
    text.animate([
      { opacity: 0, letterSpacing: '0.7em', transform: 'translateY(6px)' },
      { opacity: 1, letterSpacing: '0.35em', transform: 'translateY(0)' }
    ], { duration: 500, fill: 'forwards', easing: ease });

    // Fade out khi page ready
    await delay(400);
    fadeOut();
  }

  function fadeOut() {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    setTimeout(() => {
      overlay.remove();
    }, 420);
  }

  // Chạy loader
  runLoader();

  // Nếu page đã load xong thì fade out sau tối thiểu 1.8s
  let minTime = Date.now();
  window.addEventListener('load', () => {
    const elapsed = Date.now() - minTime;
    const remaining = Math.max(0, 1800 - elapsed);
    // fadeOut sẽ được gọi từ runLoader() sau animation xong
  });
})();
