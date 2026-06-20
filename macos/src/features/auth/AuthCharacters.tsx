import { useEffect, useRef, useState } from 'react';

// Playful mascot panel shown on the left of the auth screen. The shapes track
// the cursor with their eyes, lean while you type, glance at each other when a
// field is focused, and shyly look away (or sneakily peek) while you enter a
// password. Recoloured for the Subnota warm palette.

interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
  mousePosition: { x: number; y: number };
}

const useMouse = () => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const handle = (event: MouseEvent) => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = window.requestAnimationFrame(() => {
        setPos({ x: event.clientX, y: event.clientY });
        frameRef.current = null;
      });
    };

    window.addEventListener('mousemove', handle);
    return () => {
      window.removeEventListener('mousemove', handle);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);
  return pos;
};

const useBlinking = () => {
  const [isBlinking, setBlinking] = useState(false);

  useEffect(() => {
    let blinkTimer: number | undefined;
    let resetTimer: number | undefined;
    let disposed = false;

    const schedule = () => {
      blinkTimer = window.setTimeout(() => {
        if (disposed) return;
        setBlinking(true);
        resetTimer = window.setTimeout(() => {
          if (disposed) return;
          setBlinking(false);
          schedule();
        }, 150);
      }, Math.random() * 4000 + 3000);
    };

    schedule();
    return () => {
      disposed = true;
      if (blinkTimer !== undefined) window.clearTimeout(blinkTimer);
      if (resetTimer !== undefined) window.clearTimeout(resetTimer);
    };
  }, []);

  return isBlinking;
};

const Pupil = ({
  size = 12,
  maxDistance = 5,
  pupilColor = '#2D2D2D',
  forceLookX,
  forceLookY,
  mousePosition,
}: PupilProps) => {
  const { x: mouseX, y: mouseY } = mousePosition;
  const ref = useRef<HTMLDivElement>(null);

  const position = (() => {
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }
    if (!ref.current) return { x: 0, y: 0 };
    const rect = ref.current.getBoundingClientRect();
    const deltaX = mouseX - (rect.left + rect.width / 2);
    const deltaY = mouseY - (rect.top + rect.height / 2);
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);
    const angle = Math.atan2(deltaY, deltaX);
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
  })();

  return (
    <div
      ref={ref}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: pupilColor,
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    />
  );
};

interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
  mousePosition: { x: number; y: number };
}

