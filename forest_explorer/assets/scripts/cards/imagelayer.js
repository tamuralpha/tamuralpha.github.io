import { DEPTH } from '../constants.js';
import * as Util from '../util.js'

// カード画像用
// カード表示のため、主にフレーム、画像、テキスト、マスクをひとまとめに扱うためのクラス
// PhaserにはContainerもあるが、マスクが使えなかったり不便なので独立
// 少し粗が多いかもしれない、主にitemsの順序についてセット時に確認を取らない辺り
export class ImageLayer {
  constructor() {
    this.items = [];
    this.offset = [];
    this.defaultDepths = [DEPTH.CARD_FRAME, DEPTH.CARD_ILLUST, DEPTH.CARD_TEXT];
  }
  addItems(items, isSetDefaultDepth = true) {
    items.forEach(item => {
      if (item === null || item === undefined) return;
      this.items.push(item);
    })

    if (!isSetDefaultDepth) return;
    this.reset_emphasis(); // デフォルトのDepthを設定
  }
  getFrame() {
    return this.items[0];
  }
  getIllust() {
    return this.items[1];
  }
  getText() {
    return this.items[2];
  }
  getName() {
    return this.getFrame().name;
  }
  saveInitialPositions() {
    this.memorized_positions = [];

    for (let item of this.items) {
      this.memorized_positions.push({ x: item.x, y: item.y });
    }
  }
  resetToInitialPositions() {
    if (!this.memorized_positions) { return; }

    for (let index = 0; index < this.memorized_positions.length; index++) {
      this.items[index].x = this.memorized_positions[index].x;
      this.items[index].y = this.memorized_positions[index].y;
    }
  }
  emphasis() {
    const emphasisDepth = [DEPTH.DRAG_CARD_FRAME, DEPTH.DRAG_CARD_ILLUST, DEPTH.DRAG_CARD_TEXT];
    for (let index = 0; index < this.items.length; index++) {
      const element = this.items[index];

      // 拡張用、現状表示優先度は３つ
      if (index < emphasisDepth.length) {
        element.setDepth(emphasisDepth[index]);
      }
    }
  }
  reset_emphasis() {
    for (let index = 0; index < this.items.length; index++) {
      const element = this.items[index];

      if (index < this.defaultDepths.length) {
        element.setDepth(this.defaultDepths[this.defaultDepths.length - 1]);
      }
    }
  }
  move(x, y) {
    for (let element of this.items) {
      if (element.x !== undefined && element.y !== undefined) {
        element.x += x;
        element.y += y;
      }
    }
  }
  slideIn(scene, offsetX, offsetY, duration, delay) {
    const tweens = [];

    for (let element of this.items) {
      if (element.x !== undefined && element.y !== undefined) {
        // 元の位置を保存
        const originalX = element.x;
        const originalY = element.y;

        // アニメーションの開始位置を設定
        element.x += offsetX;
        element.y += offsetY;

        // スライドインアニメーションを作成
        const tween = {
          targets: element,
          x: originalX,
          y: originalY,
          ease: 'Power2',  // または任意のイージング関数
          duration: duration,  // アニメーションの持続時間（ミリ秒）
          delay: delay,
        };

        tweens.push(Util.waitForTween(scene, tween));
      }
    }
    return tweens;
  }
  // 基本的にmove（単純なx, yの移動）での利用を想定
  // 他のレイヤもそれぞれの位置を保ちつつ移動させます
  applyTween(scene, tweenParameter) {
    const tweens = [];

    for (let item of this.items) {
      if (item.x === undefined || item.y === undefined) {
        continue;
      }

      const iTweenParameter = JSON.parse(JSON.stringify(tweenParameter));
      iTweenParameter.targets = item;
      iTweenParameter.x += item.x - this.getFrame().x;
      iTweenParameter.y += item.y - this.getFrame().y;
      tweens.push(Util.waitForTween(scene, iTweenParameter))
    }
    return tweens;
  }
  fadeout(scene) {
    const tweens = [];

    for (let element of this.items) {
      // スライドインアニメーションを作成
      const tween = {
        targets: element,
        alpha: 0,
        ease: 'Power2',  // または任意のイージング関数
        duration: 300,  // アニメーションの持続時間（ミリ秒）
      }
      tweens.push(Util.waitForTween(scene, tween));
    };
    return tweens;
  }
  destroyMyself() {
    // 要素を検索し、削除
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i].destroy(); // ゲームオブジェクトを破棄
    }
  }
}