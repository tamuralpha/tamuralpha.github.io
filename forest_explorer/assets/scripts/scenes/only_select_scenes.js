import * as Util from "../util.js"

// 何かしらのセレクトを行うのみのシーン、継承して使う
// 例えばゲーム開始するだけのシーン、リトライかタイトルに戻るだけのシーンなど
// このファイルにあるのはこれを継承しているクラスのみ
class OnlySelectScene extends Phaser.Scene {
  constructor(key) {
    super({ key: key });
    this.inputActive = false;
  }
  init(data) {
    this.playerdata = data.playerdata;
  }
  async create(backgroundImageID, texts) {
    this.createBackground(backgroundImageID);
    this.createButtons(texts);

    if (this.game.bgm) { this.game.bgm.stop() }
    await this.fadein();

    this.input.on('pointerdown', async (pointer, gameObject) => {
      await this.pointerDownHandler(pointer, gameObject);
    });
    this.inputActive = true;
  }
  async fadein(addTargets) {
    addTargets = Array.isArray(addTargets) ? addTargets : [addTargets];
    const fadeinTargets = [this.background].concat(this.buttons).concat(addTargets);
    this.game.bgm.play();
    await Util.waitForTween(this, this.getFadeInTweenParameter(fadeinTargets));
  }
  getFadeInTweenParameter(fadeinTargets) {
    return {
      targets: fadeinTargets,
      alpha: { from: 0, to: 1 },
      ease: 'Linear',
      duration: 500,
      delay: 100,
    };
  }
  async pointerDownHandler(pointer, gameObjects, isNeedFadeout = true) {
    if (!this.inputActive || gameObjects.length === 0 || !gameObjects[0].name === undefined) { return false; }
    this.inputActive = false;

    this.sound.play('decide');
    await this.buttonClickReaction(gameObjects);
    if (isNeedFadeout) await Util.fadeoutOverlay(this);
    return true;
  }
  async buttonClickReaction(gameObjects) {
    const index = this.buttons.findIndex(gameObject => gameObject === gameObjects[0]) + 1; // buttonは生成時、その上に表示されるtextも1つ後ろに格納される
    const targets = index === 0 ? [gameObjects[0]] : [gameObjects[0], this.buttons[index]]; // indexが0の場合、findIndexは-1（失敗）。その場合はクリックしたオブジェクトのみを動かす

    const tweenParameter = {
      targets: targets,
      scale: 0.8,
      yoyo: true,
      duration: 50
    };
    await Util.waitForTween(this, tweenParameter);
  }
  createBackground(imageID) {
    this.background = this.add.image(448, 256, imageID).setAlpha(0);
  }
  createButtons(texts) {
    this.buttons = [];
    texts = Array.isArray(texts) ? texts : [texts];
    const xs = this.getButtonsX(texts);

    for (let index = 0; index < texts.length; index++) {
      const button = this.createButton(xs[index], texts[index]); // 0に画像、1にtextを持つ配列が返る
      this.buttons = this.buttons.concat(button);
    }
  }
  getButtonsX(texts) {
    const xs = [];

    const space = 128; // 複数のテキストがある場合、その間のスペース
    const boardWidth = this.textures.get('board').getSourceImage().width + space;
    const totalWidth = boardWidth * texts.length;
    const startX = 448 - totalWidth / 2 + boardWidth / 2;

    for (let index = 0; index < texts.length; index++) {
      xs.push(startX + (index * boardWidth));
    }

    return xs;

  }
  createButton(x, text) {
    const board = this.add.image(x, 375, 'board').setAlpha(0);
    const textOnBoard = this.add.text(x, 375, text, {
      fontSize: 28,
      fontFamily: "Pixelify Sans",
      color: "#FFF",
      stroke: '#000',
      strokeThickness: 6,
      align: 'center',
    }).setAlpha(0).setDepth().setOrigin(0.5, 0.5);

    board.name = text;
    board.setInteractive();

    return [board, textOnBoard]
  }
}

