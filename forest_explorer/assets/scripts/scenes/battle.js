import { CardHolder } from "../cards/cardholder.js";
import { DEPTH, EFFECT_ELEMENT } from "../constants.js";
import { HeadUpDisplay } from '../head-up-display.js'
import * as Util from '../util.js'
import * as Effect from '../effects.js'

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

    this.enemysStatusAilmentIcons = [];

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

    const isBattleContinue = await this.executeBattle(card);
    if (isBattleContinue) this.isInputActive = true;
  }
  async executeBattle(card) {
    this.playerdata.deck.use(card);
    const effects = card.data.effects;

    const isBattleEnd = await this.battle(effects);
    if (isBattleEnd) { this.endBattleScene(); return false; }

    this.enemydata.updateTurn();
    this.showEnemyStatusAilment();
    this.headUpDisplay.refreshOnBattle();

    await this.refillHand(card);
    this.headUpDisplay.refreshOnBattle();
    return true;
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
      await Effect.showDamageEffect(this, this.enemysImage, damage, isWeak);
    }
    else {
      this.playerdata.effect(effects);
      this.enemydata.effect(effects);
      await this.playSpecialTweens(effects);
      this.headUpDisplay.refreshOnBattle();
    }
  }
  async showAttackEffect(effects, target) {
    const tweens = Effect.getAttackTweens(this, effects, target);
    await Promise.all(tweens);
  }
  // Effects.jsへの隔離も考えたものの特殊処理が多すぎて無理だった
  async playSpecialTweens(effects) {
    const tweens = [];

    switch (effects.effect) {
      case "analyze":
        this.sound.play('analyze');
        await Effect.playAnalyzeEffect(this, this.enemysImage, `enemy_${this.enemydata.id}`);
        this.showAnalyzeParticle(this.enemysImage, this.enemydata);
        break;
      case 'heal': {
        this.sound.play('heal_magic');
        await Effect.playHealEffect(this, this.playersImage);
        await Effect.showDamageEffect(this, this.playersImage, effects.value * -1, false);
        break;
      }
    }
    return tweens;
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
  async enemysAttack() {
    if (this.enemydata.heartPoint <= 0) { return }
    this.playerdata.heartPoint -= this.enemydata.attackPoint;

    // 斬撃っぽいエフェクト（現状一種）
    await Effect.enemysAttack(this, this.playersImage);
    await Effect.showDamageEffect(this, this.playersImage, this.enemydata.attackPoint);
  }
  async defeatAnimation() {
    if (this.enemydata.heartPoint <= 0) {
      await Effect.defeatImage(this, this.enemysImage);
      return true;
    }
    else if (this.playerdata.isFainted()) {
      await Effect.defeatImage(this, this.playersImage);
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
  // 敵の状態異常アイコンを表示
  showEnemyStatusAilment() {
    this.clearEnemyStatusAilment();

    // 現状1つのみだが、当然増やすなら増やし方を考える
    if (this.enemydata.checkIsAnalyzed()) {
      const enemysFoot = this.enemysImage.y + this.enemysImage.height / 2;
      const icon = this.add.image(this.enemysImage.x, enemysFoot, 'analyzed').setScale(0.5).setDepth(DEPTH.ENEMY_1);
      icon.y = icon.y + (icon.height * 0.5) / 2; // アイコンの位置は敵の足元からアイコン自身の高さ分ズラす
      this.enemysStatusAilmentIcons.push(icon);
    }
  }
  clearEnemyStatusAilment() {
    this.enemysStatusAilmentIcons.forEach(icon => icon.destroy());
    this.enemysStatusAilmentIcons = [];
  }
  clear() {
    this.handCardHolder.clear();
    if (this.playersImage) this.playersImage.destroy();
    if (this.enemysImage) this.enemysImage.destroy();
    this.clearEnemyStatusAilment();

    this.analyzeEffectParticle = null;
  }
  async endBattleScene() {
    this.playerdata.deck.resetAllDraw();
    await Util.fadeoutOverlay(this);
    this.clear();
    this.game.events.emit('BattleCompleted', this.playerdata);
  }
}
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