
export class Card {
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
}