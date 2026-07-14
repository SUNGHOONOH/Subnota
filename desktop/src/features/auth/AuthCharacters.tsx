import { useEffect, useRef } from 'react';
import { desktopColorTokens } from '../../lib/colorTokens';

// Auth 화면 왼쪽의 주황 물망초(forget-me-not) 꽃밭. 커서를 향해 꽃이 부드럽게
// 기울고, 커서가 없을 때는 각자 위상이 다른 미세한 바람 흔들림만 남는다.
// 단일 <canvas> + rAF 루프 하나로 그려 성능 부담이 없다.

const STAGE_WIDTH = 550;
const STAGE_HEIGHT = 400;
const FLOWER_COUNT = 46;

// Subnota 웜 팔레트 계열의 주황 꽃잎 + 노란 꽃심 + 차분한 초록 줄기.
const PETAL_COLORS = [
  '#E8853D',
  '#F09A52',
  '#D97633',
  '#F2A868',
  desktopColorTokens.brand.primary,
];
const CORE_COLOR = '#E8C254';
const STEM_COLORS = ['#66705A', '#7A8563', '#5C6650'];

interface Flower {
  baseX: number;
  baseY: number;
  height: number;
  headRadius: number;
  petalColor: string;
  stemColor: string;
  swayPhase: number;
  swaySpeed: number;
  swayAmplitude: number;
  stiffness: number;
  lean: number; // 현재 머리의 가로 오프셋(px) — 스프링으로 목표를 따라간다
}

const createFlowers = (): Flower[] => {
  const flowers: Flower[] = [];
  for (let index = 0; index < FLOWER_COUNT; index += 1) {
    // 아래쪽 3분의 1 영역에 얕은 원근: 뒤쪽(위) 꽃은 작고, 앞쪽(아래)은 크다.
    const depth = Math.random(); // 0 = 뒤, 1 = 앞
    const baseY = STAGE_HEIGHT - 8 - (1 - depth) * 70 - Math.random() * 14;
    flowers.push({
      baseX: 16 + Math.random() * (STAGE_WIDTH - 32),
      baseY,
      height: (66 + Math.random() * 74) * (0.62 + depth * 0.38),
      headRadius: (9 + Math.random() * 5) * (0.62 + depth * 0.38),
      petalColor: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
      stemColor: STEM_COLORS[Math.floor(Math.random() * STEM_COLORS.length)],
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: 0.55 + Math.random() * 0.5,
      swayAmplitude: 2.5 + Math.random() * 3.5,
      stiffness: 0.045 + Math.random() * 0.04,
      lean: 0,
    });
  }
  // 뒤쪽 꽃 먼저 그려서 앞쪽 꽃이 자연스럽게 겹치게 한다.
  return flowers.sort((a, b) => a.baseY - b.baseY);
};

const drawFlower = (context: CanvasRenderingContext2D, flower: Flower) => {
  const headX = flower.baseX + flower.lean;
  const headY = flower.baseY - flower.height;

  context.strokeStyle = flower.stemColor;
  context.lineWidth = Math.max(1.4, flower.headRadius * 0.16);
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(flower.baseX, flower.baseY);
  context.quadraticCurveTo(
    flower.baseX + flower.lean * 0.3,
    flower.baseY - flower.height * 0.55,
    headX,
    headY,
  );
  context.stroke();

  // 물망초: 둥근 꽃잎 5장 + 밝은 꽃심.
  context.fillStyle = flower.petalColor;
  for (let petal = 0; petal < 5; petal += 1) {
    const angle = (Math.PI * 2 * petal) / 5 - Math.PI / 2 + flower.lean * 0.008;
    context.beginPath();
    context.arc(
      headX + Math.cos(angle) * flower.headRadius * 0.72,
      headY + Math.sin(angle) * flower.headRadius * 0.72,
      flower.headRadius * 0.52,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.fillStyle = CORE_COLOR;
  context.beginPath();
  context.arc(headX, headY, flower.headRadius * 0.34, 0, Math.PI * 2);
  context.fill();
};

const AuthCharacters = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return undefined;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = STAGE_WIDTH * devicePixelRatio;
    canvas.height = STAGE_HEIGHT * devicePixelRatio;
    context.scale(devicePixelRatio, devicePixelRatio);

    const flowers = createFlowers();
    const mouse = { active: false, x: 0, y: 0 };
    let frameId: number | null = null;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
      mouse.active = true;
    };
    const handleMouseLeave = () => {
      mouse.active = false;
    };

    const renderFrame = (time: number) => {
      context.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
      const seconds = time / 1000;

      for (const flower of flowers) {
        const sway =
          Math.sin(seconds * flower.swaySpeed + flower.swayPhase) *
          flower.swayAmplitude;

        let target = sway;
        if (mouse.active) {
          const headY = flower.baseY - flower.height;
          const dx = mouse.x - flower.baseX;
          const dy = mouse.y - headY;
          const distance = Math.hypot(dx, dy);
          // 가우시안 감쇠: 커서 근처 꽃만 커서 쪽으로 기울고, 먼 꽃은
          // 바람 흔들림만 유지한다.
          const influence = Math.exp(-((distance / 190) ** 2));
          const leanToward = Math.max(-30, Math.min(30, dx * 0.16));
          target = sway + leanToward * influence;
        }

        flower.lean += (target - flower.lean) * flower.stiffness;
        drawFlower(context, flower);
      }

      frameId = window.requestAnimationFrame(renderFrame);
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      renderFrame(0);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      return undefined;
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseLeave);
    frameId = window.requestAnimationFrame(renderFrame);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      aria-hidden="true"
      ref={canvasRef}
      style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
    />
  );
};

export default AuthCharacters;