export class Title_Scene extends OnlySelectScene {
  constructor() {
    super('Title_Scene');
    this.START_BUTTON = "START"
    this.INFORMATION_BUTTON = "INFORMATION"
  }
  preload() {
    this.load.image('board', 'assets/icons/board.webp');
    this.load.image('title', 'assets/illust/title.webp');
    this.load.image('information', 'assets/icons/information.webp');
    this.load.pack('assetPack', 'assets/scripts/jsons/load_assets.json');
  }
  loadFont() {
    return new Promise((resolve, reject) => {
      WebFont.load({
        google: {
          families: ['Pixelify Sans']
        },
        active: function () {
          resolve();
        },
        inactive: function () {
          reject();
        }
      });
    });
  }
  init(data) {
    this.playerdata = data.playerdata;
  }
  async create() {
    await this.loadFont();
    await super.create('title', this.START_BUTTON);
  }
  async fadein() {
    this.game.bgm = this.sound.add('theme_2');
    this.game.bgmID = 'theme_2';
    await super.fadein([this.createTitleMessage(), this.createInformationButton()]);
  }
  async pointerDownHandler(pointer, gameObjects) {
    const isSuccessed = await super.pointerDownHandler(pointer, gameObjects, false);
    if (!isSuccessed) return;

    if (gameObjects[0].name === this.INFORMATION_BUTTON) {
      this.toggleInformation();
      super.inputActive = true;
    }
    else {
      await Util.fadeoutOverlay(this);
      this.scene.start("Game_Scene", {});
    }
  }
  toggleInformation() {
    if (this.information_text) {
      this.information_text.destroy();
      this.information_rect.destroy();
      this.information_text = null;
    }
    else {
      this.showInformation();
    }
  }
  showInformation() {
    // テキストを描画
    this.information_text = this.add.text(448, 256,
    'フレームワーク：Phaser3（https://phaser.io/phaser3）\r\n画像：DALLE-3（ChatGPT）\r\n音楽：甘茶の音楽工房（https://amachamusic.chagasi.com/）\r\n効果音：効果音ラボ（https://soundeffect-lab.info/）',
    {
      color: '#ffffff',
      fontFamily: "Pixelify Sans",
    }).setDepth(2);

    this.information_text.x -= this.information_text.width / 2;
    this.information_text.y -= this.information_text.height / 2;

    // 黒い枠を描画
    const rectSize = { width: this.information_text.width + 50, height: this.information_text.height + 50 }
    this.information_rect = this.add.graphics().setDepth(1);

    this.information_rect.fillStyle(0x000000, 1);
    this.information_rect.fillRect(448 - rectSize.width/2, 256 - rectSize.height/2, rectSize.width, rectSize.height);
    this.information_rect.lineStyle(2, 0xffffff, 1);
    this.information_rect.strokeRect(448 - rectSize.width/2, 256 - rectSize.height/2, rectSize.width, rectSize.height);
  }
  createTitleMessage() {
    const text = this.add.text(448, 84, "FOREST EXPLORER", {
      fontSize: 84,
      fontFamily: "Pixelify Sans",
      color: "#FFF",
      stroke: '#000',
      strokeThickness: 8
    }).setAlpha(0);
    text.x -= text.width / 2;
    return text;
  }
  createInformationButton() {
    const button = this.add.image(854, 42, "information").setAlpha(0);
    button.setInteractive();
    button.name = this.INFORMATION_BUTTON;
    return button;
  }
}
export class GameOver_Scene extends OnlySelectScene {
  constructor() {
    super('GameOver_Scene');
    this.CONTINUE_BUTTON = "CONTINUE"
    this.TITLE_BUTTON = "TITLE"
  }
  init(data) {
    this.playerdata = data.playerdata;
    this.currentStage = data.currentStage;
    this.inputActive = false;
  }
  async fadein() {
    this.game.bgm = this.sound.add('theme_1');
    this.game.bgmID = 'theme_1';
    await super.fadein(this.createGameOverMessage());
  }
  async pointerDownHandler(pointer, gameObjects) {
    const isSuccessed = await super.pointerDownHandler(pointer, gameObjects);
    if (!isSuccessed) return;
    console.log(gameObjects);
    const startscene = gameObjects[0].name === this.CONTINUE_BUTTON ? 'Game_Scene' : 'Title_Scene';
    this.scene.start(startscene, { playerdata: this.playerdata, currentStage: this.currentStage });
  }
  async create() {
    await super.create('gameover', [this.CONTINUE_BUTTON, this.TITLE_BUTTON]);
  }
  createGameOverMessage() {
    const text = this.add.text(448, 84, "GAME OVER", {
      fontSize: 84,
      fontFamily: "Pixelify Sans",
      color: "#F00",
      stroke: '#000',
      strokeThickness: 8
    }).setAlpha(0);
    text.x -= text.width / 2;
    return text;
  }
}
export class GameClear_Scene extends OnlySelectScene {
  constructor() {
    super('GameClear_Scene');
    this.MESSAGE = "CONGRATULATIONS!"
    this.TITLE_BUTTON = "TITLE";
  }
  init(data) {
    this.playerdata = data.playerdata;
    this.currentStage = data.currentStage;
    this.inputActive = false;
  }
  async create() {
    await super.create('gameclear', this.TITLE_BUTTON);
  }
  async fadein() {
    this.game.bgm = this.sound.add('theme_3');
    this.game.bgmID = 'theme_3';
    await super.fadein(this.createGameClearMessage());
  }
  async pointerDownHandler(pointer, gameObjects) {
    const isSuccessed = await super.pointerDownHandler(pointer, gameObjects);
    if (!isSuccessed) return;
    this.scene.start('Title_Scene');
  }
  createGameClearMessage() {
    const text = this.add.text(448, 84, this.MESSAGE, {
      fontSize: 84,
      fontFamily: "Pixelify Sans",
      color: "#FFF",
      stroke: '#000',
      strokeThickness: 8
    }).setAlpha(0);
    text.x -= text.width / 2;
    return text;
  }
}