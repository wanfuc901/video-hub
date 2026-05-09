/**
 * VHHub Loader v6
 * "Paper plane" animation with Cubic Bezier paths
 */
(function () {
  const ACCENT = '#7C6CFC';
  const ease = 'cubic-bezier(0.16,1,0.3,1)';
  const delay = ms => new Promise(r => setTimeout(r, ms));

  // ---------------------------------------------------------
  // MATH UTILS (Cubic Bezier for paper plane movement)
  // ---------------------------------------------------------
  function getCubicBezierPos(t, P0, P1, P2, P3) {
    let u = 1 - t, tt = t * t, uu = u * u, uuu = uu * u, ttt = tt * t;
    let x = uuu * P0.x + 3 * uu * t * P1.x + 3 * u * tt * P2.x + ttt * P3.x;
    let y = uuu * P0.y + 3 * uu * t * P1.y + 3 * u * tt * P2.y + ttt * P3.y;
    return { x, y };
  }

  function getCubicBezierTangent(t, P0, P1, P2, P3) {
    let u = 1 - t;
    let dx = 3 * u * u * (P1.x - P0.x) + 6 * u * t * (P2.x - P1.x) + 3 * t * t * (P3.x - P2.x);
    let dy = 3 * u * u * (P1.y - P0.y) + 6 * u * t * (P2.y - P1.y) + 3 * t * t * (P3.y - P2.y);
    return Math.atan2(dy, dx);
  }

  function createGliderKeyframes(baseAngle, P0, P1, slideDistance) {
    const frames = [];
    const steps = 150;
    const P3 = { x: 0, y: 0 };
    const angleRad = baseAngle * Math.PI / 180;
    const P2 = {
      x: -slideDistance * Math.cos(angleRad),
      y: -slideDistance * Math.sin(angleRad)
    };
    let prevRot = null;
    for (let i = 0; i <= steps; i++) {
      let rawT = i / steps;
      let t = 1 - Math.pow(1 - rawT, 4); // Ease Out Quart
      let pos = getCubicBezierPos(t, P0, P1, P2, P3);
      let tangentRad = getCubicBezierTangent(t, P0, P1, P2, P3);
      let tangentDeg = tangentRad * 180 / Math.PI;
      let rot = tangentDeg - baseAngle;
      if (prevRot !== null) {
        while (rot - prevRot > 180) rot -= 360;
        while (rot - prevRot < -180) rot += 360;
      }
      prevRot = rot;
      let opacity = rawT < 0.05 ? rawT / 0.05 : 1;
      frames.push({
        transform: `translate(${pos.x}px, ${pos.y}px) rotate(${rot}deg)`,
        opacity: opacity
      });
    }
    return frames;
  }

  // Inject loader DOM
  const overlay = document.createElement('div');
  overlay.id = 'vhLoaderOverlay';
  overlay.innerHTML = `
    <div id="vhLoaderInner">
      <svg id="vhLoaderSvg" width="100" height="100" viewBox="-10 -10 44 44" style="overflow:visible">
        <line id="vhEdgeLeft"  x1="12" y1="2"  x2="2"  y2="22" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0"/>
        <line id="vhEdgeRight" x1="12" y1="2"  x2="22" y2="22" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0"/>
        <line id="vhEdgeBot"   x1="2"  y1="22" x2="22" y2="22" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0"/>
        <path id="vhEdgeInner" d="M12 8l5 10H7l5-10z" fill="none" stroke="${ACCENT}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
      </svg>
      <div id="vhLoaderText">VH<span>HUB</span></div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&display=swap');
    #vhLoaderOverlay {
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: #111;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.5s ease;
      overflow: hidden;
    }
    #vhLoaderInner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 28px;
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
    #vhLoaderSvg line {
      transform-origin: center;
      transform-box: fill-box;
    }
  `;

  // SESSION CHECK: Chỉ chạy animation 1 lần mỗi phiên làm việc
  const HAS_LOADED = sessionStorage.getItem('vhub_initial_loaded');

  if (HAS_LOADED) {
    // Nếu đã load rồi, không hiện loader hoặc xóa ngay lập tức
    return; 
  }

  document.head.appendChild(style);
  document.body.insertBefore(overlay, document.body.firstChild);

  async function runLoader() {
    await delay(300);
    
    // Đánh dấu đã load để lần sau không hiện nữa
    sessionStorage.setItem('vhub_initial_loaded', 'true');

    const left  = document.getElementById('vhEdgeLeft');
    const right = document.getElementById('vhEdgeRight');
    const bot   = document.getElementById('vhEdgeBot');
    const inner = document.getElementById('vhEdgeInner');
    const text  = document.getElementById('vhLoaderText');

    const duration = 4000; 
    const baseAngleLeft  = Math.atan2(20, -10) * 180 / Math.PI;
    const baseAngleRight = Math.atan2(20, 10) * 180 / Math.PI;
    const baseAngleBot   = Math.atan2(0, 20) * 180 / Math.PI;

    const framesLeft = createGliderKeyframes(baseAngleLeft, {x: 100, y: 350}, {x: 500, y: -300}, 200);
    const framesRight = createGliderKeyframes(baseAngleRight, {x: -100, y: 350}, {x: -500, y: -300}, 200);
    const framesBot = createGliderKeyframes(baseAngleBot, {x: 0, y: -350}, {x: 400, y: 200}, 250);

    left.animate(framesLeft, { duration, fill: 'forwards' });
    right.animate(framesRight, { duration, fill: 'forwards' });
    bot.animate(framesBot, { duration, fill: 'forwards' });

    await delay(duration);
    
    inner.animate([
      { opacity: 0, transform: 'scale(0.2)', transformOrigin: '12px 15px' },
      { opacity: 1, transform: 'scale(1.1)', transformOrigin: '12px 15px' },
      { opacity: 1, transform: 'scale(1)',   transformOrigin: '12px 15px' }
    ], { duration: 800, fill: 'forwards', easing: 'cubic-bezier(0.34,1.56,0.64,1)' });

    await delay(400);
    text.animate([
      { opacity: 0, letterSpacing: '0.7em', transform: 'translateY(6px)' },
      { opacity: 1, letterSpacing: '0.35em', transform: 'translateY(0)' }
    ], { duration: 800, fill: 'forwards', easing: ease });

    // ĐỢI TEXT CHẠY XONG (800ms) MỚI CHO PHÉP VÀO WEB
    await delay(800);
    
    // Thêm một chút delay nhẹ để cảm nhận trọn vẹn logo trước khi fade
    await delay(200);

    isAnimationDone = true;
    checkAndFadeOut();
  }

  let isAnimationDone = false;
  let isPageLoaded = false;

  function checkAndFadeOut() {
    if (isAnimationDone && isPageLoaded) {
      fadeOut();
    }
  }

  function fadeOut() {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    setTimeout(() => {
      overlay.remove();
    }, 600);
  }

  window.addEventListener('load', () => {
    isPageLoaded = true;
    checkAndFadeOut();
  });

  // Fallback if load takes too long
  setTimeout(() => {
    isPageLoaded = true;
    checkAndFadeOut();
  }, 10000);

  runLoader();
})();
