import { createRng, mixSeed, normalizeSeed } from './rng.js?v=1.0.0';

export const MAP_WIDTH = 15;
export const MAP_HEIGHT = 11;
export const FINAL_FLOOR = 100;

export const ENEMY_TYPES = {
  cleaner: { name: '清掃ロボ', glyph: '掃', health: 3, damage: 1, description: '廊下を巡回する' },
  drone: { name: '警備ドローン', glyph: '警', health: 4, damage: 2, description: '近づくと追跡する' },
  shadow: { name: '影の住人', glyph: '影', health: 3, damage: 1, description: '気まぐれに距離を詰める' },
  cart: { name: '暴走台車', glyph: '車', health: 5, damage: 1, packageDamage: 2, description: '荷物にもぶつかる' },
};

export const ITEM_TYPES = {
  drink: { name: '栄養ドリンク', glyph: '飲', description: '体力を5回復' },
  tape: { name: 'ガムテープ', glyph: '貼', description: '荷物状態を4回復' },
  padding: { name: '緩衝材', glyph: '緩', description: '次の荷物ダメージを無効化' },
};

export const SKILLS = {
  safetyShoes: { name: '安全靴', glyph: '靴', description: '罠の荷物ダメージを1軽減' },
  reinforced: { name: '補強梱包', glyph: '箱', description: '荷物の最大値と状態を3増加' },
  nightVision: { name: '夜間視力', glyph: '眼', description: '見える範囲が1マス広がる' },
  intuition: { name: '配達勘', glyph: '勘', description: '出口へ続く床を表示する' },
  selfDefense: { name: '護身術', glyph: '腕', description: '攻撃力が1増加' },
  spareSlip: { name: '予備伝票', glyph: '伝', description: '荷物破損を一度だけ耐える' },
  firstAid: { name: '応急手当', glyph: '療', description: '最大体力と体力を3増加' },
  softHandling: { name: '取扱注意', glyph: '注', description: '緩衝材を2個得る' },
};

const directions = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const keyOf = (x, y) => `${x},${y}`;
const samePosition = (left, right) => left.x === right.x && left.y === right.y;
const manhattan = (left, right) => Math.abs(left.x - right.x) + Math.abs(left.y - right.y);

export function findPath(tiles, start, goal, blocked = new Set()) {
  const queue = [{ ...start }];
  const visited = new Set([keyOf(start.x, start.y)]);
  const previous = new Map();

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (samePosition(current, goal)) {
      const path = [current];
      let cursor = keyOf(current.x, current.y);
      while (previous.has(cursor)) {
        const prior = previous.get(cursor);
        path.push(prior);
        cursor = keyOf(prior.x, prior.y);
      }
      return path.reverse();
    }
    for (const direction of directions) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const nextKey = keyOf(next.x, next.y);
      if (tiles[next.y]?.[next.x] !== '.' || visited.has(nextKey) || blocked.has(nextKey)) continue;
      visited.add(nextKey);
      previous.set(nextKey, current);
      queue.push(next);
    }
  }
  return [];
}

export function generateMaze(seed, width = MAP_WIDTH, height = MAP_HEIGHT) {
  const safeWidth = width % 2 === 0 ? width - 1 : width;
  const safeHeight = height % 2 === 0 ? height - 1 : height;
  const tiles = Array.from({ length: safeHeight }, () => Array(safeWidth).fill('#'));
  const rng = createRng(seed);
  const start = { x: 1, y: 1 };
  const stack = [start];
  tiles[start.y][start.x] = '.';

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const candidates = rng.shuffle(directions).map((direction) => ({
      x: current.x + direction.x * 2,
      y: current.y + direction.y * 2,
      wallX: current.x + direction.x,
      wallY: current.y + direction.y,
    })).filter((candidate) => (
      candidate.x > 0 && candidate.x < safeWidth - 1
      && candidate.y > 0 && candidate.y < safeHeight - 1
      && tiles[candidate.y][candidate.x] === '#'
    ));

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const next = candidates[0];
    tiles[next.wallY][next.wallX] = '.';
    tiles[next.y][next.x] = '.';
    stack.push({ x: next.x, y: next.y });
  }

  // A few loops make retreating around enemies possible without losing maze readability.
  const walls = [];
  for (let y = 1; y < safeHeight - 1; y += 1) {
    for (let x = 1; x < safeWidth - 1; x += 1) {
      if (tiles[y][x] !== '#') continue;
      const horizontal = tiles[y][x - 1] === '.' && tiles[y][x + 1] === '.';
      const vertical = tiles[y - 1][x] === '.' && tiles[y + 1][x] === '.';
      if (horizontal || vertical) walls.push({ x, y });
    }
  }
  for (const wall of rng.shuffle(walls).slice(0, 4)) tiles[wall.y][wall.x] = '.';

  let exit = start;
  let greatestDistance = -1;
  for (let y = 1; y < safeHeight - 1; y += 1) {
    for (let x = 1; x < safeWidth - 1; x += 1) {
      if (tiles[y][x] !== '.') continue;
      const path = findPath(tiles, start, { x, y });
      if (path.length > greatestDistance) {
        greatestDistance = path.length;
        exit = { x, y };
      }
    }
  }

  return { width: safeWidth, height: safeHeight, tiles, start, exit };
}

