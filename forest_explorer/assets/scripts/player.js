import { Deck } from "./cards/deck.js";
import { CONDITION } from "./constants.js";
import { Condition } from './condition.js'

export class PlayerData {
  // ロードとか？ 初期値をセット
  constructor() {
    this.heartPoint = 8;
    this.maxHeartPoint = 8;
    this.condition = new Condition();
    this.deck = new Deck();
    this.cardInventory = new Map();
  }
  addCard(carddata) {
    const key = `${carddata.id}-${carddata.effects.rnd_value}`; // IDとランダム値を組み合わせたキー

    if (this.cardInventory.has(key)) {
      this.cardInventory.get(key).count += 1; // 既存のカードの枚数を増やす
    } else {
      this.cardInventory.set(key, { data: carddata, count: 1 }); // 新しいカードを追加
    }
  }
  moveCount(movedDistance) {
    this.toGoalLength -= movedDistance.x;
    this.toGoalLength = Math.max(this.toGoalLength, 0)
  }
  // HP回復、つまり上限がある
  healHP(value) {
    this.heartPoint = Math.min(this.maxHeartPoint, this.heartPoint + value);
  }
  // HP増加、要は上限がない
  upHP(value) {
    this.heartPoint += value;
    this.maxHeartPoint += value;
  }
  // カードによる効果を受ける（戦闘中）
  // 移転を検討すること
  effect(effects) {
    switch(effects.effect) {
      case 'heal':
        this.healHP(effects.value);
        break;
      case 'charge':
        this.condition.add(CONDITION.CHARGED, effects.value);
        break;
    }
  }
  // 気絶（要は死亡）状態の判定
  // 現状は
  // ①デッキ枚数が0
  // ②体力が0以下
  // いずれかでゲームオーバー
  isFainted() {
    const isDeckLost = this.deck.getNotUsedLength() === 0;
    const isHeartLost = this.heartPoint <= 0;
    return isDeckLost || isHeartLost;
  }
  copy() {
    const copiedPlayerdata = new PlayerData();
    copiedPlayerdata.deck = this.deck.copy();
    copiedPlayerdata.cardInventory = new Map(this.cardInventory);
    copiedPlayerdata.heartPoint = this.heartPoint;
    return copiedPlayerdata;
  }
  useChargedPower() {
    if (!this.condition.checkHasActiveCondition(CONDITION.CHARGED)) return 0;

    const chargedPower = this.condition.get(CONDITION.CHARGED);
    this.condition.delete(CONDITION.CHARGED);
    return chargedPower;
  }
}