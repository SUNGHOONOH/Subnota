import { useEffect, useRef } from 'react';

import { SUBNOTA_PETAL_PATH } from '../../components/SubnotaMark';

// Auth 화면 왼쪽의 물망초(forget-me-not) 꽃밭. 커서를 향해 꽃이 부드럽게
// 기울고, 커서가 없을 때는 각자 위상이 다른 미세한 바람 흔들림만 남는다.
// 단일 <canvas> + rAF 루프 하나로 그려 성능 부담이 없다.
//
// 빈 곳을 누르면 그 자리에 꽃이 자란다. 뿌리는 언제나 땅이고 **누른 높이가
// 곧 키**라, 위쪽을 누를수록 크게 자라 비어 있던 공간이 채워진다. 공간을
// 미리 채우는 대신 채워지는 과정을 보여 주는 것이 이 상호작용의 요점이다.
// 심은 것은 저장하지 않는다 — 로그인 전이라 저장할 사용자가 없다.
//
// 꽃잎은 로고와 같은 path·같은 불규칙 배치를 쓴다. 예전에는 원 5개를 균등한
// 72°로 놓아서, 같은 물망초를 그리려던 것인데도 로고와 다른 꽃으로 보였다.

const STAGE_WIDTH = 550;
// 심은 꽃은 위로 길게 자란다. 400이면 다 자라기 전에 위가 잘린다.
const STAGE_HEIGHT = 500;
const FLOWER_COUNT = 46;
// 심은 꽃의 키 한계. 클릭 높이가 곧 키가 되므로 너무 낮거나 화면을 넘지
// 않게만 잡는다.
const PLANTED_MIN_HEIGHT = 70;
const PLANTED_MAX_HEIGHT = 430;

/* 의도된 팔레트 — 앱 토큰으로 흡수하지 말 것.
   일러스트의 색이지 UI 색이 아니다. 로고색 #4a7cc4를 중심으로 명도를 흔든
   파랑 5종이라, 46송이를 전부 로고색 단색으로 칠해 "로고 46개"가 되는 것을
   피하면서도 같은 꽃으로 읽힌다. 꽃심의 노랑은 실제 물망초에도 있다. */
const PETAL_COLORS = ['#4a7cc4', '#6b93d0', '#3a67ab', '#88a9db', '#2c5490'];
const CORE_COLOR = '#E8C254';
const STEM_COLORS = ['#66705A', '#7A8563', '#5C6650'];
/* 심은 꽃이 자라는 동안의 봉오리 색. 실제 물망초 봉오리는 분홍빛이었다가
   피면서 파래진다 — 연출이 아니라 이 꽃의 성질이다. 덕분에 심는 순간의
   보상이 "생겼다"가 아니라 눈에 보이는 색 변화가 된다. */
const BUD_COLOR = '#c98aa8';

const hexToRgb = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

const lerp = (from: number, to: number, ratio: number) =>
  from + (to - from) * ratio;

const mixHex = (fromHex: string, toHex: string, ratio: number) => {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  return `rgb(${Math.round(lerp(from[0], to[0], ratio))}, ${Math.round(
    lerp(from[1], to[1], ratio),
  )}, ${Math.round(lerp(from[2], to[2], ratio))})`;
};

/* 로고의 잎 배치를 꽃 중심(50,50) 기준 상대값으로 옮긴 것.
   [dx, dy, 각도, 크기] — 균등한 72°가 아닌 이 어긋남이 마크의 성격이다. */
const PETAL_LAYOUT: ReadonlyArray<readonly [number, number, number, number]> = [
  [-0.3, -3, -6, 1.04],
  [2.8, -1.1, 68, 0.97],
  [1.7, 2.5, 145, 1.06],
  [-1.5, 2.6, 210, 0.98],
  [-2.8, -1.1, 292, 1.02],
];

