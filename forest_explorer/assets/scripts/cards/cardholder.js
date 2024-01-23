import { CardObject } from './card.js';
import { CardDatabase, EndressCardDatabase } from './carddatabase.js';
import { ImageLayer } from './imagelayer.js';
import * as Util from '../util.js'

export class CardHolder {
  constructor(scene, deck = null, stagedata = null) {
    this.scene = scene;
    this.cardDatabase = this.scene.game.isEndressMode ? new EndressCardDatabase(this.scene, stagedata.index) : new CardDatabase(this.scene);
    this.deck = deck;
    this.cards = [];
    this.stagedata = stagedata;
    this.isBattleScene = this.deck !== null; // マップ画面と戦闘画面の両方で使うが処理が異なるため識別が必要、デッキの有無で判定
  }
  add(card) {
    this.cards.push(card);
  }
  remove(card) {
    const index = this.cards.indexOf(card);
    this.cards.splice(index, 1);
    card.imageLayer.destroyMyself();
  }
  clear() {
    this.cards.forEach(card => {
      card.imageLayer.destroyMyself();
    })
    this.cards = [];
  }
  create(repeat) {
    for (let index = this.cards.length; index < repeat; index++) {
      const position = Util.calcHandCardPositon(index);
      const carddata = this.getRandomCarddataFromStore();
      if (!carddata) { return false; }
      const card = Util.craeteCard(this.scene, position, index, carddata, 0.5, false, this.isBattleScene);

      this.scene.input.setDraggable(card.getFrame());
      this.add(card);
    }

    return true; // 成功
  }
  // 一定の出現アルゴリズムを元にランダムなカードIDを返します
  // デッキが存在していればその中から
  getRandomCarddataFromStore() {
    if (this.isBattleScene)
      return this.getRandomCarddataOnBattle();
    else {
      const id = this.getRandomCardIDOnMap();
      return this.cardDatabase.get(id);
    }
  }
  getRandomCarddataOnBattle() {
    const drawedIndex = this.deck.draw()
    if (drawedIndex === -1) { return false }

    const drawedCard = this.deck.cards[drawedIndex];
    return drawedCard;
  }
  // マップ上で使うカードをランダムに生成します
  // 基本的には乱数で決定しますが、それぞれの除外条件を満たしていればリターンせず再決定させます
  getRandomCardIDOnMap() {
    // 『右に移動』効果を含むカードが無ければ移動カードの生成を優先
    if (!this.cards.some(card => card.isRightMove())) {
      return 0;
    }

    // 単純なランダム、１００回失敗した場合は０
    for (let index = 0; index < 100; index++) {
      const random = Phaser.Math.Between(0, 100);

      if (random < 41) {
        return 0;
      }
      // 上に移動（同じカードが無ければ）
      else if (random <= 53 && !this.cards.some(card => card.id === 1)) {
        return 1;
      }
      // 下に移動（同じカードが無ければ）
      else if (random <= 65 && !this.cards.some(card => card.id === 2)) {
        return 2;
      }
      // テレポート
      else if (random <= 75) {
        return 3;
      }
      // 休息（同じカードが無ければ＆同ステージの休息カード出現回数が残っている）
      else if (random <= 100 && !this.cards.some(card => card.id === 4) && this.stagedata.remainingRestCards > 0) {
        this.stagedata.restCardCount(1);
        return 4;
      }
    }

    return 0;

  }
  // 主にフレーム部分のGameObjectから元のカードを得ます
  // （ImageLayerでカードを描画する都合上、その最前面であるフレーム部分がクリックを受付し……
  // 　取得出来るのもフレーム部分のGameObjectです。そこから元のカードを検索し、元のカードとインデックスを返します
  selectCardFromGameObject(gameObject) {
    let returnindex = -1;

    if (!gameObject) return null;
    if (Array.isArray(gameObject)) { gameObject = gameObject[0] }

    for (let index = 0; index < this.cards.length; index++) {
      if (this.cards[index].imageLayer.items.includes(gameObject)) {
        returnindex = index;
        break;
      }
    }

    if (returnindex === -1) return null;
    return this.cards[returnindex];
  }
  pickUpEffectToHandCard(card) {
    const selectedFrame = card.imageLayer.getFrame();
    const tweenParameter = {
      x: selectedFrame.x,
      y: selectedFrame.y - 25,
      duration: 50,
    }

    return card.imageLayer.applyTween(this.scene, tweenParameter);
  }
  adjustPositions() {
    let tweens = [];

    for (let i = 0; i < this.cards.length; i++) {
      const tweenParameter = {
        x: Util.calcHandCardPositon(i).x,
        y: Util.calcHandCardPositon(i).y,
        duration: 250,
        ease: 'Power2',
      };
      tweens = tweens.concat(this.cards[i].imageLayer.applyTween(this.scene, tweenParameter));
    }
    return tweens;
  }
  slideInAll() {
    const promises = [];

    // 5は想定される手札の最大数
    for (let index = 0; index < 5; index++) {
      if (!this.cards[index]) break;
      promises.push(this.cards[index].imageLayer.slideIn(this.scene, 1000, 0, 200, 70 * index));
    }
    return promises;
  }
  slideIn(index) {
    if (this.cards[index] === undefined) { return }
    return this.cards[index].imageLayer.slideIn(this.scene, 1000, 0, 200, 70 * index);
  }
}