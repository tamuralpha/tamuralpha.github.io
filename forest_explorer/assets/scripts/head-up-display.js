export class HeadUpDisplay {
  constructor(scene, playerdata, stagedata) {
    this.scene = scene;
    this.playerdata = playerdata;
    this.stagedata = stagedata;
  }
  create() {
    const heart = this.scene.add.image(120, 32, 'heart').setDepth(111);
    heart.setScale(0.75);
    this.deckIcon = this.scene.add.image(250, 32, 'deck').setDepth(111);
    this.deckIcon.setScale(0.75);
    const fire = this.scene.add.image(350, 19, 'fire').setDepth(111);
    fire.setScale(0.5);
    const ice = this.scene.add.image(350, 48, 'ice').setDepth(111);
    ice.setScale(0.5);
    const wind = this.scene.add.image(414, 19, 'wind').setDepth(111);
    wind.setScale(0.5);
    const etc = this.scene.add.image(414, 48, 'etc').setDepth(111);
    etc.setScale(0.5);
    const goal = this.scene.add.image(790, 34, 'goal').setDepth(111);
    goal.setScale(0.75);
    const rest = this.scene.add.image(701, 34, 'rest').setDepth(111);

    this.hpText = this.scene.add.text(139, 18, ":5/5", {
      fontSize: 24,
      fontFamily: "Pixelify Sans",
      color: "#FFF",
      stroke: '#000',
      strokeThickness: 4
    }).setDepth(111);
    this.deckLengthText = this.scene.add.text(272, 18, this.playerdata.deck.getLength(), {
      fontSize: 24,
      fontFamily: "Pixelify Sans",
      color: "#FFF",
      stroke: '#000',
      strokeThickness: 4
    }).setDepth(111);
    this.goaltext = this.scene.add.text(816, 17, this.stagedata.toGoalLength, {
      fontSize: 32,
      fontFamily: "Pixelify Sans",
      color: "#FFF",
      stroke: '#000',
      strokeThickness: 4
    }).setDepth(111);
    this.restText = this.scene.add.text(726, 17, this.stagedata.remainingRestCards, {
      fontSize: 32,
      fontFamily: "Pixelify Sans",
      color: "#FFF",
      stroke: '#000',
      strokeThickness: 4
    }).setDepth(111);

    const creatext = (x, y, text) => {
      return this.scene.add.text(x, y, text, {
        fontSize: 20,
        fontFamily: "Pixelify Sans",
        color: "#FFF",
        stroke: '#000',
        strokeThickness: 4
      }).setDepth(111);
    }

    const elementLengths = this.playerdata.deck.getElementLengths();

    this.fireCountText = creatext(366, 7, elementLengths.flameCount);
    this.iceCountText = creatext(366, 36, elementLengths.iceCount);
    this.windCountText = creatext(428, 7, elementLengths.windCount);
    this.otherCountText = creatext(428, 36, elementLengths.otherCount);

    const maskShape = this.scene.add.graphics().setDepth(110);
    maskShape.fillStyle(0x000);
    maskShape.fillRect(0, 0, 896, 64);
    maskShape.alpha = 0.25;

    this.deckIcon.name = "deckIcon";
    this.deckIcon.setInteractive();
  }
  refreshOnBattle() {
    const elementLengths = this.playerdata.deck.getElementLengthsNotDrawedAndNotUsed();

    this.hpText.setText(this.playerdata.heartPoint)
    this.deckLengthText.setText(this.playerdata.deck.getNotDrawedAndNotUsedLength());

    this.fireCountText.setText(elementLengths.flameCount);
    this.iceCountText.setText(elementLengths.iceCount);
    this.windCountText.setText(elementLengths.windCount);
    this.otherCountText.setText(elementLengths.otherCount);
  }
  refreshOnMap() {
    const elementLengths = this.playerdata.deck.getElementLengthsNotUsed();

    this.hpText.setText(this.playerdata.heartPoint)
    this.deckLengthText.setText(this.playerdata.deck.getNotUsedLength());

    this.fireCountText.setText(elementLengths.flameCount);
    this.iceCountText.setText(elementLengths.iceCount);
    this.windCountText.setText(elementLengths.windCount);
    this.otherCountText.setText(elementLengths.otherCount);

    this.goaltext.setText(this.stagedata.toGoalLength);
    this.restText.setText(this.stagedata.remainingRestCards);
  }
  redrawCounts(tempDeck) {
    const elementLengths = tempDeck.getElementLengthsNotUsed();

    this.deckLengthText.setText(tempDeck.cards.length);

    this.fireCountText.setText(elementLengths.flameCount);
    this.iceCountText.setText(elementLengths.iceCount);
    this.windCountText.setText(elementLengths.windCount);
    this.otherCountText.setText(elementLengths.otherCount);
  }
}