import { Condition } from "./condition.js";
import { CONDITION, EFFECT_ELEMENT } from "./constants.js";
export class EnemyDatabase {
  constructor(scene) {
    this.enemydatas = scene.cache.json.get('enemy_data');
  }
  // isEndressModeの場合、indexが必要になる（通常では不要）、上手く書けない
  get(id, index = -1) {
    const original = this.enemydatas[id];
    return new EnemyData({
      id: original.id,
      type: original.type,
      heartPoint: original.heart_point,
      attackPoint: original.attack_point,
      option: original.option
    });
  }
}
// エンドレスモード用、ステータスの自動算出機能が入ってます
export class EndressEnemyDatabase extends EnemyDatabase {
  constructor(scene) {
    super(scene);
    this.cache = {};
  }
  get(id, index) {
    if (!this.cache[id]) {
      // キャッシュにない場合、新しく生成して保存
      this.cache[id] = this.create(id, index);
    }
    return this.cache[id];
  }
  create(id, index) {
    const type = id.split('_')[0];
    const isIDHasElement = Object.values(EFFECT_ELEMENT).includes(type);

    return new EnemyData({
      id: id,
      type: isIDHasElement ? type : this.getRandomElement(),
      heartPoint: this.createHeartPoint(index),
      attackPoint: this.createAttackPoint(index),
      option: {}
    });
  }
  getRandomElement() {
    const elementList = Object.values(EFFECT_ELEMENT);
    return this.getRandomFromArray(elementList);
  }
  getRandomFromArray(target) {
    const rnd = Phaser.Math.Between(0, target.length - 1);
    return target[rnd];
  }
  // 初期値は10、非有利の下位攻撃魔法の一撃では落ちない数値
  createHeartPoint(index) {
    return 6 + index * 4 + Math.ceil(index / 5);
  }
  // 初期値は2、
  createAttackPoint(index) {
    return index + Math.ceil(index / 5);
  }
}
export class EnemyData {
  constructor(data) {
    this.id = data.id;
    this.type = data.type;
    this.heartPoint = data.heartPoint;
    this.attackPoint = data.attackPoint;
    this.condition = new Condition();
    this.option = data.option;
  }
  damage(type, value) {
    const isWeak = this.checkIsWeak(type);
    value = isWeak ? value * 2 : value;

    this.heartPoint -= value;
    return value;
  }
  // 現状エンドレスモード用、ステージ数に応じてパワーアップさせます
  enhance(stageCount) {
    this.heartPoint = Math.ceil(this.heartPoint * 1.5);
    this.attackPoint = Math.ceil(this.attackPoint * 1.5) + Math.ceil(stageCount / 5);
  }
  effect(effects) {
    switch (effects.effect) {
      case 'analyze':
        this.condition.add(CONDITION.ANALYZED, 2);
        return true;
      case 'sleep':
        // 睡眠成功判定
        const isSleepSuccessed = Phaser.Math.Between(0, 100) < 50;
        if (!isSleepSuccessed) return false;

        const sleepTurn = Phaser.Math.Between(2, 3);
        this.condition.add(CONDITION.SLEEPED, sleepTurn);
        return true;
      case 'curse':
        this.condition.add(CONDITION.CURSED, 99);
        return true;
    }
  }
  getWeak() {
    switch (this.type) {
      case EFFECT_ELEMENT.FIRE:
        return EFFECT_ELEMENT.ICE
      case EFFECT_ELEMENT.ICE:
        return EFFECT_ELEMENT.WIND
      case EFFECT_ELEMENT.WIND:
        return EFFECT_ELEMENT.FIRE
      default:
        return EFFECT_ELEMENT.FIRE;
    }
  }
  checkIsWeak(type) {
    const isWeak =
      (type === EFFECT_ELEMENT.FIRE && this.type === EFFECT_ELEMENT.WIND) ||
      (type === EFFECT_ELEMENT.ICE && this.type === EFFECT_ELEMENT.FIRE) ||
      (type === EFFECT_ELEMENT.WIND && this.type === EFFECT_ELEMENT.ICE) ||
      this.condition.checkHasActiveCondition(CONDITION.ANALYZED);
    return isWeak;
  }
  checkIsActable() {
    const isSleeping = this.condition.checkHasActiveCondition(CONDITION.SLEEPED);
    if (isSleeping) return
    const isCursed = this.condition.checkHasActiveCondition(CONDITION.CURSED) && (30 > Phaser.Math.Between(0, 100)); // 約３０％で行動不可
    if (isCursed) return false;
    return true;
  }
}