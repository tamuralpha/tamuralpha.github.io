import { CardHolder } from "../cards/cardholder.js";
import { DEPTH, EFFECT_ELEMENT } from "../constants.js";
import { HeadUpDisplay } from '../head-up-display.js'
import * as Util from '../util.js'
import * as Effect from '../effects.js'
import * as SpecialAttackHandler from '../special_attack_handler.js'
import { EnemyData, EnemyDatabase } from "../enemy_data.js";

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
    this.isSpecialInputActive = false;
    this.specialInputVariable = new Util.ObservableVariable("specialInputValue");

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

    this.playersStatusAilmentIcons = [];
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
    if (this.isSpecialInputActive) { this.specialPointerDownHandler(pointer, gameObject); return; }
    if (!this.isInputActive) return;
    this.isInputActive = false;

    const card = this.handCardHolder.selectCardFromGameObject(gameObject);
    if (gameObject.length === 0 || card === undefined || card === null) {
      this.isInputActive = true;
      return;
    }

    this.handCardHolder.pickUpEffectToHandCard(card);
    card.removeInteractive(); // 選択不可に
    const isBattleContinue = await this.executeBattle(card);
    if (isBattleContinue) this.isInputActive = true;
  }
  // 特殊なpointerDownHandler();
  // 手持ちのカードを一枚選択するだけ
  // 終了、無効は使用箇所で判定
  specialPointerDownHandler(pointer, gameObject) {
    this.isSpecialInputActive = false;
    const card = this.handCardHolder.selectCardFromGameObject(gameObject);
    if (gameObject.length === 0 || card === undefined || card === null) {
      this.isSpecialInputActive = true;
      return;
    }
    this.specialInputVariable.triggerChange(card);
  }
  async executeBattle(card) {
    this.playerdata.deck.use(card);
    const effects = card.data.effects;

    const isBattleEnd = await this.battle(effects);
    if (isBattleEnd) { this.endBattleScene(); return false; }

    this.enemydata.condition.updateTurn();
    this.refreshAilmentIcons();
    this.headUpDisplay.refreshOnBattle();

    await this.refillHand();
    this.headUpDisplay.refreshOnBattle();
    return true;
  }
  // プレイヤーの行動 => 敵の行動を順に処理
  // 戻り値は『戦闘が終了したか』
  async battle(effects) {
    await this.playersAttack(effects);
    this.refreshAilmentIcons();
    await this.enemysAttack();
    return await this.defeatAnimation();
  }
  // 選んだカードに基づく処理
  async playersAttack(effects) {
    if (effects.effect.includes('attack')) { // メソッド化？
      let attack_power = effects.value; // 攻撃力を計算
      attack_power += this.playerdata.useChargedPower();

      let damage = this.enemydata.damage(effects.effect_element, attack_power);
      const isWeak = effects.value < damage; // effects.value < damageの場合は弱点攻撃したとみなす

      await this.showAttackEffect(effects, this.enemysImage);
      await Effect.showDamageEffect(this, this.enemysImage, damage, isWeak);
    }
    else {
      await this.playersSpecialAttack(effects);
    }
    this.headUpDisplay.refreshOnBattle();
  }
  // 補助魔法を使う、実際の処理はHandlerに丸投げ、演出上
  async playersSpecialAttack(effects) {
    const isPlayedSpecialTween = await SpecialAttackHandler.handleSpecialAttack(this, effects);

    if (!isPlayedSpecialTween) {
      await this.playSpecialTweens(effects);
    }
  }
  async showAttackEffect(effects, target) {
    const tweens = Effect.getAttackTweens(this, effects, target);
    await Promise.all(tweens);
  }
  // Effects.jsへの隔離も考えたものの特殊処理が多すぎて無理だった
  async playSpecialTweens(effects) {
    await Effect.handleSpecialAttackEffect(this, effects);
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
    this.analyzeEffectParticle = Effect.createAnalyzeEffect(this, target, tint);
  }
  async enemysAttack() {
    if (this.enemydata.heartPoint <= 0 || this.playerdata.isFainted()) { return }
    if (!this.enemydata.checkIsActable()) { return; }
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
  async refillHand() {
    const handCards = this.handCardHolder.cards;

    // 使用済みカードを識別
    const deleteTargets = handCards.filter(card => !card.checkIsInteractive());

    // フェードアウト処理
    const fadeoutPromises = deleteTargets.map(card => card.imageLayer.fadeout(this));
    await Promise.all(fadeoutPromises);

    // 使用済みカードを削除
    deleteTargets.forEach(card => this.handCardHolder.remove(card));

    // 不足カードの補充、ポジション調整と新しいカードのスライドイン
    this.handCardHolder.create(5);

    const adjustPromises = this.handCardHolder.adjustPositions();
    const slideInPromises = [];
    for (let index = 5 - deleteTargets.length; index < 5; index++) {
      slideInPromises.push(this.handCardHolder.slideIn(index));
    }

    await Promise.all([...adjustPromises, ...slideInPromises]);
  }
  refreshAilmentIcons() {
    this.updatePlayerStatusAilmentIcons()
    this.updateEnemyStatusAilmentIcons();
  }
  updateStatusAilmentIcons(conditions, statusAilmentIcons, image, depth) {
    // 非アクティブなアイコンを識別して破棄する
    statusAilmentIcons = statusAilmentIcons.filter(icon => {
      if (!conditions.includes(icon.name)) {
        icon.destroy();
        return false;
      }
      return true;
    });

    const iconWidth = 48;
    const iconSpacing = 10;
    const totalWidth = conditions.length * iconWidth + (conditions.length - 1) * iconSpacing;

    // 状態異常のアイコンを生成
    conditions.forEach((condition, index) => {
      if (statusAilmentIcons.some(icon => icon.name === condition)) return;

      const foot = image.y + image.height / 2;
      const icon = this.add.image(0, foot, condition).setScale(0.5).setDepth(depth);
      icon.name = condition;

      icon.y += (icon.height * icon.scaleY) / 2;

      statusAilmentIcons.push(icon);
    });

    // アイコン全てを整列
    statusAilmentIcons.forEach((icon, index) => {
      const startX = image.x - totalWidth / 2 + iconWidth / 2;
      icon.x = startX + index * (iconWidth + iconSpacing);
    })

    return statusAilmentIcons;
  }
  updatePlayerStatusAilmentIcons() {
    const conditions = this.playerdata.condition.getActiveConditions();
    this.playersStatusAilmentIcons = this.updateStatusAilmentIcons(conditions, this.playersStatusAilmentIcons, this.playersImage, DEPTH.PLAYER_1);
  }
  updateEnemyStatusAilmentIcons() {
    const conditions = this.enemydata.condition.getActiveConditions();
    this.enemysStatusAilmentIcons = this.updateStatusAilmentIcons(conditions, this.enemysStatusAilmentIcons, this.enemysImage, DEPTH.ENEMY_1);
  }
  // Iconを破棄、playerの場合はステータスが持ち越される
  clearStatusAilment() {
    this.playersStatusAilmentIcons.forEach(icon => icon.destroy());
    this.playersStatusAilmentIcons = [];
    this.enemysStatusAilmentIcons.forEach(icon => icon.destroy());
    this.enemysStatusAilmentIcons = [];
  }
  clear() {
    this.handCardHolder.clear();
    if (this.playersImage) this.playersImage.destroy();
    if (this.enemysImage) this.enemysImage.destroy();
    this.clearStatusAilment();

    this.analyzeEffectParticle = null;
  }
  async endBattleScene() {
    this.playerdata.deck.resetAllDraw();
    await Util.fadeoutOverlay(this);
    this.clear();
    this.game.events.emit('BattleCompleted', this.playerdata);
  }
}