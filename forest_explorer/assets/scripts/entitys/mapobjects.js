import * as Util from '../util.js'
import { DEPTH, MAP_OBJECT_TYPE, MOVE_SPEED } from '../constants.js';

// MapObject、マップ上に存在するものを扱うクラスです
// ものとはだいたい足場以外の全てを指します
export class MapObjectHolder {
  constructor(scene, stagedata) {
    this.scene = scene;
    this.stagedata = stagedata;
    this.mapObjects = []; // MapObjectを保持する配列
  }
  async initialize() {
    this.create('player', 0, 1, MAP_OBJECT_TYPE.PLAYER, DEPTH.PLAYER_0);
    await Promise.all(this.popEffectAll());
    this.scene.sound.play('step');
  }
  create(textureId, x, y, type, depth) {
    const position = Util.calcPosition(x, y);
    const mapImage = this.scene.add.image(position.x, position.y, textureId).setDepth(depth);
    mapImage.name = textureId;

    let scale = 1;
    const maxSize = 148;

    if (mapImage.width > maxSize || mapImage.height > maxSize) {
      scale = Math.min(maxSize / mapImage.width, maxSize / mapImage.height);
      mapImage.setScale(scale);
    }

      // プレイヤーは左右反転
    mapImage.scaleX = type === MAP_OBJECT_TYPE.PLAYER ? mapImage.scaleX * -1 : mapImage.scaleX;
    mapImage.y = mapImage.y - (mapImage.height * mapImage.scaleY) / 2;
    const mapObject = new MapObject(mapImage, type);
    mapObject.position = { x: x, y: y };
    this.mapObjects.push(mapObject);
  }
  clear() {
    this.mapObjects.forEach(mapObject => {
      mapObject.destroy();
    });
  }
  // プレイヤーと違う縦列に敵をランダムに生成
  randomPopEnemys() {
    let enemyAmount = Phaser.Math.Between(1, 3);

    for (let i = 0; i < 100; i++) {
      const x = Phaser.Math.Between(1, 5);
      const y = Phaser.Math.Between(0, 2);

      const isAlreadyExistedPosition = this.mapObjects.some(mapObject => mapObject.position.x === x && mapObject.position.y === y);
      if (isAlreadyExistedPosition) continue;
      this.create(this.getRandomEnemyID(), x, y, MAP_OBJECT_TYPE.ENEMY, DEPTH.ENEMY_0 + (y * 3));
      enemyAmount--;

      if (enemyAmount === 0 || this.mapObjects.length >= 3) {
        break;
      }
    }
  }
  getRandomEnemyID() {
    const randomIndex = Phaser.Math.Between(0, this.stagedata.enemyIDs.length - 1);
    return `enemy_${this.stagedata.enemyIDs[randomIndex]}`;
  }
  // プレイヤーと違う縦列に宝箱をランダム生成
  randomPopRewards() {
    let rewardAmount = Phaser.Math.Between(1, 3);

    // 指定回数、最大enemyAmount体の敵の生成を施行
    for (let i = 0; i < 100; i++) {
      const x = Phaser.Math.Between(1, 5);
      const y = Phaser.Math.Between(0, 2);

      const isAlreadyExistedPosition = this.mapObjects.some(mapObject => mapObject.position.x === x && mapObject.position.y === y);
      if (isAlreadyExistedPosition) continue;
      const rnd = Phaser.Math.Between(0, 2); // 約66%で通常の宝、約33%でデッキ編集アイコンになります
      const id = rnd > 0 ? 'treasure' : 'edit';
      const type = rnd > 0 ? MAP_OBJECT_TYPE.TREASURE : MAP_OBJECT_TYPE.DECK_EDIT;

      this.create(id, x, y, type, DEPTH.ENTITY_0 + (y * 3));
      rewardAmount--;

      // 指定数の敵を作り終えた || マップオブジェクトの数が多すぎる
      if (rewardAmount === 0 || this.mapObjects.length >= 6) {
        break;
      }
    }
  }
  popEffectAll(offset = 0) {
    const tweens = [];
    this.mapObjects.forEach((mapObject, index) => {
      if (index < offset) return;
      tweens.push(Util.waitForTween(this.scene, this.popEffect(mapObject.gameObject)));
    });
    return tweens;
  }
  popEffect(target) {
    target.alpha = 0;  // 透明
    target.y -= 20;  // 少し上に設定

    // フェードインと降下のアニメーションを設定
    return {
      targets: target,
      alpha: 1,
      y: '+=20',
      duration: MOVE_SPEED,
      ease: 'Power2'
    };
  }
  fadeoutOutsideMapObjects() {
    const targets = this.mapObjects.filter(mapObject => mapObject.position.x < 0)
    const tweens = [];

    targets.forEach(target => {
      const tween = this.fadeoutOutsideMapObject(target.gameObject);
      tweens.push(Util.waitForTween(this.scene, tween));
    })
    return tweens;
  }
  fadeoutOutsideMapObject(target) {
    target.alpha = 1;
    return {
      targets: target,
      alpha: 0,
      y: '+=20',
      duration: MOVE_SPEED * 2,
      ease: 'Power2'
    };
  }
  // 画面外に放り出された余剰オブジェクトを削除します
  removeOutsideMapObjects() {
    const targets = this.mapObjects.filter(mapObject => mapObject.position.x < 0)
    // 各対象オブジェクトに対して gameObject を削除
    targets.forEach(target => {
      target.gameObject.destroy();
    });
    // 元の mapObjects 配列からこれらのオブジェクトを削除
    this.mapObjects = this.mapObjects.filter(mapObject => mapObject.position.x >= 0);
  }
  remove(target) {
    target.gameObject.destroy();
    this.mapObjects = this.mapObjects.filter(element => element !== target);
  }
  getValidRightMoveDistance(index, distance) {
    const mapObject = this.mapObjects[index];

    // 右に移動中に他のオブジェクト（敵）があれば停止
    for (let i = 0; i < distance.x; i++) {
      const onloopPosition = { x: mapObject.position.x, y: mapObject.position.y }
      onloopPosition.x += i;

      const enemy = this.mapObjects.filter(
        eMapObject =>
          eMapObject.position.x == onloopPosition.x &&
          eMapObject.position.y == onloopPosition.y &&
          eMapObject.type === MAP_OBJECT_TYPE.ENEMY);

      if (enemy.length > 0) {
        distance.x = i;
        break;
      }
    }

    return distance;

  }
  // 指定したMapObject[index]をDistance分、一歩づつ移動させます
  // distanceは { x: y: }を持つオブジェクトです 
  // 現状は斜め移動に対応していません
  async stepMoveTo(index, distance) {
    const mapObject = this.mapObjects[index];
    const isMoveToX = distance.x !== 0;
    const moveAmount = isMoveToX ? Math.abs(distance.x) : Math.abs(distance.y)
    const moveIterator = (isMoveToX && distance.x < 0) || (!isMoveToX && distance.y < 0) ? -1 : 1; // 移動方向（対応するdistance）が正なら1、負なら-1をループごとにその方向に足します

    const calcedY = mapObject.position.y + distance.y;
    if (calcedY < 0 || calcedY > 2) { // 定数2は足場が3列である（現在の仕様）ことを前提としている
      return;
    }

    for (let i = 0; i < moveAmount; i++) {
      mapObject.position.x += isMoveToX ? moveIterator : 0;
      mapObject.position.y += isMoveToX ? 0 : moveIterator;

      const newPosition = Util.calcPosition(mapObject.position.x, mapObject.position.y);
      newPosition.y = newPosition.y - mapObject.gameObject.height / 2;

      this.setAppropriateDepth(mapObject);

      const tweenParameter = {
        targets: mapObject.gameObject,
        x: newPosition.x,
        y: newPosition.y,
        duration: MOVE_SPEED,
        ease: 'Quad.inOut'
      };

      this.scene.sound.play('step');
      await Util.waitForTween(this.scene, tweenParameter);
    }
  }
  moveTo(index, distance) {
    const mapObject = this.mapObjects[index];
    const calcedY = mapObject.position.y + distance.y;
    if (calcedY < 0 || calcedY > 2) {
      return;
    }

    mapObject.position.x += distance.x;
    mapObject.position.y += distance.y;

    const newPosition = Util.calcPosition(mapObject.position.x, mapObject.position.y);
    newPosition.y = newPosition.y - mapObject.gameObject.height / 2;

    this.setAppropriateDepth(mapObject);

    const tweenParameter = {
      targets: mapObject.gameObject,
      x: newPosition.x,
      y: newPosition.y,
      duration: MOVE_SPEED * (Math.abs(distance.x) + Math.abs(distance.y)),
      ease: 'Quad.inOut'
    };

    // isAsyncならこの場で待機し、次のループへ
    return Util.waitForTween(this.scene, tweenParameter);
  }
  async teleportMoveTo(index, distance) {
    const mapObject = this.mapObjects[index];
    const calcedY = mapObject.position.y + distance.y;
    if (calcedY < 0 || calcedY > 2) {
      return;
    }

    // テレポートのエフェクトを生成、キャラクターに重なるように表示
    const teleportEffect = this.scene.add.image(mapObject.gameObject.x, mapObject.gameObject.y, 'effect_teleport').setDepth(1000);
    const teleportParameter = {
      targets: teleportEffect,
      alpha: { from: 0.1, to: 1 },
      ease: 'Power', // 線形のイージング
      duration: MOVE_SPEED, // アニメーションの期間（ミリ秒）
    }

    this.scene.sound.play('warp');
    await Util.waitForTween(this.scene, teleportParameter);

    // 表示したら元のオブジェクトをこっそり移動させる
    mapObject.gameObject.setAlpha(0);
    mapObject.position.x += distance.x;
    mapObject.position.y += distance.y;

    const newPosition = Util.calcPosition(mapObject.position.x, mapObject.position.y);
    newPosition.y = newPosition.y - mapObject.gameObject.height / 2;

    mapObject.gameObject.x = newPosition.x;
    mapObject.gameObject.y = newPosition.y;
    this.setAppropriateDepth(mapObject);

    // 移動終了後、エフェクトを移動先に表示
    teleportEffect.setAlpha(0);
    teleportEffect.x = newPosition.x;
    teleportEffect.y = newPosition.y;

    await Util.waitForTween(this.scene, teleportParameter);

    mapObject.gameObject.setAlpha(1);
    teleportParameter.alpha = { from: 1, to: 0 }

    this.scene.sound.play('warp');
    await Util.waitForTween(this.scene, teleportParameter)
    teleportEffect.destroy();
  }
  setAppropriateDepth(mapObject) {
    const defaultDepth = this.getDefaultDepth(mapObject.type);
    mapObject.gameObject.setDepth(defaultDepth + (mapObject.position.y * 3));
  }
  getEnemyIndexes() {
    return this.mapObjects
      .map((obj, index) => ({ obj, index }))
      .filter(item => item.obj.type === MAP_OBJECT_TYPE.ENEMY)
      .map(item => item.index);
  }
  getDefaultDepth(type) {
    switch (type) {
      case MAP_OBJECT_TYPE.PLAYER:
        return DEPTH.PLAYER_0;
      case MAP_OBJECT_TYPE.ENEMY:
        return DEPTH.ENEMY_0;
      default:
        return DEPTH.ENTITY_0;
    }
  }
  // 全てのMapObjectをDistance数分左へ移動させます
  moveLeftAllMapObject(amount) {
    const movePromises = [];

    this.mapObjects.forEach(mapObject => {
      const tweenParameter = {
        targets: mapObject.gameObject,
        alpha: 1,
        x: '-=' + 116 * amount,
        duration: MOVE_SPEED * amount,
        ease: 'Power2'
      }

      mapObject.position.x -= amount;
      movePromises.push(Util.waitForTween(this.scene, tweenParameter))
    });

    return movePromises;
  }
  getOverlapMapObjects() {
    const positionMap = new Map();
    const overlaps = [];

    for (let mapObject of this.mapObjects) {
      const positionKey = `x:${mapObject.position.x},y:${mapObject.position.y}`;

      if (positionMap.has(positionKey)) {
        positionMap.get(positionKey).push(mapObject);
      } else {
        positionMap.set(positionKey, [mapObject]);
      }
    }

    for (let [positionKey, objects] of positionMap) {
      if (objects.length > 1) {
        overlaps.push({ positionKey, objects });
      }
    }

    if (overlaps.length === 0) return null;
    return overlaps;
  }
  getOverlapsAtPosition(overlaps, x, y) {
    const positionKey = `x:${x},y:${y}`;

    const overlapAtPosition = overlaps.find(overlap => overlap.positionKey === positionKey);
    return overlapAtPosition ? overlapAtPosition.objects : [];
  }
}
// マップ上のオブジェクトの基底となるクラス
export class MapObject {
  constructor(gameObject, type) {
    this.gameObject = gameObject;
    this.type = type;
    this.position = { x: -1, y: -1 }
  }
  destroy() {
    this.gameObject.destroy();
  }
}