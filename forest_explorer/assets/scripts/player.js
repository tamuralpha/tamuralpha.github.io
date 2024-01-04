import { Deck } from "./cards/deck.js";

export class PlayerData {
  // ロードとか？ 初期値をセット
  constructor(scene) {
    this.heartPoint = 8;
    this.scene = scene;
    this.setDefaultCards();
  }
  // 現状、初期デッキの内容を手動で所持カードに追加している。同期に注意
  setDefaultCards() {
    this.init_deck = [
      0, 0, 0, 0, 1,
      1, 1, 1, 1, 2,
      2, 2, 2, 2, 3,
      3, 3, 3, 3, 10]
    this.deck = new Deck(this.scene);
    this.deck.addFromIdArray(this.init_deck);
    this.cardInventory = new Map();
    this.cardInventory.set(0, 4);
    this.cardInventory.set(1, 5);
    this.cardInventory.set(2, 5);
    this.cardInventory.set(3, 5);
    this.cardInventory.set(4, 1); // （火）中級魔法を各１枚づつ追加 / 早期にデッキ編集マスに入る意義
    this.cardInventory.set(5, 1); // （氷）
    this.cardInventory.set(6, 1); // （雷）
    this.cardInventory.set(10, 1);
  }
  // カードデータからidを取得し、cardInventoryの対象を一つ増やす
  addCard(carddata) {
    const id = carddata.id;
    const currentCount = this.cardInventory.get(id) || 0; // カードが存在しない場合は0とする（つまりバグが起こると分析魔法が増える）
    this.cardInventory.set(id, currentCount + 1);
  }
  moveCount(movedDistance) {
    this.toGoalLength -= movedDistance.x;
    this.toGoalLength = Math.max(this.toGoalLength, 0)
  }
  // カードによる効果を受ける（戦闘中）
  effect(effects) {
    switch(effects.effect) {
      case 'heal':
        this.heartPoint += effects.value;
        break;
    }
  }
  // 気絶（要は死亡）状態の判定
  // 現状は
  // ①デッキ枚数が0
  // ②体力が0以下
  // でゲームオーバー
  isFainted() {
    const isDeckLost = this.deck.getNotUsedLength() === 0;
    const isHeartLost = this.heartPoint <= 0;
    return isDeckLost || isHeartLost;
  }
  copy() {
    const copiedPlayerdata = new PlayerData(this.scene);
    copiedPlayerdata.deck = this.deck.copy();
    copiedPlayerdata.cardInventory = new Map(this.cardInventory);
    copiedPlayerdata.heartPoint = this.heartPoint;
    return copiedPlayerdata;
  }
}