import { EFFECT_ELEMENT } from "../constants.js";
import * as Util from '../util.js'

// デッキのカードは『カードのデータ』のみです
// ここから各クラスでデータを元に色々生み出したりします
// デッキ内のカードは以下の状態を持ちます
// ①ドロー済みか否か
// 戦闘中に既にドローしたことを意味します
// その戦闘中ではデッキからドロ―されません
// ②使用済みか否か
// 戦闘中に使用し、使用不可になった状態です
// デッキ内にカードはありますが、使用不可でドローもされません
export class Deck {
  constructor() {
    this.cards = [];
    this.statuses = []; // cardsと統合したクラスを作るべき？
  }
  // ドロー済みでないカードからランダムに一枚引く
  draw() {
    const notDrawedIndexes = this.getNotDrawedAndNotUsedIndexs();

    if (notDrawedIndexes.length === 0)
      return -1;

    // ドローされていないカードからランダムな一枚を取得、それにカード記載の数値を元にランダムなパラメータを設定
    const random = Phaser.Math.Between(0, notDrawedIndexes.length - 1);
    const randomIndex = notDrawedIndexes[random];
    this.calcRandomValueWithBonus(this.cards[randomIndex]);

    this.statuses[randomIndex].drawed = true;
    return randomIndex;
  }
  // カードをUsed状態にします
  // [注]正確なindexでなく、カードidから『同じカードidでドロー済み』のカードがUsedになります
  use(card) {
    let usedIndex = 0;

    this.cards.forEach((deckcard, index) => {
      const deckstatus = this.statuses[index];
      if (deckcard.id === card.id && deckstatus.drawed && !deckstatus.used) {
        usedIndex = index;
      }
    });

    this.statuses[usedIndex].used = true;
  }
  // RandomValue計算用の補正を計算します
  calcRandomValueWithBonus(card) {
    if (card.effects.rnd_value !== undefined && card.effects.rnd_value) {
      const cardsElement = card.effects.effect_element;
      const count = this.getCountSameElement(cardsElement);
      const splited = card.effects.rnd_value.split('-');

      card.effects.value = Util.biasedRandomInt(parseInt(splited[0]), parseInt(splited[1]), count);
    }
  }
  add(card) {
    this.cards.push(card);
    this.statuses.push({ drawed: false, used: false });
  }
  // デッキ内のカードをid順（昇順）ソート
  sort() {
    let combined = this.cards.map((card, index) => {
      return { card: card, status: this.statuses[index] };
    });

    combined.sort((a, b) => a.card.id - b.card.id);

    this.cards = combined.map(element => element.card);
    this.statuses = combined.map(element => element.status);
  }
  copy() {
    const copiedCards = JSON.parse(JSON.stringify(this.cards));
    const copiedStatuses = JSON.parse(JSON.stringify(this.statuses));

    const copiedDeck = new Deck();
    copiedDeck.cards = copiedCards;
    copiedDeck.statuses = copiedStatuses;

    return copiedDeck;
  }
  // 使用済み（used）状態のカードを一枚使用可能に戻します
  randomRecover() {
    const usedIndexes = this.getUsedIndexs();
    if (usedIndexes.length === 0) return;

    const random = Phaser.Math.Between(0, usedIndexes.length - 1);
    const randomIndex = usedIndexes[random];

    this.statuses[randomIndex].used = false;
  }
  // カードのステータスに基づいてインデックスをフィルタリングする汎用関数
  filterCardIndexesFromStatus(filterFunc) {
    const filteredIndexes = [];

    for (let index = 0; index < this.cards.length; index++) {
      if (filterFunc(this.statuses[index])) {
        filteredIndexes.push(index);
      }
    }

    return filteredIndexes;
  }
  // 指定カードデータのカードがデッキ内に何枚入っているかを返します
  // -> 指定したキーのカードが
  getCountInDeck(key) {
    return this.cards.reduce((acc, card) => `${card.id}-${card.effects.rnd_value}` === key ? acc + 1 : acc, 0);
  }
  // 指定したelementと同一のelementの枚数を得ます
  getCountSameElement(element) {
    return this.cards.filter(card => card.effects.effect_element === element).length;
  }
  getCountUsedSameElement(element) {
    const usedIndexes = this.getUsedIndexs();
    let count = 0;

    for (let index = 0; index < usedIndexes.length; index++) {
      const isSameElement = this.cards[usedIndexes[index]].effects.effect_element === element;
      count = isSameElement ? count + 1 : count;
    }
    return count;
  }
  // ドローされておらず、使用されていないカードのインデックス配列を返す
  getNotDrawedAndNotUsedIndexs() {
    return this.filterCardIndexesFromStatus(status => !status.drawed && !status.used);
  }
  // 使用されていないカードのインデックス配列を返す
  getNotUsedIndexs() {
    return this.filterCardIndexesFromStatus(status => !status.used);
  }
  getUsedIndexs() {
    return this.filterCardIndexesFromStatus(status => status.used);
  }
  // ドローされておらず、使用されていないカードの数を返す
  getNotDrawedAndNotUsedLength() {
    return this.getNotDrawedAndNotUsedIndexs().length;
  }
  // 使用されていないカードの数を返す
  getNotUsedLength() {
    return this.getNotUsedIndexs().length;
  }
  resetAllDraw() {
    this.statuses = this.statuses.map(status => { status.drawed = false; return status; });
  }
  getCardFromIndex(index) {
    return this.cards[index];
  }
  remove(card) {
    const index = this.cards.indexOf(card);
    this.cards.splice(index, 1);
    this.statuses.splice(index, 1);
  }
  getLength() {
    return this.cards.length;
  }
  // Elementに違う意味があるので理解しづらい？
  getElementLengths() {
    const flameCount = this.cards.filter(card => card.effects.effect_element === EFFECT_ELEMENT.FIRE).length;
    const iceCount = this.cards.filter(card => card.effects.effect_element === EFFECT_ELEMENT.ICE).length;
    const windCount = this.cards.filter(card => card.effects.effect_element === EFFECT_ELEMENT.WIND).length;
    const otherCount = this.cards.length - (flameCount + iceCount + windCount);

    return { flameCount: flameCount, iceCount: iceCount, windCount: windCount, otherCount: otherCount }
  }
  getElementLengthsNotUsed() {
    const notUsedIndexes = this.getNotUsedIndexs();
    let flameCount = 0;
    let iceCount = 0;
    let windCount = 0;

    for (let index = 0; index < notUsedIndexes.length; index++) {
      const card = this.cards[notUsedIndexes[index]];

      flameCount = card.effects.effect_element === EFFECT_ELEMENT.FIRE ? flameCount + 1 : flameCount;
      iceCount = card.effects.effect_element === EFFECT_ELEMENT.ICE ? iceCount + 1 : iceCount;
      windCount = card.effects.effect_element === EFFECT_ELEMENT.WIND ? windCount + 1 : windCount;
    }

    const otherCount = notUsedIndexes.length - (flameCount + iceCount + windCount);

    return { flameCount: flameCount, iceCount: iceCount, windCount: windCount, otherCount: otherCount }
  }
  // ドローされておらず、使用済みでもないカードの属性を数える
  // 主に戦闘中に使用、デッキ内の使用可能なカードの数から戦略を立てる場合に有効
  getElementLengthsNotDrawedAndNotUsed() {
    const notDrawedAndNotUsedIndexes = this.getNotDrawedAndNotUsedIndexs();
    let flameCount = 0;
    let iceCount = 0;
    let windCount = 0;

    for (let index = 0; index < notDrawedAndNotUsedIndexes.length; index++) {
      const card = this.cards[notDrawedAndNotUsedIndexes[index]];

      flameCount = card.effects.effect_element === EFFECT_ELEMENT.FIRE ? flameCount + 1 : flameCount;
      iceCount = card.effects.effect_element === EFFECT_ELEMENT.ICE ? iceCount + 1 : iceCount;
      windCount = card.effects.effect_element === EFFECT_ELEMENT.WIND ? windCount + 1 : windCount;
    }

    const otherCount = notDrawedAndNotUsedIndexes.length - (flameCount + iceCount + windCount);

    return { flameCount: flameCount, iceCount: iceCount, windCount: windCount, otherCount: otherCount }
  }
}