import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateScore,
  chooseSkill,
  createGame,
  createZone,
  findPath,
  generateMaze,
  takeTurn,
} from '../src/public/game/logic.js';

test('the same seed creates the same zone and contents', () => {
  assert.deepEqual(createZone(123456, 6), createZone(123456, 6));
  assert.notDeepEqual(createZone(123456, 6), createZone(123457, 6));
});

test('generated maps always connect the start to the exit', () => {
  for (let seed = 0; seed < 250; seed += 1) {
    const map = generateMaze(seed);
    const path = findPath(map.tiles, map.start, map.exit);
    assert.ok(path.length > 1, `seed ${seed} should have a usable path`);
    assert.deepEqual(path[0], map.start);
    assert.deepEqual(path.at(-1), map.exit);
  }
});

test('walking, hitting walls, and attacking use turns correctly', () => {
  const game = createGame(42);
  const path = findPath(game.zone.tiles, game.player, game.zone.exit);
  const next = path[1];
  const result = takeTurn(game, next.x - game.player.x, next.y - game.player.y);
  assert.equal(result.acted, true);
  assert.equal(game.turns, 1);
  assert.deepEqual(game.player, next);

  game.player = { x: 1, y: 1 };
  game.zone.tiles[0][1] = '#';
  const wallResult = takeTurn(game, 0, -1);
  assert.equal(wallResult.event, 'wall');
  assert.equal(game.turns, 1);

  game.zone.tiles[1][2] = '.';
  game.zone.enemies = [{ id: 'test-e0', type: 'cleaner', x: 2, y: 1, health: 3 }];
  game.zone.items = [];
  game.zone.traps = [];
  const attackResult = takeTurn(game, 1, 0);
  assert.equal(attackResult.event, 'attack');
  assert.equal(game.zone.enemies[0].health, 1);
  assert.equal(game.turns, 2);
});

test('items restore condition and traps can end a delivery', () => {
  const game = createGame(9);
  game.player = { x: 1, y: 1 };
  game.zone.tiles[1][2] = '.';
  game.zone.exit = { x: 13, y: 9 };
  game.zone.enemies = [];
  game.zone.items = [{ id: 'tape', type: 'tape', x: 2, y: 1 }];
  game.zone.traps = [];
  game.package = 5;
  takeTurn(game, 1, 0);
  assert.equal(game.package, 9);

  game.zone.tiles[1][3] = '.';
  game.zone.traps = [{ id: 'trap', active: true, x: 3, y: 1 }];
  game.package = 2;
  const result = takeTurn(game, 1, 0);
  assert.equal(result.event, 'lost');
  assert.equal(game.package, 0);
  assert.equal(game.status, 'lost');
  assert.match(game.resultReason, /荷物/);
});

test('health reaching zero ends the delivery', () => {
  const game = createGame(81);
  game.player = { x: 1, y: 1 };
  game.zone.tiles[1][2] = '.';
  game.zone.tiles[2][1] = '.';
  game.zone.exit = { x: 13, y: 9 };
  game.zone.enemies = [{ id: 'test-e0', type: 'drone', x: 2, y: 1, health: 4 }];
  game.zone.items = [];
  game.zone.traps = [];
  game.health = 2;
  takeTurn(game, 1, 0);
  assert.equal(game.health, 0);
  assert.equal(game.status, 'lost');
  assert.match(game.resultReason, /体力/);
});

test('skill selection advances one floor segment and applies its effect', () => {
  const game = createGame(777);
  const path = findPath(game.zone.tiles, game.player, game.zone.exit);
  game.player = { ...path.at(-2) };
  const finalStep = path.at(-1);
  takeTurn(game, finalStep.x - game.player.x, finalStep.y - game.player.y);
  assert.equal(game.status, 'skill');
  assert.equal(game.pendingSkills.length, 3);

  const selected = game.pendingSkills[0];
  assert.equal(chooseSkill(game, selected), true);
  assert.equal(game.status, 'playing');
  assert.equal(game.floor, 20);
  assert.equal(game.zoneIndex, 1);
  assert.ok(game.skills.includes(selected));
});

test('the tenth exit completes delivery to B100', () => {
  const game = createGame(100);
  for (let zoneIndex = 0; zoneIndex < 10; zoneIndex += 1) {
    const path = findPath(game.zone.tiles, game.player, game.zone.exit);
    game.player = { ...path.at(-2) };
    const exit = path.at(-1);
    const outcome = takeTurn(game, exit.x - game.player.x, exit.y - game.player.y);
    if (zoneIndex < 9) {
      assert.equal(outcome.event, 'skill');
      assert.equal(chooseSkill(game, game.pendingSkills[0]), true);
    } else {
      assert.equal(outcome.event, 'won');
    }
  }
  assert.equal(game.status, 'won');
  assert.equal(game.floor, 100);
  assert.match(game.resultReason, /届けた/);
});

test('score rewards successful delivery and preserved package condition', () => {
  const failed = createGame(1);
  failed.status = 'lost';
  failed.floor = 50;
  failed.health = 0;
  failed.package = 4;
  failed.turns = 200;

  const won = createGame(1);
  won.status = 'won';
  won.floor = 100;
  won.health = 8;
  won.package = 10;
  won.turns = 300;

  const failedScore = calculateScore(failed);
  const wonScore = calculateScore(won);
  assert.equal(failedScore.delivery, 0);
  assert.equal(wonScore.delivery, 5000);
  assert.ok(wonScore.total > failedScore.total);

  won.package = 11;
  assert.equal(calculateScore(won).total - wonScore.total, 120);
});
