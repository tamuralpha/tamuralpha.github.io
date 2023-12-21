import * as Util from '../util.js'
import { DEPTH, MOVE_SPEED } from '../constants.js';
// 足場管理のためのクラス
// 基本的に同時に画面にあるのは６つのみ
// さらに足場を追加するときは、古い足場の破棄を行ってから追加する
export class ScaffoldHolder {
  constructor(scene, defaultTexture, goalIndex) {
    this.defaultTexture = defaultTexture;
    this.scene = scene;
    this.goalIndex = goalIndex;
    this.createCount = 0;

    this.table = [];

    for (let i = 0; i < 3; i++) {
      this.table.push(this.scene.add.group());
    }
  }
  initialize() {
    this.create(6);
  }
  // 縦一列に足場をrepeat回生成
  create(repeat) {
    const isFirstCreate = this.getLength() === 0;
    const beforeLoopLength = isFirstCreate ? 0 : this.getLength() - repeat;

    for (let i = 0; i < repeat; i++) {
      this.addColumn(beforeLoopLength + i);
      this.createCount++;
    }
  }
  // 指定した縦一列に足場を生成
  addColumn(x, texture = this.defaultTexture) {
    for (let i = 0; i < this.table.length; i++) {
      const sprite = this.createSprite(x, i, texture);

      if (this.createCount === this.goalIndex) {
        sprite.setTint(0xFF8080);
      }
    }
  }
  clear() {
    this.table.forEach(tableRow => {
      tableRow.destroy(true, true);
    })
  }
  getLength() {
    return this.table[0].getChildren().length;
  }
  // 現存の足場を、新たに作る足場を含めた適正位置へ移動
  // 余剰な足場に落下アニメーションのあと、実際にデータを削除
  async adjustExistedScaffoldBeforeCreate(repeat) {
    await Promise.all(this.adjustPositions(repeat));
  }
  // 各足場を正しい位置に移動させます
  // 結果となるアニメーションのawait可能な配列が返ります
  adjustPositions(makeAmount) {
    const scaffoldsLength = this.table[0].getLength();
    const tweens = [];

    for (let i = 0; i < this.table.length; i++) {
      const group = this.table[i];
      const totalChildren = group.getChildren().length + makeAmount;

      // オブジェクトが6つを超えている場合のみ処理を実行
      if (totalChildren > scaffoldsLength) {
        const shouldMoveLength = totalChildren - scaffoldsLength;

        // 新しいオブジェクトが6番目の位置に収まるようにする
        group.getChildren().forEach((child, index) => {
          const tweenParameter = {
            x: Util.calcPosition(index - shouldMoveLength, i).x,
            targets: child,
            duration: MOVE_SPEED * shouldMoveLength,
            ease: 'Power2',
          };

          tweens.push(Util.waitForTween(this.scene, tweenParameter));
        });
      }
    }
    return tweens;
  }
  // 余剰足場の処理、主に次の足場生成時、現在の足場をその数分破棄するために使う
  dropoutSurplus(repeat) {
    const tweens = [];

    for (let yIndex = 0; yIndex < this.table.length; yIndex++) {
      const group = this.table[yIndex];

      group.children.iterate((child, index) => {
        if (index <= repeat - 1) {
          tweens.push(this.dropout(child));
        }
      });
    }

    return tweens;
  }
  removeSurplusScaffolds(repeat) {
    for (let yIndex = 0; yIndex < this.table.length; yIndex++) {
      const group = this.table[yIndex];
      const childrenToRemove = group.getChildren().slice(0, repeat);

      childrenToRemove.forEach(child => {
        group.remove(child, true, true); // オブジェクトをグループから削除し、シーンからも削除する
      });
    }
  }
  createSprite(x, y, texture) {
    const position = Util.calcPosition(x, y);
    return this.table[y].create(position.x, position.y, texture).setDepth(DEPTH.SCAFFOLD).setAlpha(0);
  }
  // 領域外の足場をフェードアウト（実体は残る） / 作成された足場を視覚効果を掛けて表示
  async dropAndPop(repeat) {
    const createdAmount = this.getLength() - repeat;
    const popTweens = this.triggerPopAnimations(createdAmount, repeat)

    // 初回作成時は削除対象が無いので処理を行わない
    if (createdAmount === 0) {
      await Promise.all(popTweens);
    }
    else {
      const tweens = popTweens.concat(this.dropoutSurplus(repeat));
      await Promise.all(tweens);
      this.removeSurplusScaffolds(repeat);
    }
  }
  triggerPopAnimations(createdAmount, repeat) {
    const tweens = [];

    for (let i = 0; i < this.table.length; i++) {
      for (let j = createdAmount; j < this.getLength(); j++) {
        const target = this.table[i].getChildren()[j];
        tweens.push(this.popAnimation(target, this.getLength() - createdAmount));
      }
    }

    return tweens;
  }
  async popAnimation(target, createdAmount) {
    createdAmount = createdAmount === this.getLength() ? 2 : createdAmount;

    const tweenParameter = {
      targets: target,
      alpha: { from: 0, to: 1 },
      y: { from: target.y + 30, to: target.y },
      duration: MOVE_SPEED * createdAmount, // 不要となった足場の左スライドと同時に行われるため、それと同じ時間になるようにする
      ease: 'Power2'
    };

    return Util.waitForTween(this.scene, tweenParameter);
  }
  // 引数に「対象Scaffold, xIndex, yIndex」を持つメソッドを全てのScaffoldに実行します
  applyToAllGroups(action, option) {
    const results = [];

    for (let yIndex = 0; yIndex < this.table.length; yIndex++) {
      const group = this.table[yIndex];
      results.push(action(group, option));
    }

    return results;
  }
  // 引数に「対象Scaffold, xIndex, yIndex」を持つメソッドを全てのScaffoldに実行します
  applyToAllScaffolds(action, option) {
    const results = [];

    for (let yIndex = 0; yIndex < this.table.length; yIndex++) {
      for (let xIndex = 0; xIndex < this.table[yIndex].length; xIndex++) {
        const scaffold = this.table[yIndex].getChildren()[xIndex];
        results.push(action(scaffold, option));
      };
    }

    return results;
  }
  async dropout(target) {
    const tween = this.scene.tweens.add({
      targets: target,
      alpha: { from: 1, to: 0 },
      y: { from: target.y, to: target.y + 30 },
      duration: MOVE_SPEED * 2,
      ease: 'Power2'
    });

    return new Promise(resolve => {
      tween.on('complete', () => {
        resolve();
      });
    });
  }
}