function availableFloorCells(map, minimumStartDistance = 4) {
  const cells = [];
  for (let y = 1; y < map.height - 1; y += 1) {
    for (let x = 1; x < map.width - 1; x += 1) {
      const position = { x, y };
      if (map.tiles[y][x] !== '.' || samePosition(position, map.start) || samePosition(position, map.exit)) continue;
      if (manhattan(position, map.start) >= minimumStartDistance) cells.push(position);
    }
  }
  return cells;
}

export function createZone(seed, zoneIndex) {
  const zoneSeed = mixSeed(seed, `zone:${zoneIndex}`);
  const map = generateMaze(zoneSeed);
  const rng = createRng(mixSeed(zoneSeed, 'contents'));
  const cells = rng.shuffle(availableFloorCells(map));
  const taken = new Set();
  const takeCell = () => {
    const cell = cells.find((candidate) => !taken.has(keyOf(candidate.x, candidate.y)));
    if (!cell) return { ...map.start };
    taken.add(keyOf(cell.x, cell.y));
    return { ...cell };
  };

  const enemyCount = Math.min(5, 1 + Math.floor(zoneIndex / 2));
  const unlockedTypes = ['cleaner'];
  if (zoneIndex >= 2) unlockedTypes.push('drone');
  if (zoneIndex >= 4) unlockedTypes.push('shadow');
  if (zoneIndex >= 6) unlockedTypes.push('cart');
  const enemies = Array.from({ length: enemyCount }, (_, index) => {
    const type = unlockedTypes[(index + rng.int(unlockedTypes.length)) % unlockedTypes.length];
    const template = ENEMY_TYPES[type];
    return {
      id: `z${zoneIndex}-e${index}`,
      type,
      ...takeCell(),
      health: template.health + Math.floor(zoneIndex / 5),
    };
  });

  const itemCount = zoneIndex < 4 ? 2 : 1;
  const itemTypes = ['drink', 'tape', 'padding'];
  const items = Array.from({ length: itemCount }, (_, index) => ({
    id: `z${zoneIndex}-i${index}`,
    type: itemTypes[(zoneIndex + index + rng.int(itemTypes.length)) % itemTypes.length],
    ...takeCell(),
  }));

  const trapCount = Math.min(3, Math.floor((zoneIndex + 1) / 3));
  const traps = Array.from({ length: trapCount }, (_, index) => ({
    id: `z${zoneIndex}-t${index}`,
    active: true,
    ...takeCell(),
  }));

  return {
    ...map,
    seed: zoneSeed,
    enemies,
    items,
    traps,
    rngStep: 0,
  };
}

export function createGame(seed, label = '本日の便') {
  const normalizedSeed = normalizeSeed(seed);
  const zone = createZone(normalizedSeed, 0);
  return {
    seed: normalizedSeed,
    label,
    floor: 10,
    zoneIndex: 0,
    status: 'playing',
    resultReason: null,
    player: { ...zone.start },
    health: 16,
    maxHealth: 16,
    package: 14,
    maxPackage: 14,
    attack: 2,
    turns: 0,
    vision: 3,
    trapReduction: 0,
    padding: 0,
    insurance: 0,
    intuition: false,
    skills: [],
    pendingSkills: [],
    zone,
    log: [`B10。荷物用エレベーターの扉が開いた。`, '出口「降」まで荷物を運ぼう。'],
  };
}

function addLog(state, message) {
  state.log = [message, ...state.log].slice(0, 5);
}

