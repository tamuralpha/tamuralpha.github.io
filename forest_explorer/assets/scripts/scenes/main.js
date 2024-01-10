import { MAP_OBJECT_TYPE } from '../constants.js';
import { MapHolder } from '../entitys/mapholder.js'
import { CardHolder } from '../cards/cardholder.js'
import { Deck } from '../cards/deck.js';
import * as Effect from '../effects.js'
import * as Util from '../util.js'
import { Title_Scene, GameOver_Scene, GameClear_Scene } from './only_select_scenes.js';
import { PlayerData } from '../player.js';
import { DeckEdit_Scene } from './deck_edit.js'
import { Battle_Scene } from './battle.js'
import { HeadUpDisplay } from '../head-up-display.js'
import { Treasure_Scene } from './treasure.js';
import { StageDatabase } from '../stagedata.js'

class Game_Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Game_Scene' });
    this.emitting;
    this.emitter;
    this.isInputActive;
  }
  preload() {
    this.loadEnemys();
    // this.load.pack('assetPack', 'assets/scripts/jsons/load_assets.json');
    this.load.json('map_card_datas', 'assets/scripts/jsons/map_card_datas.json');
    this.load.json('battle_card_datas', 'assets/scripts/jsons/battle_card_datas.json');
    this.load.json('stage_data', 'assets/scripts/jsons/stage_data.json');
    this.load.json('enemy_data', 'assets/scripts/jsons/enemy_data.json');
    // ロードエラーのイベントリスナーを設定
    this.load.on('loaderror', function (file, error) {
      console.error(`Error loading file: ${file.key}. Error: ${error}`);
    });

    // カード画像をロード
    for (let index = 0; index < 6; index++) {
      this.load.image(`card_${index}`, `assets/card/${index}.png`);
    }

    // カード画像をロード
    for (let index = 0; index < 12; index++) {
      this.load.image(`card_battle_${index}`, `assets/card/battle/${index}.png`);
    }
  }
  // jsonに記載？
  loadEnemys() {
    const types_lengths = {
      fire: 4,
      ice: 4,
      wind: 4,
      iron: 6,
      boss: 1
    }
    for (const type of Object.keys(types_lengths)) {
      const length = types_lengths[type];

      for (let index = 0; index < length; index++) {
        this.load.image(`enemy_${type}_${index}`, `assets/chara/enemy/${type}_${index}.webp`);
      }
    }
  }
  init(data) {
    this.currentStageID = data.currentStage || 1;
    this.data = data
  }
  async create() {
    this.stageDatabase = new StageDatabase(this);
    this.stagedata = this.stageDatabase.getData(this.currentStageID);

    this.deck = new Deck(this);
    this.playerdata = this.data.playerdata ? this.data.playerdata : new PlayerData(this);
    this.playerdata_whenStageStart = this.playerdata.copy();
    this.handCardHolder = new CardHolder(this, null, this.stagedata);
    this.headUpDisplay = new HeadUpDisplay(this, this.playerdata, this.stagedata);

    // 画面を真っ暗にし、その裏で初期設定
    const fadeInOverlay = Util.prepareFadeinOverlay(this);

    if (!this.stagedata) {
      await this.startGameClaerScene();
      return;
    }

    this.startBGM();

    this.headUpDisplay.create();
    this.headUpDisplay.refreshOnMap();

    //  A simple background for our game
    this.add.image(448, 256, `background_${Util.getStageBackgroundIndex(this.currentStageID)}`);

    // 画面の真っ暗を解除
    await Util.fadeinOverlay(this, fadeInOverlay);

    this.mapHolder = new MapHolder(this, 'ground', this.playerdata, this.stagedata);
    await this.mapHolder.initialize();

    await this.createCards.call(this);
    // this.createHandParticles.call(this);
    this.isInputActive = true;

    // // Tキーのオブジェクトを作成
    // let tKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);

    // // // Tキーが押されたときのイベントリスナー（デバッグ用）
    // tKey.on('down', async (event) => {
    //   // await this.startGameOverScene();

    //   // await this.launchTreasureScene();
    //   // console.log(this.mapHolder.mapObjectHolder.mapObjects);
    //   // シーンBを重ねる
    //   // await this.launchDeckEditScene(false);
    //   // this.isInputActive = false;
    //   // await this.launchBattleScene(`enemy_${this.stagedata.bossID}`);
    //   // await this.startGameClaerScene();
    //   // this.cardHolder.clear();
    //   this.scene.start(this.scene.key, { currentStage: this.currentStageID + 1 });
    //   // this.isInputActive = true;
    // });
  }
  // BGM管理
  startBGM() {
    if (this.game.bgmID !== this.stagedata.bgmID) {
      if (this.game.bgm) this.game.bgm.stop();

      // イントロ部分の音源を追加
      this.game.bgm = this.sound.add(`stage${this.stagedata.bgmID}_intro`);

      // ループする音源を追加（まだ再生はしない）
      this.loopBGM = this.sound.add(`stage${this.stagedata.bgmID}_loop`, { loop: true });

      // イントロが終わったらループ音源を再生
      this.game.bgm.on('complete', () => {
        this.game.bgm = this.loopBGM;
        this.game.bgm.play();
      });

      // イントロ部分を再生
      this.game.bgm.play();

      this.game.bgmID = this.stagedata.bgmID;
    }
  }
  async createCards() {
    this.handCardHolder.create(5);
    // すべての createCard プロミスが解決するのを待つ
    await Promise.all(this.handCardHolder.slideInAll());
    this.input.on('pointerdown', this.pointerDownHandler, this);
  }
  async pointerDownHandler(pointer, gameObject) {
    if (!this.isInputActive) return;
    if (gameObject.length === 0) { return }
    this.isInputActive = false;

    const clickedGameObject = gameObject[0];
    await this.clickedAction(clickedGameObject);

    this.isInputActive = true;
  }
  // タップしたのがデッキアイコンの場合、デッキの内容を表示
  async clickedAction(clickedGameObject) {
    if (clickedGameObject.name === "deckIcon") {
      await this.launchDeckEditScene(true);
      this.isInputActive = true;
      return;
    }

    // カードをタップしていない場合はここで終了
    let card = this.handCardHolder.selectCardFromGameObject(clickedGameObject);
    if (card === undefined || card === null) {
      this.isInputActive = true;
      return;
    }

    const movedDistance = await this.cardAction(card);
    await this.afterCardAction(card, movedDistance);
  }
  async cardAction(card) {
    // カード内容に基づく処理
    const movedDistance = await this.moveDirection(card.data.effects);
    await this.restTurn(card);

    return movedDistance;
  }
  async afterCardAction(card, movedDistance) {
    if (movedDistance) {
      this.stagedata.moveCount(movedDistance);
      this.headUpDisplay.refreshOnMap();

      await this.overlapEvent();
      await this.goalEvent();
    }

    if (this.playerdata.isFainted()) {
      await this.startGameOverScene();
      return;
    }

    // 処理終了後、選んだカードを削除
    await Promise.all(card.imageLayer.fadeout(this));

    // カードを5枚になるまで補充
    let tweens = [];
    tweens.push(this.refleshHandCards(card));

    // プレイヤーが移動していれば、足場をそれに合わせて移動
    tweens = tweens.concat(this.slideAndCreateScaffolds(movedDistance));

    await Promise.all(tweens);
    this.headUpDisplay.refreshOnMap(); // HUDを再表示、主に休息カードの残りなど

  }
  async goalEvent() {
    if (this.stagedata.toGoalLength === 0)
      await this.arriveGoal();
  }
  async refleshHandCards(card) {
    this.handCardHolder.remove(card);
    this.handCardHolder.adjustPositions()
    this.handCardHolder.create(5);  // 5枚になるまでカードを生成
    await Promise.all(this.handCardHolder.slideIn(4)); // 5枚目をスライドイン……書き方として雑？
  }
  async restTurn(card) {
    const restTurnAmount = this.getRestTurn(card.data.effects);
    if (!restTurnAmount) { return; }

    // 休息中、何らかのイベントが発生した場合、そこで休息は終了
    let isOverlapEventDone = false;

    for (let index = 0; index < restTurnAmount && !isOverlapEventDone; index++) {
      this.playerdata.heartPoint += Math.ceil(this.currentStageID / 2); // 現在のステージ数 /2 （切り上げ）回復。最大値は今のところ無い
      this.playerdata.deck.randomRecover();
      this.headUpDisplay.refreshOnMap();

      const playerImage = this.mapHolder.mapObjectHolder.mapObjects[0].gameObject;
      await Effect.showDamageEffect(this, playerImage, -Math.ceil(this.currentStageID / 2), false);

      await this.mapHolder.moveAllEnemys();
      this.sound.play('step');
      isOverlapEventDone = await this.overlapEvent();

      await this.mapHolder.cleanupMapObjects();
    }
  }

  // 横移動が行われた場合、新しい足場を生成
  // 現状クリアイベントをここに記載しているが、不自然なので要修正
  async slideAndCreateScaffolds(movedDistance) {
    if (movedDistance === null || movedDistance === undefined || movedDistance.x === 0) { return }

    const tweens = [];

    this.headUpDisplay.refreshOnMap();
    tweens.push(this.mapHolder.organizeAllMapByPlayerPosition(movedDistance.x));

    if (this.stagedata.toGoalLength > 0)
      tweens.push(this.mapHolder.repopObjects());

    return tweens;
  }
  async overlapEvent() {
    // 戻り値は[player, overlapObject]
    // 最初に見つかった有効なイベントを持つペアが帰るため、一度のみだと複数あると処理しきれない
    // そのため、whileループする
    let isOverlapedNone = false;
    let isOverlapEventDone = false;
    let failsafeCount = 0; // 何らかの原因により読みきれなかった場合

    while (!isOverlapedNone || failsafeCount > 100) {
      const overlapPair = this.mapHolder.getOverlapPair();

      if (!overlapPair) {
        isOverlapedNone = true;
        return isOverlapEventDone;
      }

      this.mapHolder.removeMapObject(overlapPair[1]);
      isOverlapEventDone = await this.launchOverlapEvent(overlapPair);

      failsafeCount++;
    }
    return isOverlapEventDone;
  }
  async arriveGoal() {
    // ボス戦を実行
    await this.launchBattleScene(`enemy_${this.stagedata.bossID}`, true);

    if (this.playerdata.isFainted()) {
      await this.startGameOverScene();
      return;
    }

    await Util.fadeoutOverlay(this); // シーン移行後も残る？
    this.playerdata.heartPoint += 10; // クリアボーナス
    this.clear();
    this.scene.start(this.scene.key, { currentStage: this.currentStageID + 1, playerdata: this.playerdata });
  }
  clear() {
    this.handCardHolder.clear();
  }
  async startGameOverScene() {
    await Util.fadeoutOverlay(this); // シーン移行後も残る？
    this.clear();
    this.scene.start('GameOver_Scene', { playerdata: this.playerdata_whenStageStart, currentStage: this.currentStageID });
  }
  async startGameClaerScene() {
    await Util.fadeoutOverlay(this); // シーン移行後も残る？
    this.clear();
    this.scene.start('GameClear_Scene', { playerdata: this.playerdata });
  }
  async launchOverlapEvent(overlapPair) {
    if (overlapPair[0].type !== MAP_OBJECT_TYPE.PLAYER) { return false; }

    const eventMap = new Map([
      [MAP_OBJECT_TYPE.ENEMY, async () => this.launchBattleScene(overlapPair[1].gameObject.name)],
      [MAP_OBJECT_TYPE.DECK_EDIT, async () => this.launchDeckEditScene(false)],
      [MAP_OBJECT_TYPE.TREASURE, async () => this.launchTreasureScene(false)]
    ]);

    const eventType = overlapPair[1].type;

    if (eventMap.has(eventType)) {
      const eventAction = eventMap.get(eventType);
      await eventAction();
      return true;
    }

    return false;
  }
  // "launch"です。背後ではこのシーンが消えずに残ってます（操作不可）
  async launchBattleScene(enemyID, isBossEnemy) {
    const overlay = await Util.fadeoutOverlay(this);
    this.scene.launch('Battle_Scene', { playerdata: this.playerdata, enemyID: enemyID, stagedata: this.stagedata });

    await new Promise(async resolve => {
      const onBattleCompleted = async (playerdata) => {
        this.scene.stop('Battle_Scene');

        this.playerdata = playerdata;
        this.headUpDisplay.refreshOnMap();

        // 倒されていれば画面は暗いまま
        if (!this.playerdata.isFainted())
          await Util.fadeinOverlay(this, overlay);

        this.game.events.off('BattleCompleted', onBattleCompleted);
        resolve();
      };
      this.game.events.on('BattleCompleted', onBattleCompleted);
    });

    if (this.playerdata.isFainted()) { return; }
    await this.launchTreasureScene(isBossEnemy);
  }
  async launchDeckEditScene(isReadOnly) {
    this.sound.play('pick_card');
    this.scene.launch('DeckEdit_Scene', { playersDeck: this.playerdata.deck, cardInventory: this.playerdata.cardInventory, isReadOnly: isReadOnly });

    await new Promise(resolve => {
      // 編集後のデッキデータを受け取る
      const onDeckEditCompleted = (deck) => {
        this.scene.stop('DeckEdit_Scene');
        this.playerdata.deck = deck;
        this.playerdata.deck.sort();
        this.game.events.off('DeckEdited', onDeckEdited);
        this.game.events.off('DeckEditCompleted', onDeckEditCompleted);
        resolve();
      };
      const onDeckEdited = (deck) => {
        this.headUpDisplay.redrawCounts(deck);
      }

      this.game.events.on('DeckEdited', onDeckEdited);
      this.game.events.on('DeckEditCompleted', onDeckEditCompleted);
    });
  }
  // アイテムゲットシーンをlaunchします
  // 基本的にstagedataに基づくRankのアイテムが出現しますが、rareDropRateに応じて一つ上のRankのアイテムがでます
  // isRareDropがtrueだと確実にrareDropになります
  async launchTreasureScene(isRareDrop) {
    this.sound.play('treasure_open');
    const dropRank = this.stagedata.dropRank;
    const rareDropRate = isRareDrop ? 100 : this.stagedata.rareDropRate;

    this.scene.launch('Treasure_Scene', { rank: dropRank, rareDropRate: rareDropRate });

    await new Promise(resolve => {
      const onTreasureSelectCompleted = (treasure) => {
        // 編集後のデッキデータを受け取る
        this.scene.stop('Treasure_Scene');

        // 現状カードのみだが、別のものをtreasureにする場合は注意
        this.playerdata.addCard(treasure);
        this.game.events.off('TreasureSelectCompleted', onTreasureSelectCompleted);

        resolve();
      };
      this.game.events.on('TreasureSelectCompleted', onTreasureSelectCompleted);
    });
  }
  async moveDirection(effects) {
    const command = effects.effect;

    if (typeof command === 'string' && command.includes('move')) {
      if (command.includes('right')) {
        const isTeleport = effects.special !== undefined && effects.special === "teleport";
        return await this.mapHolder.moveTo({ x: effects.value, y: 0 }, isTeleport);
      } else if (command.includes('up')) {
        return await this.mapHolder.moveTo({ x: 0, y: -1 });
      } else if (command.includes('down')) {
        return await this.mapHolder.moveTo({ x: 0, y: 1 });
      }
    }
  }
  getRestTurn(effects) {
    if (effects.effect !== 'rest') return;
    else return effects.value;
  }
}

