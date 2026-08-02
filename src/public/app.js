import {
  ENEMY_TYPES,
  ITEM_TYPES,
  SKILLS,
  calculateScore,
  chooseSkill,
  createGame,
  getExitPath,
  takeTurn,
} from './game/logic.js?v=1.0.0';
import { normalizeSeed } from './game/rng.js?v=1.0.0';

const elements = Object.fromEntries([
  'connection-status', 'title-screen', 'game-screen', 'skill-screen', 'result-screen',
  'daily-label', 'start-button', 'howto-button', 'title-best', 'game-map', 'floor-label',
  'turn-count', 'health-value', 'health-meter', 'package-value', 'package-meter', 'effects-list',
  'action-log', 'cleared-floor', 'skill-choices', 'result-kicker', 'result-title', 'result-reason',
  'total-score', 'best-result', 'result-floor', 'result-package', 'result-health', 'result-turns',
  'score-breakdown', 'retry-button', 'back-button', 'howto-dialog', 'howto-close', 'howto-start',
].map((id) => [id, document.getElementById(id)]));

const screens = [elements['title-screen'], elements['game-screen'], elements['skill-screen'], elements['result-screen']];
const bestStorageKey = 'chika100.best.v1';
const moveVectors = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
};

let daily = null;
let game = null;
let inputLocked = false;
let touchStart = null;

