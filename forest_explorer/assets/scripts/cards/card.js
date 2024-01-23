// 画面上に表示されるカードを実態となるGameObjectともども扱うクラス
// カードは複数のGameObjectで構成され、ImageLayerクラスで管理している
export class CardObject {
  constructor(imageLayer, id, data) {
    this.imageLayer = imageLayer;
    this.name = imageLayer.getName;
    this.id = id;
    this.data = data; // ディープコピー
  }
  // 判定要件は増えれば変える
  isRightMove() {
    return this.data.effects.effect.includes("right_move");
  }
  isVerticalMove() {
    return this.data.effects.effect.includes("down_move") || this.data.effects.effect.includes("up_move");
  }
  checkIsInteractive() {
    return this.imageLayer.checkIsInteractive();
  }
  setName(name) {
    this.imageLayer.setName(name);
  }
  getFrame() {
    return this.imageLayer.getFrame();
  }
  setInteractive() {
    this.imageLayer.setInteractive();
  }
  removeInteractive() {
    this.imageLayer.removeInteractive();
  }
}