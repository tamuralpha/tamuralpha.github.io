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

    await this.fadein();

    this.input.on('pointerdown', async (pointer, gameObject) => {
      await this.pointerDownHandler(pointer, gameObject);
    });
    this.inputActive = true;
  }
  async fadein(addTargets) {
    addTargets = Array.isArray(addTargets) ? addTargets : [addTargets];
    const fadeinTargets = [this.background].concat(this.buttons).concat(addTargets);
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
  async pointerDownHandler(pointer, gameObjects) {
    if (!this.inputActive || gameObjects.length === 0 || !gameObjects[0].name) { return false; }
    this.inputActive = false;

    await this.buttonClickReaction(gameObjects);
    await Util.fadeoutOverlay(this);
    return true;
  }
  async buttonClickReaction(gameObjects) {
    const index = this.buttons.findIndex(gameObject => gameObject === gameObjects[0]) + 1; // buttonは生成時、その上に表示されるtextも1つ後ろに格納される
    const targets = [gameObjects[0], this.buttons[index]];

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

    const space = 64; // 複数のテキストがある場合、その間のスペース
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
  }
  preload() {
    this.load.image('board', 'assets/icons/board.webp');
    this.load.image('title', 'assets/illust/title.webp');
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
    await super.fadein(this.createTitleMessage());
  }
  async pointerDownHandler(pointer, gameObjects) {
    const isSuccessed = await super.pointerDownHandler(pointer, gameObjects);
    if (!isSuccessed) return;
    this.scene.start("Game_Scene", {});
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
    await super.fadein(this.createGameOverMessage());
  }
  async pointerDownHandler(pointer, gameObjects) {
    const isSuccessed = await super.pointerDownHandler(pointer, gameObjects);
    if (!isSuccessed) return;
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