// 잎 하나의 길이는 로고 좌표계에서 약 44다. 꽃 머리 반지름에 맞춰 축소한다.
const PETAL_UNIT = 36;
const petalPath = new Path2D(SUBNOTA_PETAL_PATH);

interface Flower {
  baseX: number;
  baseY: number;
  budHeight: number;
  fullHeight: number;
  headRadius: number;
  petalColor: string;
  stemColor: string;
  swayPhase: number;
  swaySpeed: number;
  swayAmplitude: number;
  stiffness: number;
  lean: number; // 현재 머리의 가로 오프셋(px) — 스프링으로 목표를 따라간다
  bloom: number; // 0 = 오므린 봉오리, 1 = 활짝. 키·색·꽃잎 각도를 함께 움직인다
  bloomTarget: number;
}

const flowerHeight = (flower: Flower) =>
  lerp(flower.budHeight, flower.fullHeight, flower.bloom);

const baseFlower = (depth: number) => {
  // 아래쪽 3분의 1 영역에 얕은 원근: 뒤쪽(위) 꽃은 작고, 앞쪽(아래)은 크다.
  const scale = 0.62 + depth * 0.38;
  return {
    headRadius: (9 + Math.random() * 5) * scale,
    petalColor: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
    stemColor: STEM_COLORS[Math.floor(Math.random() * STEM_COLORS.length)],
    swayPhase: Math.random() * Math.PI * 2,
    swaySpeed: 0.55 + Math.random() * 0.5,
    swayAmplitude: 2.5 + Math.random() * 3.5,
    stiffness: 0.045 + Math.random() * 0.04,
    lean: 0,
    scale,
  };
};

const createFlowers = (): Flower[] => {
  const flowers = Array.from({ length: FLOWER_COUNT }, () => {
    const depth = Math.random();
    const { scale, ...rest } = baseFlower(depth);
    const grown = (66 + Math.random() * 74) * scale;
    return {
      ...rest,
      baseX: 16 + Math.random() * (STAGE_WIDTH - 32),
      baseY: STAGE_HEIGHT - 8 - (1 - depth) * 70 - Math.random() * 14,
      budHeight: grown,
      fullHeight: grown,
      bloom: 1,
      bloomTarget: 1,
    };
  });
  // 뒤쪽 꽃 먼저 그려서 앞쪽 꽃이 자연스럽게 겹치게 한다.
  return flowers.sort((a, b) => a.baseY - b.baseY);
};

/**
 * 클릭한 자리에 꽃을 심는다. 꽃은 땅에서 자라므로 뿌리는 언제나 아래쪽이고,
 * **클릭한 높이가 곧 이 꽃의 키가 된다** — 높이 누르면 크게 자라 비어 있던
 * 위쪽이 채워진다. 공간을 미리 채우는 대신 채워지는 과정을 보여 준다.
 */
const plantFlower = (x: number, y: number): Flower => {
  // 심은 꽃은 맨 앞에 선다. 뒤쪽 작은 꽃 뒤에 가리면 심은 보람이 없다.
  const { scale, ...rest } = baseFlower(0.8 + Math.random() * 0.2);
  const baseY = STAGE_HEIGHT - 8 - Math.random() * 14;
  return {
    ...rest,
    baseX: x,
    baseY,
    budHeight: (24 + Math.random() * 16) * scale,
    fullHeight: Math.min(
      PLANTED_MAX_HEIGHT,
      Math.max(PLANTED_MIN_HEIGHT, baseY - y),
    ),
    bloom: 0,
    bloomTarget: 1,
  };
};