function showScreen(target) {
  for (const screen of screens) screen.hidden = screen !== target;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getBest() {
  try {
    const value = Number(localStorage.getItem(bestStorageKey));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function setBest(score) {
  try {
    localStorage.setItem(bestStorageKey, String(score));
  } catch {
    // Private browsing modes can deny storage; the game still works for this session.
  }
}

function formatScore(value) {
  return Math.round(value).toLocaleString('ja-JP');
}

function japanDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function fallbackDaily() {
  const date = japanDate();
  return {
    date,
    label: `${date}便`,
    seed: normalizeSeed(`chika100:daily:v1:${date}`),
    seedVersion: 1,
  };
}

async function loadDaily() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4500);
  try {
    const [dailyResponse, configResponse] = await Promise.all([
      fetch('/api/daily', { signal: controller.signal }),
      fetch('/api/config', { signal: controller.signal }),
    ]);
    if (!dailyResponse.ok || !configResponse.ok) throw new Error('API unavailable');
    daily = await dailyResponse.json();
    const config = await configResponse.json();
    elements['connection-status'].textContent = `配達システム稼働中 / v${config.version}`;
    elements['connection-status'].className = 'connection-status is-online';
  } catch {
    daily = fallbackDaily();
    elements['connection-status'].textContent = 'オフライン便で運行中';
    elements['connection-status'].className = 'connection-status is-fallback';
  } finally {
    window.clearTimeout(timer);
    elements['daily-label'].textContent = daily.label;
    elements['start-button'].disabled = false;
    elements['howto-start'].disabled = false;
  }
}

function updateBestDisplay() {
  const best = getBest();
  elements['title-best'].textContent = best ? `${formatScore(best)}点` : '記録なし';
}

function startGame() {
  if (!daily) daily = fallbackDaily();
  game = createGame(daily.seed, daily.label);
  elements['howto-dialog'].close();
  showScreen(elements['game-screen']);
  renderGame();
}

function isVisible(position) {
  const distance = Math.abs(position.x - game.player.x) + Math.abs(position.y - game.player.y);
  return distance <= game.vision;
}

function entityAt(values, x, y, predicate = () => true) {
  return values.find((value) => value.x === x && value.y === y && predicate(value));
}

function renderMap() {
  const { zone } = game;
  const fragment = document.createDocumentFragment();
  const pathKeys = new Set(game.intuition ? getExitPath(game).map(({ x, y }) => `${x},${y}`) : []);

  for (let y = 0; y < zone.height; y += 1) {
    for (let x = 0; x < zone.width; x += 1) {
      const cell = document.createElement('div');
      const isWall = zone.tiles[y][x] === '#';
      const visible = isVisible({ x, y });
      cell.className = `cell ${isWall ? 'wall' : 'floor'}${visible ? '' : ' dim'}`;
      if (!isWall && pathKeys.has(`${x},${y}`)) cell.classList.add('path');
      let glyph = '';
      let className = '';
      let label = '';

      if (game.player.x === x && game.player.y === y) {
        glyph = '配'; className = 'player'; label = '配達員';
      } else if (zone.exit.x === x && zone.exit.y === y) {
        glyph = '降'; className = 'exit'; label = '下りエレベーター';
        cell.classList.remove('dim');
      } else if (visible) {
        const enemy = entityAt(zone.enemies, x, y, (candidate) => candidate.health > 0);
        const item = entityAt(zone.items, x, y);
        const trap = entityAt(zone.traps, x, y, (candidate) => candidate.active);
        if (enemy) {
          glyph = ENEMY_TYPES[enemy.type].glyph; className = 'enemy'; label = ENEMY_TYPES[enemy.type].name;
        } else if (item) {
          glyph = ITEM_TYPES[item.type].glyph; className = 'item'; label = ITEM_TYPES[item.type].name;
        } else if (trap) {
          glyph = '段'; className = 'trap'; label = '荷物が揺れる段差';
        }
      }

      if (glyph) {
        const marker = document.createElement('span');
        marker.textContent = glyph;
        marker.title = label;
        cell.append(marker);
        cell.classList.add(className);
      }
      fragment.append(cell);
    }
  }
  elements['game-map'].replaceChildren(fragment);
}

function renderStatus() {
  elements['floor-label'].textContent = `地下${game.floor}階`;
  elements['turn-count'].textContent = game.turns;
  elements['health-value'].textContent = `${game.health} / ${game.maxHealth}`;
  elements['package-value'].textContent = `${game.package} / ${game.maxPackage}`;
  const healthPercent = Math.max(0, game.health / game.maxHealth * 100);
  const packagePercent = Math.max(0, game.package / game.maxPackage * 100);
  elements['health-meter'].style.width = `${healthPercent}%`;
  elements['package-meter'].style.width = `${packagePercent}%`;
  elements['health-meter'].classList.toggle('is-low', healthPercent <= 30);
  elements['package-meter'].classList.toggle('is-low', packagePercent <= 30);

  const effects = [];
  if (game.attack > 2) effects.push(`攻撃 ${game.attack}`);
  if (game.padding > 0) effects.push(`緩衝材 ×${game.padding}`);
  if (game.insurance > 0) effects.push(`予備伝票 ×${game.insurance}`);
  if (game.trapReduction > 0) effects.push(`安全靴 ${game.trapReduction}`);
  if (game.vision > 3) effects.push(`視界 ${game.vision}`);
  if (game.intuition) effects.push('出口経路');
  elements['effects-list'].textContent = effects.length ? effects.join(' ・ ') : '一時効果なし';

  const logItems = game.log.map((entry) => {
    const item = document.createElement('li');
    item.textContent = entry;
    return item;
  });
  elements['action-log'].replaceChildren(...logItems);
}

function renderGame() {
  if (!game) return;
  if (game.status === 'skill') {
    renderSkillChoice();
    return;
  }
  if (game.status === 'won' || game.status === 'lost') {
    renderResult();
    return;
  }
  renderMap();
  renderStatus();
}

function move(direction) {
  if (!game || game.status !== 'playing' || inputLocked || !moveVectors[direction]) return;
  const [dx, dy] = moveVectors[direction];
  const result = takeTurn(game, dx, dy);
  renderGame();
  if (result.acted) {
    inputLocked = true;
    window.setTimeout(() => { inputLocked = false; }, 95);
  }
}

function renderSkillChoice() {
  elements['cleared-floor'].textContent = `B${game.floor}`;
  const buttons = game.pendingSkills.map((skillId) => {
    const skill = SKILLS[skillId];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'skill-card';
    button.innerHTML = `<span class="skill-glyph">${skill.glyph}</span><strong>${skill.name}</strong><small>${skill.description}</small>`;
    button.addEventListener('click', () => {
      if (chooseSkill(game, skillId)) {
        showScreen(elements['game-screen']);
        renderGame();
      }
    }, { once: true });
    return button;
  });
  elements['skill-choices'].replaceChildren(...buttons);
  showScreen(elements['skill-screen']);
}

function renderResult() {
  const score = calculateScore(game);
  const previousBest = getBest();
  const isNewBest = score.total > previousBest;
  if (isNewBest) setBest(score.total);

  elements['result-kicker'].textContent = game.status === 'won' ? 'DELIVERY COMPLETE' : 'DELIVERY INTERRUPTED';
  elements['result-title'].textContent = game.status === 'won' ? '配達完了' : '配達中止';
  elements['result-reason'].textContent = game.resultReason;
  elements['total-score'].textContent = formatScore(score.total);
  if (isNewBest) elements['best-result'].textContent = previousBest ? `自己ベストを ${formatScore(score.total - previousBest)}点 更新` : 'この端末の初記録です';
  else elements['best-result'].textContent = `自己ベストまで ${formatScore(previousBest - score.total)}点`;
  elements['result-floor'].textContent = `B${game.floor}`;
  elements['result-package'].textContent = `${game.package} / ${game.maxPackage}`;
  elements['result-health'].textContent = `${game.health} / ${game.maxHealth}`;
  elements['result-turns'].textContent = `${game.turns}`;

  const breakdown = [
    ['到達階', score.progress],
    ['配達完了', score.delivery],
    ['荷物状態', score.packageBonus],
    ['残り体力', score.healthBonus],
    ['手際', score.turnBonus],
  ].map(([label, value]) => {
    const row = document.createElement('div');
    row.innerHTML = `<dt>${label}</dt><dd>+${formatScore(value)}</dd>`;
    return row;
  });
  elements['score-breakdown'].replaceChildren(...breakdown);
  showScreen(elements['result-screen']);
  updateBestDisplay();
}

elements['start-button'].addEventListener('click', startGame);
elements['retry-button'].addEventListener('click', startGame);
elements['back-button'].addEventListener('click', () => {
  game = null;
  updateBestDisplay();
  showScreen(elements['title-screen']);
});
elements['howto-button'].addEventListener('click', () => elements['howto-dialog'].showModal());
elements['howto-close'].addEventListener('click', () => elements['howto-dialog'].close());
elements['howto-start'].addEventListener('click', startGame);
elements['howto-dialog'].addEventListener('click', (event) => {
  if (event.target === elements['howto-dialog']) elements['howto-dialog'].close();
});

for (const button of document.querySelectorAll('[data-move]')) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    move(button.dataset.move);
  });
}

document.addEventListener('keydown', (event) => {
  if (event.repeat || elements['howto-dialog'].open) return;
  const direction = {
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', A: 'left',
  }[event.key];
  if (!direction) return;
  event.preventDefault();
  move(direction);
});

elements['game-map'].addEventListener('pointerdown', (event) => {
  touchStart = { x: event.clientX, y: event.clientY };
});
elements['game-map'].addEventListener('pointerup', (event) => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
  else move(dy > 0 ? 'down' : 'up');
});

updateBestDisplay();
loadDaily();
