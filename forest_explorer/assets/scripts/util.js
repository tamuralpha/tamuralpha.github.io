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
    duration: 500,  // アニメーションの期間（ミリ秒）
    ease: 'Power3'  // イージング関数
  };

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
    duration: 500,  // アニメーションの期間（ミリ秒）
    ease: 'Power3'  // イージング関数
  };

  await waitForTween(scene, tweenParameter);
  return overlay;
}
export async function waitForParticles(scene, particle, option = null) {
  const particleImage = option ? option.particle : 'particle';
  const explode = option ? option.explode : true;
  console.log(explode);

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