const drawFlower = (context: CanvasRenderingContext2D, flower: Flower) => {
  const height = flowerHeight(flower);
  const headX = flower.baseX + flower.lean;
  const headY = flower.baseY - height;

  context.strokeStyle = flower.stemColor;
  context.lineWidth = Math.max(1.4, flower.headRadius * 0.16);
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(flower.baseX, flower.baseY);
  context.quadraticCurveTo(
    flower.baseX + flower.lean * 0.3,
    flower.baseY - height * 0.55,
    headX,
    headY,
  );
  context.stroke();

  // 물망초: 로고와 같은 잎 5장 + 밝은 꽃심.
  // 봉오리는 잎을 작게 오므리고(0.42) 안쪽으로 비틀어(34°) 분홍으로 둔다.
  // 세 값을 bloom 하나로 함께 움직여 "피어난다"가 한 동작으로 읽히게 한다.
  const headRadius = flower.headRadius * lerp(0.42, 1, flower.bloom);
  const unit = headRadius / PETAL_UNIT;
  const lean = flower.lean * 0.4;
  const twist = lerp(34, 0, flower.bloom);
  context.fillStyle = mixHex(BUD_COLOR, flower.petalColor, flower.bloom);
  for (const [dx, dy, rotation, scale] of PETAL_LAYOUT) {
    context.save();
    context.translate(headX + dx * unit, headY + dy * unit);
    // 기우는 만큼 꽃 전체를 함께 돌려 바람에 쓸리는 느낌을 남긴다.
    context.rotate(((rotation + lean + twist) * Math.PI) / 180);
    context.scale(scale * unit, scale * unit);
    context.fill(petalPath);
    context.restore();
  }

  // 꽃심은 잎이 벌어진 뒤에야 보인다. 오므린 봉오리에서 노란 점이 비치면
  // 안이 들여다보이는 것처럼 어색하다.
  const coreReveal = Math.max(0, (flower.bloom - 0.45) / 0.55);
  if (coreReveal > 0) {
    context.fillStyle = CORE_COLOR;
    context.beginPath();
    context.arc(headX, headY, headRadius * 0.34 * coreReveal, 0, Math.PI * 2);
    context.fill();
  }
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

    const toStagePoint = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * STAGE_WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * STAGE_HEIGHT,
      };
    };

    const handleMouseMove = (event: MouseEvent) => {
      const point = toStagePoint(event);
      mouse.x = point.x;
      mouse.y = point.y;
      mouse.active = true;
    };
    const handleMouseLeave = () => {
      mouse.active = false;
    };

    const handleClick = (event: MouseEvent) => {
      const point = toStagePoint(event);
      const planted = plantFlower(point.x, point.y);
      // 앞뒤 순서는 baseY가 정한다. 심을 때마다 자리를 다시 맞춘다.
      flowers.push(planted);
      flowers.sort((a, b) => a.baseY - b.baseY);
      // 모션을 줄인 환경에서는 루프가 돌지 않으므로 즉시 반영하고 한 장 그린다.
      if (prefersReducedMotion) {
        planted.bloom = 1;
        renderFrame(0);
      }
    };

    const renderFrame = (time: number) => {
      context.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
      const seconds = time / 1000;

      for (const flower of flowers) {
        // 피어나는 것도 기우는 것과 같은 스프링이다. 마지막에 천천히 붙어야
        // 툭 켜지지 않고 벌어지는 것으로 읽힌다.
        if (flower.bloom !== flower.bloomTarget) {
          flower.bloom += (flower.bloomTarget - flower.bloom) * 0.055;
          if (flower.bloomTarget - flower.bloom < 0.001) {
            flower.bloom = flower.bloomTarget;
          }
        }

        const sway =
          Math.sin(seconds * flower.swaySpeed + flower.swayPhase) *
          flower.swayAmplitude;

        let target = sway;
        if (mouse.active) {
          const headY = flower.baseY - flowerHeight(flower);
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

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    // 심는 것은 모션이 아니라 상호작용이라 모션을 줄여도 남긴다.
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);

    if (prefersReducedMotion) {
      renderFrame(0);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      return () => {
        canvas.removeEventListener('click', handleClick);
        canvas.removeEventListener('mousemove', handleMouseMove);
      };
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseLeave);
    frameId = window.requestAnimationFrame(renderFrame);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
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
