import { useEffect, useMemo, useRef, useState } from 'react';

const WORLD = {
  width: 980,
  height: 520,
  gravity: 0.55,
  moveSpeed: 1.1,
  maxSafeFall: 80,
  maxLemmings: 30,
  spawnIntervalMs: 900,
  timeLimitSec: 180,
};

const LEVEL = {
  hatch: { x: 100, y: 48 },
  exit: { x: 875, y: 406, width: 36, height: 58 },
  platforms: [
    { x: 0, y: 460, width: 980, height: 60 },
    { x: 70, y: 375, width: 210, height: 16 },
    { x: 260, y: 316, width: 245, height: 16 },
    { x: 520, y: 260, width: 220, height: 16 },
    { x: 730, y: 195, width: 170, height: 16 },
    { x: 655, y: 370, width: 170, height: 16 },
  ],
};

const SKILLS = [
  { id: 'blocker', label: 'Blocker', uses: 4 },
  { id: 'builder', label: 'Builder', uses: 7 },
  { id: 'parachute', label: 'Floater', uses: 6 },
  { id: 'digger', label: 'Digger', uses: 6 },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const circleRectCollide = (cx, cy, r, rect) =>
  cx + r > rect.x && cx - r < rect.x + rect.width && cy + r > rect.y && cy - r < rect.y + rect.height;

const platformBelow = (x, y, radius, platforms) => {
  const footY = y + radius;
  for (const p of platforms) {
    if (x + radius > p.x && x - radius < p.x + p.width && footY >= p.y - 2 && footY <= p.y + 8) {
      return p;
    }
  }
  return null;
};

const initialSkills = SKILLS.reduce((acc, item) => {
  acc[item.id] = item.uses;
  return acc;
}, {});

function App() {
  const [lemmings, setLemmings] = useState([]);
  const [nextId, setNextId] = useState(1);
  const [spawned, setSpawned] = useState(0);
  const [saved, setSaved] = useState(0);
  const [lost, setLost] = useState(0);
  const [timer, setTimer] = useState(WORLD.timeLimitSec);
  const [activeSkill, setActiveSkill] = useState('builder');
  const [skillCount, setSkillCount] = useState(initialSkills);
  const [bridges, setBridges] = useState([]);
  const [craters, setCraters] = useState([]);
  const [running, setRunning] = useState(true);

  const gameRef = useRef(null);
  const lastSpawnRef = useRef(0);

  const platforms = useMemo(() => {
    if (!craters.length) return LEVEL.platforms;

    return LEVEL.platforms.flatMap((platform) => {
      const hits = craters.filter(
        (c) => c.y >= platform.y - 6 && c.y <= platform.y + platform.height + 6 && c.x + c.radius > platform.x && c.x - c.radius < platform.x + platform.width,
      );

      if (!hits.length) return [platform];

      const cuts = hits
        .map((h) => ({ start: clamp(h.x - h.radius, platform.x, platform.x + platform.width), end: clamp(h.x + h.radius, platform.x, platform.x + platform.width) }))
        .sort((a, b) => a.start - b.start);

      const merged = [];
      for (const cut of cuts) {
        const last = merged[merged.length - 1];
        if (!last || cut.start > last.end) merged.push({ ...cut });
        else last.end = Math.max(last.end, cut.end);
      }

      const pieces = [];
      let cursor = platform.x;
      for (const hole of merged) {
        if (hole.start - cursor > 26) {
          pieces.push({ ...platform, x: cursor, width: hole.start - cursor });
        }
        cursor = hole.end;
      }
      if (platform.x + platform.width - cursor > 26) {
        pieces.push({ ...platform, x: cursor, width: platform.x + platform.width - cursor });
      }
      return pieces;
    });
  }, [craters]);

  const solidPlatforms = useMemo(() => [...platforms, ...bridges], [platforms, bridges]);

  useEffect(() => {
    if (!running) return undefined;
    const interval = setInterval(() => {
      setTimer((value) => {
        if (value <= 1) {
          setRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!running) return undefined;

    let animationFrame;
    let prev = performance.now();

    const tick = (now) => {
      const dt = Math.min(32, now - prev);
      prev = now;

      if (spawned < WORLD.maxLemmings && now - lastSpawnRef.current > WORLD.spawnIntervalMs) {
        lastSpawnRef.current = now;
        setLemmings((current) => [
          ...current,
          {
            id: nextId,
            x: LEVEL.hatch.x,
            y: LEVEL.hatch.y,
            vx: WORLD.moveSpeed,
            vy: 0,
            dir: 1,
            radius: 8,
            state: 'walking',
            skill: null,
            fallDistance: 0,
          },
        ]);
        setSpawned((v) => v + 1);
        setNextId((v) => v + 1);
      }

      setLemmings((current) => {
        const updated = [];

        for (const l of current) {
          let x = l.x;
          let y = l.y;
          let vx = l.vx;
          let vy = l.vy;
          let dir = l.dir;
          let state = l.state;
          let skill = l.skill;
          let fallDistance = l.fallDistance;

          const speedFactor = dt / 16;

          if (state === 'blocked') {
            vx = 0;
          } else {
            vx = WORLD.moveSpeed * dir;
          }

          const ground = platformBelow(x, y, l.radius, solidPlatforms);

          if (!ground || state === 'falling') {
            if (skill === 'parachute') {
              vy = clamp(vy + WORLD.gravity * 0.35 * speedFactor, -5, 1.25);
            } else {
              vy += WORLD.gravity * speedFactor;
            }
            y += vy * speedFactor;
            state = 'falling';
            fallDistance += Math.abs(vy * speedFactor);
          } else {
            y = ground.y - l.radius;
            vy = 0;
            if (fallDistance > WORLD.maxSafeFall && skill !== 'parachute') {
              setLost((v) => v + 1);
              continue;
            }
            fallDistance = 0;
            state = state === 'blocked' ? 'blocked' : 'walking';
          }

          const front = { x: x + dir * (l.radius + 2), y, width: 4, height: l.radius * 2 };
          const blockedByWall = solidPlatforms.some((p) => circleRectCollide(front.x, front.y, l.radius, p) && y + l.radius > p.y + 2);
          const blockedByLemming = current.some((other) => other.id !== l.id && other.state === 'blocked' && Math.abs(other.x - x) < 14 && Math.abs(other.y - y) < 14);
          if (blockedByWall || blockedByLemming) {
            dir *= -1;
          }

          if (skill === 'digger' && ground) {
            setCraters((existing) => {
              if (existing.length > 40) return existing;
              return [...existing, { x, y: ground.y + 4, radius: 14 }];
            });
          }

          if (skill === 'builder' && ground) {
            const shouldPlace = Math.floor(now / 250 + l.id) % 7 === 0;
            if (shouldPlace) {
              const block = {
                x: x + dir * 10,
                y: y + 12 - 8,
                width: 20,
                height: 8,
              };
              setBridges((existing) => (existing.length > 90 ? existing : [...existing, block]));
              y -= 3;
            }
          }

          x += vx * speedFactor;

          if (x < l.radius) {
            x = l.radius;
            dir = 1;
          }
          if (x > WORLD.width - l.radius) {
            x = WORLD.width - l.radius;
            dir = -1;
          }

          if (circleRectCollide(x, y, l.radius, LEVEL.exit)) {
            setSaved((v) => v + 1);
            continue;
          }

          if (y > WORLD.height + 30) {
            setLost((v) => v + 1);
            continue;
          }

          updated.push({ ...l, x, y, vx, vy, dir, state, skill, fallDistance });
        }

        return updated;
      });

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [nextId, running, solidPlatforms, spawned]);

  useEffect(() => {
    if (!running) return;
    const finished = spawned >= WORLD.maxLemmings && lemmings.length === 0;
    if (finished) setRunning(false);
  }, [lemmings.length, running, spawned]);

  const assignSkill = (lemmingId) => {
    if (!activeSkill || skillCount[activeSkill] <= 0) return;

    setSkillCount((count) => ({
      ...count,
      [activeSkill]: Math.max(0, count[activeSkill] - 1),
    }));

    setLemmings((current) =>
      current.map((l) => {
        if (l.id !== lemmingId) return l;
        if (activeSkill === 'blocker') {
          return { ...l, state: 'blocked', skill: null, vx: 0, dir: 0 };
        }
        return { ...l, skill: activeSkill, state: 'walking', dir: l.dir || 1 };
      }),
    );
  };

  const rescuedPercent = Math.round((saved / WORLD.maxLemmings) * 100);
  const required = 55;

  const resetGame = () => {
    setLemmings([]);
    setNextId(1);
    setSpawned(0);
    setSaved(0);
    setLost(0);
    setTimer(WORLD.timeLimitSec);
    setActiveSkill('builder');
    setSkillCount(initialSkills);
    setBridges([]);
    setCraters([]);
    setRunning(true);
    lastSpawnRef.current = 0;
  };

  return (
    <main className="app-shell">
      <header>
        <h1>React Lemmings</h1>
        <p>Guide enough tiny walkers to the glowing exit before the clock runs out.</p>
      </header>

      <section className="hud">
        <div>Time: {timer}s</div>
        <div>Spawned: {spawned}/{WORLD.maxLemmings}</div>
        <div>Saved: {saved}</div>
        <div>Lost: {lost}</div>
        <div>Requirement: {required}%</div>
      </section>

      <section className="skills">
        {SKILLS.map((skill) => (
          <button
            key={skill.id}
            type="button"
            className={skill.id === activeSkill ? 'active' : ''}
            onClick={() => setActiveSkill(skill.id)}
          >
            {skill.label}: {skillCount[skill.id]}
          </button>
        ))}
      </section>

      <div className="arena" ref={gameRef}>
        <div className="hatch" style={{ left: LEVEL.hatch.x - 18, top: LEVEL.hatch.y - 18 }} />
        <div className="exit" style={{ left: LEVEL.exit.x, top: LEVEL.exit.y }} />

        {solidPlatforms.map((platform, index) => (
          <div
            key={`ground-${index}`}
            className={index >= platforms.length ? 'platform bridge' : 'platform'}
            style={{
              left: platform.x,
              top: platform.y,
              width: platform.width,
              height: platform.height,
            }}
          />
        ))}

        {lemmings.map((l) => (
          <button
            type="button"
            key={l.id}
            className={`lemming ${l.state === 'blocked' ? 'blocked' : ''} ${l.skill ? `skill-${l.skill}` : ''}`}
            style={{ left: l.x - l.radius, top: l.y - l.radius }}
            onClick={() => assignSkill(l.id)}
            title="Click to assign selected skill"
          >
            <span className="hair" />
          </button>
        ))}

        {!running && (
          <div className="overlay">
            <h2>{rescuedPercent >= required ? 'You rescued them!' : 'Level failed'}</h2>
            <p>
              Saved {saved}/{WORLD.maxLemmings} lemmings ({rescuedPercent}%).
            </p>
            <button type="button" onClick={resetGame}>Play again</button>
          </div>
        )}
      </div>

      <footer>
        <p>
          Select a skill, then click a lemming to apply it. Blockers turn around crowds; builders create upward steps;
          floaters survive huge drops; diggers chew through floors.
        </p>
      </footer>
    </main>
  );
}

export default App;
