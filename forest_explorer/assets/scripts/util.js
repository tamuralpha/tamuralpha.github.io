import { ImageLayer } from "./cards/imagelayer.js";
import { CardObject } from "./cards/card.js";

// 偏向するランダムな整数を求める、paramの値が高ければ高いほど整数は大きくなりやすい
export function biasedRandomInt(minVal, maxVal, param) {
  let range = maxVal - minVal + 1;
  let baseRandom = Phaser.Math.Between(0, range - 1);
  let bias = (param - 1) / 19 * range; // paramを範囲に応じてスケーリング
  let biasedRandom = baseRandom + bias - range / 2; // 偏りを中央に寄せる
  return Phaser.Math.Clamp(Math.round(minVal + biasedRandom), minVal, maxVal);
}
export function craeteCard(scene, position, name, carddata, scale, showRandomValue = true, isBattle = false) {
  const card_id = carddata.id;
  const card_string = isBattle ? `card_battle_${card_id}` : `card_${card_id}`;
  const imageLayer = new ImageLayer();
  const card = new CardObject(imageLayer, card_id, carddata);

  const cardValue = showRandomValue ? card.data.effects.rnd_value : card.data.effects.value;
  const isValuableCard = cardValue !== null && cardValue !== undefined;
  const frame_type = isValuableCard ? 'frame' : 'n_frame';

  const image = scene.add.image(position.x, position.y, card_string);
  const frame = scene.add.image(position.x, position.y, frame_type);
  const maskShape = scene.make.graphics();
  let value;

  if (isValuableCard) {
    const textOffset = { x: ((140 * scale) - 20), y: 190 * scale };
    value = scene.add.text(position.x - textOffset.x, position.y - textOffset.y, cardValue, {
      fontSize: 42 * scale,
      fontFamily: "Pixelify Sans",
      color: "#FFF",
      stroke: '#000',  // 縁取りの色
      strokeThickness: 8 * scale  // 縁取りの太さ
    });
  }

  // 加工処理
  maskShape.fillStyle(0x000);
  maskShape.fillRect(position.x - 116 * scale, position.y - 180 * scale, 232 * scale, 360 * scale); // テクスチャサイズに基づく加工のため、変更余地あり？

  image.setScale(scale)
  frame.setScale(scale * 2)
  image.setMask(maskShape.createGeometryMask());

  imageLayer.addItems([frame, image, value, maskShape]);
  imageLayer.saveInitialPositions();

  card.setInteractive();
  card.setName(name);
  return card;
}

// EdgeZoneの範囲からランダムポイントを生成するためだけのクラス
export class RandomEdgeZone extends Phaser.GameObjects.Particles.Zones.RandomZone {
  constructor(scene, x, y, width, height, innerWidth, innerHeight) {
    super({ getRandomPoint: (point) => this.getRandomPoint(point) });

    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.centerX = width / 2;
    this.centerY = height / 2;
    this.innerWidth = innerWidth;
    this.innerHeight = innerHeight;
  }

  getRandomPoint(point) {
    // 矩形の外側のエリアにランダムな点を生成するロジック
    do {
      point.x = Phaser.Math.Between(0, this.width);
      point.y = Phaser.Math.Between(0, this.height);
    } while (
      point.x > this.centerX - this.innerWidth / 2 &&
      point.x < this.centerX + this.innerWidth / 2 &&
      point.y > this.centerY - this.innerHeight / 2 &&
      point.y < this.centerY + this.innerHeight / 2
    );
    point.x += this.x;
    point.y += this.y;

    return point;
  }
}
// utils.js
export function waitForTween(scene, options) {
  return new Promise(resolve => {
    scene.tweens.add({
      ...options,
      onComplete: resolve
    });
  });
}
export function getStageBackgroundIndex(stageID) {
  let index = 0;
  if (stageID > 4) { index = 3 }
  else if (stageID > 2) { index = 2; }
  else if (stageID > 1) { index = 1; }
  return index;
}
// x、y（マス目上の位置）を元に位置（画面上のピクセルの位置）を返す
export function calcPosition(x, y) {
  const offsetX = (y - 1) * 24;
  return {
    x: 138 + (x * 116) + offsetX,
    y: 212 + (y * 46)
  }
}
// export function calcCardPosition (index) {
//   return { x:100 + 134 * index, y: 345}
// }
export function calcHandCardPositon(index) {
  const x = 150 + 134 * index;
  const y = 440;
  return { x: x, y: y };
}
export function prepareFadeinOverlay(scene) {
  const overlay = scene.add.graphics().setDepth(999);
  overlay.fillStyle(0x000);
  overlay.fillRect(0, 0, 896, 512);
  return overlay;
}
export async function fadeinOverlay(scene, overlay) {
  const tweenParameter = {
    targets: overlay,
    alpha: 1,
    x: 896,
    delay: 250,
    duration: 350,  // アニメーションの期間（ミリ秒）
    ease: 'Power3'  // イージング関数
  };

  scene.sound.play('scene_change');
  await waitForTween(scene, tweenParameter);
}
export async function fadeoutOverlay(scene) {
  const overlay = scene.add.graphics().setDepth(999);
  overlay.fillStyle(0x000);
  overlay.fillRect(0, 0, 896, 512);
  overlay.x = -896;

  const tweenParameter = {
    targets: overlay,
    alpha: 1,
    x: 0,
    duration: 350,  // アニメーションの期間（ミリ秒）
    ease: 'Power3'  // イージング関数
  };

  scene.sound.play('scene_change');
  await waitForTween(scene, tweenParameter);
  return overlay;
}
export async function waitForParticles(scene, particle, option = null) {
  const particleImage = option ? option.particle : 'particle';
  const explode = option ? option.explode : true;

  return new Promise(resolve => {
    const analyzeEffectParticle = scene.add.particles(0, 0, particleImage, particle).setDepth(1000);
    if (explode) analyzeEffectParticle.explode();

    // 少し複雑だが、生成を停止→一定時間後にオブジェクトを削除の流れ
    scene.time.delayedCall(particle.duration, () => {
      analyzeEffectParticle.stop();

      scene.time.delayedCall(particle.duration, () => {
        analyzeEffectParticle.destroy();
      });

      resolve();
    });
  });
}
export function playSoundWithDuration(scene, soundKey, options) {
  // サウンドを再生する
  const sound = scene.sound.add(soundKey, options);
  sound.play();

  // 'duration'オプションがあれば、その期間後にサウンドを停止する
  if (options && options.duration) {
    scene.time.delayedCall(options.duration * 1000, function () {
      sound.stop();
    }, [], scene);
  }

  return sound;
}
// export function createObservableVariable (variableName) {
//   return new ObservableVariable (variableName);
// }
export class ObservableVariable {
  constructor(variableName) {
    this.variableName = variableName;
  }

  triggerChange(newValue) {
    document.dispatchEvent(new CustomEvent(this.variableName, { detail: newValue }));
  }

  waitForChange() {
    return new Promise((resolve) => {
      document.addEventListener(this.variableName, (e) => {
        resolve(e.detail);
      }, { once: true });
    });
  }
}