const EyeBall = ({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = 'white',
  pupilColor = '#2D2D2D',
  isBlinking = false,
  forceLookX,
  forceLookY,
  mousePosition,
}: EyeBallProps) => {
  const { x: mouseX, y: mouseY } = mousePosition;
  const ref = useRef<HTMLDivElement>(null);

  const position = (() => {
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }
    if (!ref.current) return { x: 0, y: 0 };
    const rect = ref.current.getBoundingClientRect();
    const deltaX = mouseX - (rect.left + rect.width / 2);
    const deltaY = mouseY - (rect.top + rect.height / 2);
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);
    const angle = Math.atan2(deltaY, deltaX);
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
  })();

  return (
    <div
      ref={ref}
      style={{
        width: size,
        height: isBlinking ? 2 : size,
        borderRadius: '50%',
        backgroundColor: eyeColor,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {!isBlinking && (
        <div
          style={{
            width: pupilSize,
            height: pupilSize,
            borderRadius: '50%',
            backgroundColor: pupilColor,
            transform: `translate(${position.x}px, ${position.y}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
    </div>
  );
};

// Subnota warm palette mascots.
const CORAL = '#CC785C';
const INK = '#2D2D2D';
const SAND = '#EBA47E';
const GOLD = '#E8D754';

interface AuthCharactersProps {
  isTyping: boolean;
  password: string;
  showPassword: boolean;
}

const AuthCharacters = ({ isTyping, password, showPassword }: AuthCharactersProps) => {
  const mousePosition = useMouse();
  const { x: mouseX, y: mouseY } = mousePosition;
  const isCoralBlinking = useBlinking();
  const isInkBlinking = useBlinking();
  const [isLookingAtEachOther, setLookingAtEachOther] = useState(false);
  const [isPeeking, setPeeking] = useState(false);

  const coralRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const sandRef = useRef<HTMLDivElement>(null);
  const goldRef = useRef<HTMLDivElement>(null);

  const hidingPassword = password.length > 0 && !showPassword;
  const peekingPassword = password.length > 0 && showPassword;

  // Glance at each other briefly when a field is focused.
  useEffect(() => {
    if (!isTyping) {
      setLookingAtEachOther(false);
      return;
    }
    setLookingAtEachOther(true);
    const timer = setTimeout(() => setLookingAtEachOther(false), 800);
    return () => clearTimeout(timer);
  }, [isTyping]);

  // Sneaky peek while the password is visible.
  useEffect(() => {
    if (!peekingPassword) {
      setPeeking(false);
      return undefined;
    }

    let peekTimer: number | undefined;
    let resetTimer: number | undefined;
    let disposed = false;

    const schedule = () => {
      peekTimer = window.setTimeout(() => {
        if (disposed) return;
        setPeeking(true);
        resetTimer = window.setTimeout(() => {
          if (disposed) return;
          setPeeking(false);
          schedule();
        }, 800);
      }, Math.random() * 3000 + 2000);
    };

    schedule();
    return () => {
      disposed = true;
      if (peekTimer !== undefined) window.clearTimeout(peekTimer);
      if (resetTimer !== undefined) window.clearTimeout(resetTimer);
    };
  }, [peekingPassword]);

  const position = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const rect = ref.current.getBoundingClientRect();
    const deltaX = mouseX - (rect.left + rect.width / 2);
    const deltaY = mouseY - (rect.top + rect.height / 3);
    return {
      faceX: Math.max(-15, Math.min(15, deltaX / 20)),
      faceY: Math.max(-10, Math.min(10, deltaY / 30)),
      bodySkew: Math.max(-6, Math.min(6, -deltaX / 120)),
    };
  };

  const coral = position(coralRef);
  const ink = position(inkRef);
  const sand = position(sandRef);
  const gold = position(goldRef);

  return (
    <div style={{ position: 'relative', width: 550, height: 400 }}>
      {/* Coral tall character — back layer */}
      <div
        ref={coralRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 70,
          width: 180,
          height: isTyping || hidingPassword ? 440 : 400,
          backgroundColor: CORAL,
          borderRadius: '10px 10px 0 0',
          zIndex: 1,
          transformOrigin: 'bottom center',
          transition: 'all 0.7s ease-in-out',
          transform: peekingPassword
            ? 'skewX(0deg)'
            : isTyping || hidingPassword
              ? `skewX(${coral.bodySkew - 12}deg) translateX(40px)`
              : `skewX(${coral.bodySkew}deg)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            gap: 32,
            transition: 'all 0.7s ease-in-out',
            left: peekingPassword ? 20 : isLookingAtEachOther ? 55 : 45 + coral.faceX,
            top: peekingPassword ? 35 : isLookingAtEachOther ? 65 : 40 + coral.faceY,
          }}
        >
          {[0, 1].map(i => (
            <EyeBall
              key={i}
              size={18}
              pupilSize={7}
              maxDistance={5}
              isBlinking={isCoralBlinking}
              mousePosition={mousePosition}
              forceLookX={peekingPassword ? (isPeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
              forceLookY={peekingPassword ? (isPeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
            />
          ))}
        </div>
      </div>

      {/* Ink tall character — middle layer */}
      <div
        ref={inkRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 240,
          width: 120,
          height: 310,
          backgroundColor: INK,
          borderRadius: '8px 8px 0 0',
          zIndex: 2,
          transformOrigin: 'bottom center',
          transition: 'all 0.7s ease-in-out',
          transform: peekingPassword
            ? 'skewX(0deg)'
            : isLookingAtEachOther
              ? `skewX(${ink.bodySkew * 1.5 + 10}deg) translateX(20px)`
              : isTyping || hidingPassword
                ? `skewX(${ink.bodySkew * 1.5}deg)`
                : `skewX(${ink.bodySkew}deg)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            gap: 24,
            transition: 'all 0.7s ease-in-out',
            left: peekingPassword ? 10 : isLookingAtEachOther ? 32 : 26 + ink.faceX,
            top: peekingPassword ? 28 : isLookingAtEachOther ? 12 : 32 + ink.faceY,
          }}
        >
          {[0, 1].map(i => (
            <EyeBall
              key={i}
              size={16}
              pupilSize={6}
              maxDistance={4}
              isBlinking={isInkBlinking}
              mousePosition={mousePosition}
              forceLookX={peekingPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
              forceLookY={peekingPassword ? -4 : isLookingAtEachOther ? -4 : undefined}
            />
          ))}
        </div>
      </div>

      {/* Sand semicircle — front left */}
      <div
        ref={sandRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 240,
          height: 200,
          backgroundColor: SAND,
          borderRadius: '120px 120px 0 0',
          zIndex: 3,
          transformOrigin: 'bottom center',
          transition: 'all 0.7s ease-in-out',
          transform: peekingPassword ? 'skewX(0deg)' : `skewX(${sand.bodySkew}deg)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            gap: 32,
            transition: 'all 0.2s ease-out',
            left: peekingPassword ? 50 : 82 + sand.faceX,
            top: peekingPassword ? 85 : 90 + sand.faceY,
          }}
        >
          {[0, 1].map(i => (
            <Pupil
              key={i}
              size={12}
              maxDistance={5}
              forceLookX={peekingPassword ? -5 : undefined}
              forceLookY={peekingPassword ? -4 : undefined}
              mousePosition={mousePosition}
            />
          ))}
        </div>
      </div>

      {/* Gold tall character — front right */}
      <div
        ref={goldRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 310,
          width: 140,
          height: 230,
          backgroundColor: GOLD,
          borderRadius: '70px 70px 0 0',
          zIndex: 4,
          transformOrigin: 'bottom center',
          transition: 'all 0.7s ease-in-out',
          transform: peekingPassword ? 'skewX(0deg)' : `skewX(${gold.bodySkew}deg)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            gap: 24,
            transition: 'all 0.2s ease-out',
            left: peekingPassword ? 20 : 52 + gold.faceX,
            top: peekingPassword ? 35 : 40 + gold.faceY,
          }}
        >
          {[0, 1].map(i => (
            <Pupil
              key={i}
              size={12}
              maxDistance={5}
              forceLookX={peekingPassword ? -5 : undefined}
              forceLookY={peekingPassword ? -4 : undefined}
              mousePosition={mousePosition}
            />
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            width: 80,
            height: 4,
            backgroundColor: INK,
            borderRadius: 9999,
            transition: 'all 0.2s ease-out',
            left: peekingPassword ? 10 : 40 + gold.faceX,
            top: peekingPassword ? 88 : 88 + gold.faceY,
          }}
        />
      </div>
    </div>
  );
};

export default AuthCharacters;
