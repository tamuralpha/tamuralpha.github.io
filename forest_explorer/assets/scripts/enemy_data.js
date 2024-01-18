import { Condition } from "./condition.js";
import { CONDITION, EFFECT_ELEMENT } from "./constants.js";
export class EnemyDatabase {
  constructor(scene) {
    this.enemydatas = scene.cache.json.get('enemy_data');
  }
  get(id) {
    const original = this.enemydatas[id];
    return new EnemyData(original.id, original.type, original.heart_point, original.attack_point, original.option);
  }
}
export class EnemyData {
  constructor(id, type, heartPoint, attackPoint, option) {
    this.id = id;
    this.type = type;
    this.heartPoint = heartPoint;
    this.attackPoint = attackPoint;
    this.condition = new Condition();
    this.option = option;
  }
  damage(type, value) {
    const isWeak = this.checkIsWeak(type);
    value = isWeak ? value * 2 : value;

    this.heartPoint -= value;
    return value;
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