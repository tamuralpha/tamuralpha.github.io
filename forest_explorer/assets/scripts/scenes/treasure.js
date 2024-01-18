import { DEPTH } from '../constants.js';
import { CardDatabase } from '../cards/carddatabase.js';
import { ImageLayer } from '../cards/imagelayer.js';
import { Card } from '../cards/card.js';
import * as Util from '../util.js'

// 3枚のカードから一枚を選んで取得
export class Treasure_Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Treasure_Scene' });
    this.cards = [];
    this.isInputActive = false;
  }
  init(data) {
    this.amount = data.amount ? data.amount : 3;
    this.rank = data.rank ? data.rank : 1;
    this.rareDropRate = data.rareDropRate ? data.rareDropRate : 0;
  }
  async create() {
    this.carddatabase = new CardDatabase(this);
    this.createCards()

    this.input.on('pointerdown', async (pointer, gameObjects) => {
      await this.pointerDownHandler(pointer, gameObjects);
    });

    this.isInputActive = true;
  }
  async createCards() {
    let promises = [];

    for (let index = 0; index < this.amount; index++) {
      const rnd = this.getRandomCard(this.rank);
      if (rnd === -1) { return false }

      const position = { x: 180 + 268 * index, y: 256 }
      const carddata = this.carddatabase.get_battle(rnd);

      const card = Util.craeteCard(this, position, index, carddata, 1, true, true);
      this.cards.push(card);
      promises = promises.concat(this.slideIn(index));
    }

    await Promise.all(promises);
  }
  async pointerDownHandler(pointer, gameObjects) {
    if (!this.isInputActive || gameObjects.length === 0) { return; }
    this.isInputActive = false;

    const index = await this.selectTreasure(gameObjects);

    this.game.events.emit('TreasureSelectCompleted', this.cards[index].data);
    this.clear();
  }
  async selectTreasure(gameObjects) {
    const target = gameObjects[0];
    const index = parseInt(target.name);

    await this.stackCards(index);
    await this.flashSelectedCard(target);

    await this.fadeoutCards(index);
    return index;
  }
  async stackCards(topIndex) {
    let tweens = [];

    for (let index = 0; index < this.cards.length; index++) {
      if (index === topIndex) { this.cards[index].imageLayer.emphasis(); } // 指定したカードを一番上に見せる

      const tweenParameter = {
        x: this.cards[1].imageLayer.getFrame().x,
        y: this.cards[1].imageLayer.getFrame().y,
        ease: 'Power2',
        duration: 250,
      };

      tweens = tweens.concat(this.cards[index].imageLayer.applyTween(this, tweenParameter));
    }

    this.sound.play('decide');
    await Promise.all(tweens);
  }
  async flashSelectedCard(target) {
    const tweens = [];

    // ターゲットの中心点座標
    const center = { x: target.x, y: target.y };
    const rectangle = new Phaser.Geom.Rectangle(target.x - target.width, target.y - target.height, target.width * 2, target.height * 2);

    // カードの上に白い画像をかぶせ、その透明度を変えて発光っぽく演出
    const white = this.add.graphics().setDepth(DEPTH.DRAG_CARD_ILLUST_EFFECT).setAlpha(0);
    white.fillStyle(0xffffff);

    const offset = 4; // そのままだと枠に被さるため、白い画像は少し小さめに。大きさは適当
    white.fillRect(rectangle.x + offset, rectangle.y + offset, rectangle.width - offset, rectangle.height - offset);

    const flashParameter = {
      targets: white,
      alpha: { from: 0, to: 1 },
      ease: 'Linear',
      duration: 150, 
      yoyo: true,
      repeat: 0
    };

    // それぞれの動作指示をし、終了を待機してメソッド終了
    tweens.push(Util.waitForTween(this, flashParameter));
    tweens.push(this.waitForParticles(this, {
      emitZone: { type: 'edge', source: rectangle, quantity: 150 },
      duration: 250,
      scale: { start: 1.2, end: 0 },
      angle: { min: 0, max: 360 },
      blendMode: 'ADD',
      quantity: 150,
      depth: DEPTH.UI_BASE,
      lifespan: 250, // パーティクルの寿命（ミリ秒）
      frequency: -1, // パーティクルを一度だけ発生させる
      emitCallback: (particle) => this.setParticlesVelocity(particle, center)
    }));
    this.sound.play('treasure_get');
    await Promise.all(tweens)
  }
  setParticlesVelocity(particle, center) {
    let px = particle.x;
    let py = particle.y;
    let angle = Phaser.Math.Angle.Between(center.x, center.y, px, py);

    // 基本速度
    let baseSpeed = 500;

    // velocityX と velocityY を計算
    let velocityX = baseSpeed * Math.cos(angle);
    let velocityY = baseSpeed * Math.sin(angle);

    // 速度の合計を一定に保つ
    let totalSpeed = Math.abs(velocityX) + Math.abs(velocityY);
    let normalizedSpeed = baseSpeed / totalSpeed;

    particle.velocityX = velocityX * normalizedSpeed;
    particle.velocityY = velocityY * normalizedSpeed;
  }
  async waitForParticles(scene, particle) {
    return new Promise(resolve => {
      const analyzeEffectParticle = scene.add.particles(0, 0, 'particle', particle);
      analyzeEffectParticle.explode();
      scene.time.delayedCall(particle.duration, () => {
        resolve();
      });
    });
  }
  async fadeoutCards(targetIndex) {
    for (let index = 0; index < this.cards.length; index++) {
      if (targetIndex === index) { continue }
      this.cards[index].imageLayer.destroyMyself();
    }
    await Promise.all(this.cards[targetIndex].imageLayer.fadeout(this));
  }
  emitter() {
    // エミッターの設定
    this.analyzeEffectParticle = this.add.particles(0, 0, 'particle',).setDepth(DEPTH.DRAG_CARD_ILLUST);
  }
  getRandomCard() {
    // 報酬ランクを元に基本が決まる
    // ランク1（初期）の場合、弱魔法3種からセレクト、のような
    // ランダム低確率で一つ上のランクのものも出現する
    // ランダムな補助魔法またはランクに基づくランダムな攻撃魔法
    // リストを更新しなければならなくなるので対処を考える
    // ただし同じカードが既に出ている場合は再試行する
    for (let i = 0; i < 100; i++) {
      const isAttackMagic = Phaser.Math.Between(0, 100) > 15;
      let cardID = 0;

      if (isAttackMagic) {
        const isRandomRankUp = Phaser.Math.Between(0, 100) < this.rareDropRate;
        const temprank = isRandomRankUp && this.rank < 3 ? this.rank + 1 : this.rank;
        const randomOnRank = 1 + (temprank - 1) * 3;
        const id = randomOnRank + Phaser.Math.Between(0, 2)

        cardID = id;
      }
      else {
        // 補助魔法はランダムランクアップしない
        let effectMagicList = [0, 10, 11];
        if (this.rank > 1) effectMagicList = effectMagicList.concat([12, 13]);
        if (this.rank > 2) effectMagicList.push(14);

        const index = Phaser.Math.Between(0, effectMagicList.length - 1);

        cardID = effectMagicList[index];
      }

      if (!this.cards.find(card => card.id === cardID))
        return cardID;
      else
        continue;
    }
  }
  slideIn(index) {
    if (this.cards[index] === undefined) { return }
    return this.cards[index].imageLayer.slideIn(this, 0, 512, 300, 100 * index);
  }
  clear() {
    // cardsはGameObjectを持つので破棄
    for (let index = 0; index < this.cards.length; index++) {
      this.cards[index].imageLayer.destroyMyself();
    }
    this.cards = [];
  }
}