import { DEPTH, MAP_OBJECT_TYPE, MOVE_SPEED } from '../constants.js';
import { MapObjectHolder } from './mapobjects.js';
import { ScaffoldHolder } from './scaffolds.js';

// MapObject（マップ上のモノ）
// Scaffold（マップ上の足場）
// ...の両者を管理するクラス。メインからここに指示を飛ばし、その指示を受けたここがそれぞれのHolderに指示を投げる
// 注意点として、両者オブジェクトのインスタンスとGameObjectは異なるもの
// オブジェクトの中にGameObjectのプロパティがあります
// それを忘れてTweenにインスタンスを渡したりすると動作しない（通知も出ない）
// forループなどでまとめて処理する際に忘れがちなので気をつけて
export class MapHolder {
  constructor(scene, texture, playerdata, stagedata) {
    this.playerdata = playerdata;
    this.stagedata = stagedata;
    this.mapObjectHolder = new MapObjectHolder(scene, stagedata);
    this.scaffoldHolder = new ScaffoldHolder(scene, texture, stagedata.toGoalLength);
    this.scene = scene;
  }
  async initialize() {
    await this.initializeScaffold();
    await this.initializeMapObject();
    const before_create = this.mapObjectHolder.mapObjects.length;
    this.mapObjectHolder.randomPopEnemys();
    this.mapObjectHolder.randomPopRewards();
    await Promise.all(this.mapObjectHolder.popEffectAll(before_create));
  }
  clear() {
    this.mapObjectHolder.clear();
    this.scaffoldHolder.clear();
  }
  // プレイヤーの位置に合わせ、いろいろなものを移動します
  // その辺りもここで処理されます。新しい足場を生成 / ランダムなオブジェクトを出現 / メソッド名変えた方がいいかも
  async organizeAllMapByPlayerPosition(amount = 1) {
    // ゴールが見えている場合、ゴールマスが右端になるようにズラします
    const isInGoalLength = this.stagedata.toGoalLength < 6;
    if (isInGoalLength) {
      const playerMapObject = this.mapObjectHolder.mapObjects.find(mapObject => mapObject.type === MAP_OBJECT_TYPE.PLAYER);
      amount = playerMapObject.position.x + this.stagedata.toGoalLength - 5; // プレイヤーの位置＋ゴール地点までのマス数＝ゴールの位置がどこか
    }

    // 新しい足場に合わせて既存のものを移動
    const createScaffold = this.scaffoldHolder.adjustExistedScaffoldBeforeCreate(amount);
    const mapObjectsMove = this.mapObjectHolder.moveLeftAllMapObject(amount);
    const tweens = [createScaffold, mapObjectsMove];

    // 足場を生成、演出
    this.scaffoldHolder.create(amount);

    tweens.push(this.scaffoldHolder.dropAndPop(amount));
    tweens.push(this.cleanupMapObjects(amount));
    await Promise.all(tweens);
  }
  // プレイヤーの移動後処理
  // 移動範囲外の足場＆オブジェクトの破棄
  async cleanupMapObjects() {
    const fadeoutAll = this.mapObjectHolder.fadeoutOutsideMapObjects();
    await Promise.all(fadeoutAll);
    this.mapObjectHolder.removeOutsideMapObjects();
  }
  // 敵やアイテムのオブジェクトを生産します
  async repopObjects() {
    const before_create = this.mapObjectHolder.mapObjects.length;
    this.mapObjectHolder.randomPopEnemys();
    this.mapObjectHolder.randomPopRewards();
    await Promise.all(this.mapObjectHolder.popEffectAll(before_create));
  }
  async initializeScaffold() {
    this.scaffoldHolder.initialize(this.stagedata.toGoalLength);
    await this.scaffoldHolder.dropAndPop(6);
  }
  async initializeMapObject() {
    await this.mapObjectHolder.initialize();
  }
  // 現状はプレイヤーのみを指定しているため暗黙的にIndex = 0
  async moveTo(distance, isTeleport) {
    distance = isTeleport ? distance : this.mapObjectHolder.getValidRightMoveDistance(0, distance); // テレポート移動の場合、距離をそのまま代入
    distance = this.stagedata.toGoalLength - distance.x < 0 ? { x: this.stagedata.toGoalLength, y: distance.y } : distance; // ゴールを超過する場合、ゴールピッタリになるよう調整

    if (isTeleport) 
      await this.mapObjectHolder.teleportMoveTo(0, distance);
    else
      await this.mapObjectHolder.stepMoveTo(0, distance);
    return distance;
  }
  // 全ての敵が移動、現在は正面のみだが判定もありか。
  async moveAllEnemys() {
    const enemyIndexes = this.mapObjectHolder.getEnemyIndexes();
    const promises = [];

    enemyIndexes.forEach(async index => {
      promises.push(this.mapObjectHolder.moveTo(index, { x: -1, y: 0 }));
    });

    await Promise.all(promises);
  }
  getOverlapPair() {
    const overlapedMapObjects = this.mapObjectHolder.getOverlapMapObjects();
    if (!overlapedMapObjects) return null;

    // 重なり合っているオブジェクトから、有効なイベントの発生する組み合わせをチェック
    // 有効なイベントとは、例えば『プレイヤーと敵』のようなもの。『敵と敵』『敵とアイテム』では無意味。
    // もし『複数の有効なイベントが重なり合っている』場合、例えば『プレイヤーと敵と敵』がいる場合。
    // その時は『プレイヤーと敵』を解決し、その後またこのイベントが呼び出されることになる。
    for (let overlap of overlapedMapObjects) {
      const objects = overlap.objects;

      const playerObject = objects.find(obj => obj.type === MAP_OBJECT_TYPE.PLAYER);
      const enemyObject = objects.find(obj => obj.type === MAP_OBJECT_TYPE.ENEMY);

      if (playerObject && enemyObject)
        return [playerObject, enemyObject];

      const treasureObject = objects.find(obj => obj.type === MAP_OBJECT_TYPE.TREASURE);
      if (playerObject && treasureObject)
        return [playerObject, treasureObject];

      const deckeditObject = objects.find(obj => obj.type === MAP_OBJECT_TYPE.DECK_EDIT);

      if (playerObject && deckeditObject)
        return [playerObject, deckeditObject];
    }
    return null;
  }
  checkOverlapMapObject() {
    return this.mapObjectHolder.getOverlapMapObjects();
  }
  removeMapObject(obj) {
    this.mapObjectHolder.remove(obj);
  }
}