function enemyAt(state, position, ignoredId = null) {
  return state.zone.enemies.find((enemy) => enemy.health > 0 && enemy.id !== ignoredId && samePosition(enemy, position));
}

function applyPackageDamage(state, amount, source) {
  if (amount <= 0) return;
  if (state.padding > 0) {
    state.padding -= 1;
    addLog(state, `緩衝材が${source}から荷物を守った。`);
    return;
  }
  state.package = Math.max(0, state.package - amount);
  addLog(state, `${source}。荷物状態 -${amount}。`);
  if (state.package === 0 && state.insurance > 0) {
    state.insurance -= 1;
    state.package = 1;
    addLog(state, '予備伝票で破損扱いを一度だけ免れた。');
  }
}

function checkFailure(state) {
  if (state.health <= 0) {
    state.status = 'lost';
    state.resultReason = '体力が尽き、配達を続けられなかった';
    addLog(state, '本日の配達はここで終了。');
  } else if (state.package <= 0) {
    state.status = 'lost';
    state.resultReason = '荷物が配達できない状態になった';
    addLog(state, '荷物破損につき、配達中止。');
  }
}

function pickUpItems(state) {
  const item = state.zone.items.find((candidate) => samePosition(candidate, state.player));
  if (!item) return;
  state.zone.items = state.zone.items.filter((candidate) => candidate.id !== item.id);
  if (item.type === 'drink') {
    const before = state.health;
    state.health = Math.min(state.maxHealth, state.health + 5);
    addLog(state, `栄養ドリンク。体力 +${state.health - before}。`);
  } else if (item.type === 'tape') {
    const before = state.package;
    state.package = Math.min(state.maxPackage, state.package + 4);
    addLog(state, `ガムテープ。荷物状態 +${state.package - before}。`);
  } else {
    state.padding += 1;
    addLog(state, '緩衝材を確保。次の荷物ダメージを防ぐ。');
  }
}

function triggerTrap(state) {
  const trap = state.zone.traps.find((candidate) => candidate.active && samePosition(candidate, state.player));
  if (!trap) return;
  trap.active = false;
  const damage = Math.max(0, 2 - state.trapReduction);
  if (damage === 0) addLog(state, '段差を安全靴で踏ん張った。');
  else applyPackageDamage(state, damage, '段差で荷物が揺れた');
}

function enemyAttack(state, enemy) {
  const template = ENEMY_TYPES[enemy.type];
  state.health = Math.max(0, state.health - template.damage);
  addLog(state, `${template.name}の接触。体力 -${template.damage}。`);
  if (template.packageDamage) applyPackageDamage(state, template.packageDamage, `${template.name}が台車へ衝突`);
}

function clearLine(zone, from, to) {
  if (from.x !== to.x && from.y !== to.y) return false;
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  let x = from.x + dx;
  let y = from.y + dy;
  while (x !== to.x || y !== to.y) {
    if (zone.tiles[y]?.[x] !== '.') return false;
    x += dx;
    y += dy;
  }
  return true;
}

function patrolStep(state, enemy) {
  const offset = (state.turns + Number(enemy.id.split('e').at(-1))) % directions.length;
  for (let index = 0; index < directions.length; index += 1) {
    const direction = directions[(offset + index) % directions.length];
    const next = { x: enemy.x + direction.x, y: enemy.y + direction.y };
    if (state.zone.tiles[next.y]?.[next.x] === '.' && !enemyAt(state, next, enemy.id)) return next;
  }
  return enemy;
}

function chaseStep(state, enemy) {
  const blocked = new Set(state.zone.enemies
    .filter((candidate) => candidate.health > 0 && candidate.id !== enemy.id)
    .map((candidate) => keyOf(candidate.x, candidate.y)));
  const path = findPath(state.zone.tiles, enemy, state.player, blocked);
  return path[1] ?? enemy;
}

