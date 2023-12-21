import { CardHolder } from "../cards/cardholder.js";
import { DEPTH, EFFECT_ELEMENT } from "../constants.js";
import { HeadUpDisplay } from '../head-up-display.js'
import * as Util from '../util.js'

export class Battle_Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Battle_Scene' });
  }
  init(data) {
    this.playerdata = data.playerdata;
    this.stagedata = data.stagedata;
    this.enemyID = data.enemyID;
  }
  async create() {
    this.isInputActive = false;

    this.enemydatabase = new EnemyDatabase(this);
    const enemydataID = this.enemyID.split('enemy_');
    this.enemydata = this.enemydatabase.get(enemydataID[1]);

    const overlay = Util.prepareFadeinOverlay(this);
    this.add.image(448, 256, `background_${Util.getStageBackgroundIndex(this.currentStageID)}`);
    this.headUpDisplay = new HeadUpDisplay(this, this.playerdata, this.stagedata);
    this.headUpDisplay.create();
    this.headUpDisplay.refreshOnBattle();

    this.drawCharacter();
    await Util.fadeinOverlay(this, overlay);

    this.handCardHolder = new CardHolder(this, this.playerdata.deck);
    await this.createCards();

    this.isInputActive = true;
    this.input.on('pointerdown', async (pointer, gameObject) => {
      await this.pointerDownHandler(pointer, gameObject);
    });
  }
  drawCharacter() {
    this.playersImage = this.add.image(248, 306, 'player').setDepth(DEPTH.PLAYER_0);
    this.playersImage.y -= this.playersImage.height / 2;
    this.enemysImage = this.add.image(648, 306, `enemy_${this.enemydata.id}`).setDepth(DEPTH.ENEMY_0);
    this.enemysImage.y -= this.enemysImage.height / 2;
    this.add.image(448, 306, 'ground_long').setDepth(DEPTH.SCAFFOLD);
    this.playersImage.scaleX = -1;
  }
  async createCards() {
    this.handCardHolder.create(5);
    this.headUpDisplay.refreshOnBattle();
    const promises = this.handCardHolder.slideInAll();
    await Promise.all(promises.map(promises => Promise.all(promises)));
  }
  async pointerDownHandler(pointer, gameObject) {
    if (!this.isInputActive) return;
    this.isInputActive = false;

    const card = this.handCardHolder.selectCardFromGameObject(gameObject);
    if (gameObject.length === 0 || card === undefined || card === null) {
      this.isInputActive = true;
      return;
    }

    await this.executeBattle(card);
    this.isInputActive = true;
  }
  async executeBattle(card) {
    this.playerdata.deck.use(card);
    const effects = card.data.effects;

    const isBattleEnd = await this.battle(effects);
    if (isBattleEnd) { this.endBattleScene(); return; }

    this.enemydata.updateTurn();
    this.headUpDisplay.refreshOnBattle();

    await this.refillHand(card);
    this.headUpDisplay.refreshOnBattle();
  }
  // プレイヤーの行動 => 敵の行動を順に処理
  // 戻り値は『戦闘が終了したか』
  async battle(effects) {
    await this.playersAttack(effects);
    await this.enemysAttack();
    return await this.defeatAnimation();
  }
  // 選んだカードに基づく処理
  async playersAttack(effects) {
    if (effects.effect.includes('attack')) {
      const damage = this.enemydata.damage(effects.effect_element, effects.value);
      const isWeak = effects.value < damage; // effects.value < damageの場合は弱点攻撃したとみなす
      this.headUpDisplay.refreshOnBattle();

      await this.showAttackEffect(effects, this.enemysImage);
      await this.showDamageEffect(this.enemysImage, damage, isWeak);
    }
    else {
      this.playerdata.effect(effects);
      this.enemydata.effect(effects);
      await this.showSpecialEffect(effects);
      this.headUpDisplay.refreshOnBattle();
    }
  }
  async showAttackEffect(effects, target) {
    const tweens = this.getAttackTweens(effects, target);
    await Promise.all(tweens);
  }
  getAttackTweens(effects, target) {
    const element = effects.effect_element;
    const rank = effects.rank;

    const duration = 500;

    const x = target.x;
    const y = target.y;

    const tweens = [];

    switch (element) {
      case EFFECT_ELEMENT.FIRE:
        tweens.push(Util.waitForParticles(this,
          {
            emitZone: { source: new Phaser.Geom.Circle(x, y, 25 + 10 * rank), quantity: 150 },
            color: [0xfacc22, 0xf89800, 0xf83600, 0x9f0404],
            colorEase: 'quad.out',
            duration: duration,
            lifespan: duration,
            scale: { start: 0.70 * rank, end: 0, ease: 'sine.out' },
            accelerationY: { min: -150, max: -350 },
            speed: { min: 30 * rank, max: 60 * rank },
            blendMode: 'ADD',
            quantity: 350 * rank,
          }));
        break;
      case EFFECT_ELEMENT.ICE:
        tweens.push(
          Util.waitForParticles(this, {
            emitZone: { source: new Phaser.Geom.Circle(x, y, 150), quantity: 32 },
            duration: duration,
            lifespan: duration,
            speed: { min: 10, max: 20 },
            scale: { start: 0.05, end: 0 },
            quantity: 1000,
            blendMode: 'ADD',
          }));
        tweens.push(
          Util.waitForParticles(this, {
            emitZone: { source: new Phaser.Geom.Circle(x, y, 150), quantity: 6 },
            duration: duration,
            lifespan: duration,
            alpha: { start: 1, end: 0 },
            scale: { start: 0.5, end: 0.8 },
            quantity: 6 * rank,
            frequency: 100,
            blendMode: 'ADD',
            emitCallback: (particle) => {
              particle.angle = Phaser.Math.Between(0, 360);
            },
          },
            { particle: 'effect_ice' }))
        break;
      case EFFECT_ELEMENT.WIND:
        tweens.push(
          Util.waitForParticles(this,
            {
              emitZone: { source: new Phaser.Geom.Circle(x, y, 90 + 15 * rank), quantity: 32 },
              frame: { frames: [0, 1, 2, 3], cycle: true },
              duration: duration,
              lifespan: duration,
              scale: { start: 0.55 + 0.10 * rank, end: 0 },
              alpha: { start: 1, end: 0 },
              blendMode: 'ADD',
              quantity: 3 * rank,
              frequency: 100 - 20 * rank,
              emitCallback: (particle) => {
                particle.angle = Phaser.Math.Between(0, 360);
              },
            },
            {
              particle: 'effect_spark_sheet',
              explode: false,
            }));
        break;
    } // switch終了

    return tweens;
  }
  async showSpecialEffect(effects) {
    switch (effects.effect) {
      case "analyze":
        await Util.waitForParticles(this, {
          x: this.enemysImage.x,
          y: this.enemysImage.y,
          duration: 500,
          lifespan: 500,
          scale: { start: 0, end: 2, ease: 'POWER2' },
          alpha: { start: 1, end: 0, ease: 'POWER2' },
          quantity: 1,
          frequency: 120,
          blendMode: 'ADD'
        },
          {
            particle: `enemy_${this.enemydata.id}`,
            explode: false,
          })
        this.showAnalyzeParticle(this.enemysImage, this.enemydata);
        break;
      case 'heal': {
        await Util.waitForParticles(this, {
          emitZone: { source: new Phaser.Geom.Circle(this.playersImage.x, this.playersImage.y + this.playersImage.height / 2 - 15, 30), quantity: 150 },
          color: [0xFFFB8B, 0xFFE49E, 0xEDC13A],
          colorEase: 'quad.out',
          duration: 500,
          lifespan: 500,
          scale: { start: 0, end: 1, ease: 'sine.out' },
          alpha: { start: 1, end: 0, ease: 'sine.out' },
          speed: { min: -90, max: 90 },
          accelerationY: { min: -600, max: -900 },
          quantity: 50,
          frequency: 60,
          blendMode: 'ADD',
          emitCallback: (particle) => {
            particle.angle = Phaser.Math.Between(0, 360);
          },
        },
          {
            particle: 'particle_p',
            explode: false,
          })
        await this.showDamageEffect(this.playersImage, effects.value * -1, false);
        break;
      }
    }
  }
  async enemysAttack() {
    if (this.enemydata.heartPoint <= 0) { return }
    this.playerdata.heartPoint -= this.enemydata.attackPoint;
    const shape4 = new Phaser.Geom.Line(
      this.playersImage.x - 100, this.playersImage.y - 100,
      this.playersImage.x + 100, this.playersImage.y + 100);

    await Util.waitForParticles(this, {
      emitZone: { type: 'edge', source: shape4, quantity: 64, total: 1 },
      duration: 250 / 1.5,
      lifespan: 250 / 1.5,
      scale: { start: 0.4, end: 0 },
      alpha: { start: 1, end: 0 },
      quantity: 6,
      blendMode: 'ADD',
    },
      {
        particle: 'particle_p',
        explode: false,
      })

    await this.showDamageEffect(this.playersImage, this.enemydata.attackPoint);
  }
  async defeatAnimation() {
    if (this.enemydata.heartPoint <= 0) {
      await this.defeatImage(this.enemysImage);
      return true;
    }
    else if (this.playerdata.isFainted()) {
      await this.defeatImage(this.playersImage);
      return true;
    }
    return false;
  }
  // 選んだカードを削除
  async refillHand(card) {
    await Promise.all(card.imageLayer.fadeout(this));
    this.handCardHolder.remove(card);
    this.handCardHolder.adjustPositions()
    this.handCardHolder.create(5);

    const slideinTweens = this.handCardHolder.slideIn(4);
    if (slideinTweens)
      await Promise.all(slideinTweens);
  }
  async showDamageEffect(target, damage, isWeak) {
    const x = target.x + target.width / 2 - 25;
    const y = target.y - target.height / 2 - 15
    const color = this.getDamageEffectColor(damage, isWeak);

    // ダメージテキストを表示し、少しポップする演出
    const damageText = this.add.text(x, y, Math.abs(damage), {
      fontSize: 36,
      fontFamily: "Pixelify Sans",
      color: color,
      stroke: '#000',
      strokeThickness: 4
    }).setDepth(DEPTH.UI_TEXT);

    const damageTweenParameter = {
      targets: damageText,
      y: damageText.y - 15,
      scale: { from: 1, to: 1.1 },
      yoyo: true,
      ease: 'Cubic.easeOut',
      duration: 250,
    };

    // ターゲットが赤くなり、点滅する演出（ダメージ０以下の場合は点滅のみ）
    if (damage >= 0) target.setTint(0xFF0000);

    const flashParameter = {
      targets: target,
      alpha: { from: 1, to: 0.5 },
      ease: 'Linear',
      duration: 50,
      yoyo: true,
      repeat: 1
    };

    // ターゲットが振動する演出
    const randomQuakeValue = {
      x: Phaser.Math.Between(-10, 10) / 10,
      y: Phaser.Math.Between(-10, 10) / 10
    }

    const quakeParamerter = {
      targets: target,
      x: { from: target.x - randomQuakeValue.x, to: target.x + randomQuakeValue.x },
      y: { from: target.y - randomQuakeValue.y, to: target.y + randomQuakeValue.y },
      duration: 50,
      yoyo: true,
      repeat: 1
    };

    const dTween = Util.waitForTween(this, damageTweenParameter);
    const fTween = damage < 0 ? null : Util.waitForTween(this, flashParameter);
    const sTween = damage < 0 ? null : Util.waitForTween(this, quakeParamerter);

    // 上記を同時に実行し、まとめて待機
    await Promise.all([dTween, fTween, sTween]);
    damageText.destroy();
    target.setTint(0xFFFFFF);
  }
  // ①弱点属性である：赤、②ダメージがマイナスである：緑、③その他：白
  getDamageEffectColor(damage, isWeak) {
    let color = isWeak ? '#FF0000' : '#FFFFFF';
    color = damage < 0 ? '#00FF00' : color;

    return color;
  }
  async defeatImage(image) {
    image.setTint(0xff0000);

    const tweenParameter = {
      targets: image,
      alpha: { from: 1, to: 0 },
      ease: 'Power2',
      duration: 300,
      delay: 100,
    };

    await Util.waitForTween(this, tweenParameter);
  }
  // 『分析魔法』のエフェクトの表示。シーン中永続的に表示される
  showAnalyzeParticle(target, enemydata) {
    if (this.analyzeEffectParticle) return;

    let tint = 0x000000;
    const weakElement = enemydata.getWeak();
    if (weakElement === EFFECT_ELEMENT.FIRE) { tint = 0xFF0000; }
    if (weakElement === EFFECT_ELEMENT.ICE) { tint = 0x0000FF; }
    if (weakElement === EFFECT_ELEMENT.WIND) { tint = 0x00FF00; }

    // エミッターの設定
    this.analyzeEffectParticle = this.add.particles(0, 0, 'particle_p', {
      emitZone: {
        type: 'edge',
        source: new Phaser.Geom.Ellipse(target.x, target.y, target.width + 25, target.height + 25),
        quantity: 64,
        total: 1
      },
      scale: { start: 0.3, end: 0.1 },
      blendMode: 'ADD',
      lifespan: 600,
      quantity: 1,
      alpha: { start: 1, end: 0.5 },
      frequency: 30,
      tint: tint
    }).setDepth(DEPTH.UI_PLUS);
  }
  clear() {
    this.handCardHolder.clear();
    this.analyzeEffectParticle = null;
  }
  async endBattleScene() {
    this.playerdata.deck.resetAllDraw();
    await Util.fadeoutOverlay(this);
    this.clear();
    this.game.events.emit('BattleCompleted', this.playerdata);
  }
}
// 仮置き
class EnemyDatabase {
  constructor(scene) {
    this.enemydatas = scene.cache.json.get('enemy_data');
  }
  get(id) {
    const original = this.enemydatas[id];
    return new EnemyData(original.id, original.type, original.heart_point, original.attack_point, original.option);
  }
}
class EnemyData {
  constructor(id, type, heartPoint, attackPoint, option) {
    this.id = id;
    this.type = type;
    this.heartPoint = heartPoint;
    this.attackPoint = attackPoint;
    this.status = {};
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
        this.status.analyzed = 2;
        break;
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
      this.checkIsAnalyzed();
    return isWeak;
  }
  // 分析状態（次の攻撃が弱点属性攻撃扱いになる）
  checkIsAnalyzed() {
    let isAnalyzed = this.status.analyzed !== undefined && this.status.analyzed > 0;
    return isAnalyzed;
  }
  // 状態異常が増えるたびに記述を増やす必要があるため、改善が必要？
  updateTurn() {
    if (this.status.analyzed > 0) { this.status.analyzed--; }
  }
}