var config = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.NONE,  // 自動スケーリングを無効にする
    parent: 'game',
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 896,
    height: 512,
  },
  antialias: true,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  // scene: [Game_Scene, DeckEdit_Scene, Battle_Scene, Treasure_Scene, GameOver_Scene, GameClear_Scene, Title_Scene]
  scene: [Title_Scene, Game_Scene, DeckEdit_Scene, Battle_Scene, Treasure_Scene, GameOver_Scene, GameClear_Scene]
};
// 単純に現在のウィンドウサイズを検知し、それに収まる範囲で一番大きい倍率になります
function resizeGame() {
  const canvas = game.canvas;
  const canvasWidth = canvas.width, canvasHeight = canvas.height;
  const windowWidth = window.innerWidth, windowHeight = window.innerHeight;

  // キャンバスとウィンドウのサイズ比を計算
  const scaleX = windowWidth / canvasWidth;
  const scaleY = windowHeight / canvasHeight;

  // 両方の比率のうち小さい方を選択し、それを倍率とする
  let scale = Math.min(scaleX, scaleY);

  canvas.style.width = (canvasWidth * scale) + 'px';
  canvas.style.height = (canvasHeight * scale) + 'px'
}

window.addEventListener('resize', resizeGame);

// ゲーム起動
var game = new Phaser.Game(config);
resizeGame();