function moveEnemies(state) {
  for (const enemy of state.zone.enemies) {
    if (enemy.health <= 0 || state.status !== 'playing') continue;
    if (manhattan(enemy, state.player) === 1) {
      enemyAttack(state, enemy);
      checkFailure(state);
      continue;
    }

    let next = enemy;
    const distance = manhattan(enemy, state.player);
    if (enemy.type === 'drone' && distance <= 6) next = chaseStep(state, enemy);
    else if (enemy.type === 'shadow' && (state.turns + state.zone.rngStep) % 3 !== 0 && distance <= 7) next = chaseStep(state, enemy);
    else if (enemy.type === 'cart' && distance <= 7 && clearLine(state.zone, enemy, state.player)) next = chaseStep(state, enemy);
    else next = patrolStep(state, enemy);
    state.zone.rngStep += 1;

    if (samePosition(next, state.player)) enemyAttack(state, enemy);
    else if (!enemyAt(state, next, enemy.id)) {
      enemy.x = next.x;
      enemy.y = next.y;
    }
    checkFailure(state);
  }
}

export function getSkillChoices(seed, zoneIndex) {
  const rng = createRng(mixSeed(seed, `skills:${zoneIndex}`));
  return rng.shuffle(Object.keys(SKILLS)).slice(0, 3);
}

export function takeTurn(state, dx, dy) {
  if (state.status !== 'playing') return { acted: false, event: 'inactive' };
  if (Math.abs(dx) + Math.abs(dy) !== 1) return { acted: false, event: 'invalid' };
  const target = { x: state.player.x + dx, y: state.player.y + dy };
  if (state.zone.tiles[target.y]?.[target.x] !== '.') {
    addLog(state, '壁の向こうは配達区域外だ。');
    return { acted: false, event: 'wall' };
  }

  const enemy = enemyAt(state, target);
  state.turns += 1;
  if (enemy) {
    enemy.health -= state.attack;
    addLog(state, `${ENEMY_TYPES[enemy.type].name}を押し返した。-${state.attack}。`);
    if (enemy.health <= 0) addLog(state, `${ENEMY_TYPES[enemy.type].name}は停止した。`);
  } else {
    state.player = target;
    pickUpItems(state);
    triggerTrap(state);
    checkFailure(state);
    if (state.status !== 'playing') return { acted: true, event: 'lost' };
    if (samePosition(state.player, state.zone.exit)) {
      if (state.floor >= FINAL_FLOOR) {
        state.status = 'won';
        state.resultReason = 'B100の受取人へ、荷物を届けた';
        addLog(state, '「確かに。お疲れさまでした」');
        return { acted: true, event: 'won' };
      }
      state.status = 'skill';
      state.pendingSkills = getSkillChoices(state.seed, state.zoneIndex);
      addLog(state, `B${state.floor}を通過。次の配達準備を選ぼう。`);
      return { acted: true, event: 'skill' };
    }
  }

  moveEnemies(state);
  checkFailure(state);
  return { acted: true, event: state.status === 'lost' ? 'lost' : enemy ? 'attack' : 'move' };
}

export function chooseSkill(state, skillId) {
  if (state.status !== 'skill' || !state.pendingSkills.includes(skillId) || !SKILLS[skillId]) return false;
  if (skillId === 'safetyShoes') state.trapReduction += 1;
  else if (skillId === 'reinforced') {
    state.maxPackage += 3;
    state.package += 3;
  } else if (skillId === 'nightVision') state.vision += 1;
  else if (skillId === 'intuition') state.intuition = true;
  else if (skillId === 'selfDefense') state.attack += 1;
  else if (skillId === 'spareSlip') state.insurance += 1;
  else if (skillId === 'firstAid') {
    state.maxHealth += 3;
    state.health += 3;
  } else if (skillId === 'softHandling') state.padding += 2;

  state.skills.push(skillId);
  state.zoneIndex += 1;
  state.floor = (state.zoneIndex + 1) * 10;
  state.health = Math.min(state.maxHealth, state.health + 2);
  state.zone = createZone(state.seed, state.zoneIndex);
  state.player = { ...state.zone.start };
  state.status = 'playing';
  state.pendingSkills = [];
  addLog(state, `${SKILLS[skillId].name}を選択。B${state.floor}へ降りる。`);
  return true;
}

export function calculateScore(state) {
  const successful = state.status === 'won';
  const progress = state.floor * 30;
  const delivery = successful ? 5000 : 0;
  const packageBonus = state.package * 120;
  const healthBonus = state.health * 80;
  const turnBonus = successful ? Math.max(0, 1800 - state.turns * 5) : 0;
  const total = Math.max(0, progress + delivery + packageBonus + healthBonus + turnBonus);
  return { progress, delivery, packageBonus, healthBonus, turnBonus, total };
}

export function getExitPath(state) {
  return findPath(state.zone.tiles, state.player, state.zone.exit);
}
