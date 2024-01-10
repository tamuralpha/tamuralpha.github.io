import * as Util from './util.js'
import { DEPTH, EFFECT_ELEMENT } from './constants.js';

// 再生タイミングや他の演出との兼ね合いがあるため、効果音があるかはまちまち
export async function showDamageEffect(scene, target, damage, isWeak) {
  const x = target.x + target.width / 2 - 25;
  const y = target.y - target.height / 2 - 15
  const color = getDamageEffectColor(damage, isWeak);
  const isBigDamage = damage < 10;

  // ダメージテキストを表示し、少しポップする演出
  const damageText = scene.add.text(x, y, Math.abs(damage), {
    fontSize: 36,
    fontFamily: "Pixelify Sans",
    color: color,
    stroke: '#000',
    strokeThickness: 4
  }).setDepth(DEPTH.UI_PLUS);

  const damageTweenParameter = {
    targets: damageText,
    y: damageText.y - 15,
    scale: { from: 1, to: 1.1 },
    yoyo: true,
    ease: 'Cubic.easeOut',
    duration: 250,
  };

  // ターゲットが赤くなり、点滅する演出（ダメージ０以下の場合は点滅のみ）
  if (damage >= 0) target.setTint(0xFF0000);

  const flashParameter = {
    targets: target,
    alpha: { from: 1, to: 0.5 },
    ease: 'Linear',
    duration: 50,
    yoyo: true,
    repeat: 1
  };

  // ターゲットが振動する演出
  let quakePower = isBigDamage ? 10 : 20;
  quakePower = damage < 0 ? 0 : quakePower;

  const randomQuakeValue = {
    x: Phaser.Math.Between(-quakePower, quakePower) / 10,
    y: Phaser.Math.Between(-quakePower, quakePower) / 10
  }

  const quakeParamerter = {
    targets: target,
    x: { from: target.x - randomQuakeValue.x, to: target.x + randomQuakeValue.x },
    y: { from: target.y - randomQuakeValue.y, to: target.y + randomQuakeValue.y },
    duration: 50,
    yoyo: true,
    repeat: 1
  };

  const dTween = Util.waitForTween(scene, damageTweenParameter);
  const fTween = damage < 0 ? null : Util.waitForTween(scene, flashParameter);
  const sTween = damage < 0 ? null : Util.waitForTween(scene, quakeParamerter);

  // 上記を同時に実行し、まとめて待機
  let damage_se = isBigDamage ? 'damage' : 'damage_big';
  damage_se = damage < 0 ? 'heal' : damage_se;
  scene.sound.play(damage_se);

  await Promise.all([dTween, fTween, sTween]);
  damageText.destroy();
  target.setTint(0xFFFFFF);
}
// ①弱点属性である：赤、②ダメージがマイナスである：緑、③その他：白
function getDamageEffectColor(damage, isWeak) {
  let color = isWeak ? '#FF0000' : '#FFFFFF';
  color = damage < 0 ? '#00FF00' : color;

  return color;
}
export async function enemysAttack(scene, target) {
  const shape = new Phaser.Geom.Line(
    target.x - 100, target.y - 100,
    target.x + 100, target.y + 100);

  scene.sound.play('enemy_attack');

  await Util.waitForParticles(scene, {
    emitZone: { type: 'edge', source: shape, quantity: 64, total: 1 },
    duration: 250 / 1.5,
    lifespan: 250 / 1.5,
    scale: { start: 0.4, end: 0 },
    alpha: { start: 1, end: 0 },
    quantity: 6,
    blendMode: 'ADD',
  },
    {
      particle: 'particle_p',
      explode: false,
    })
}
export async function defeatImage(scene, target) {
  target.setTint(0xff0000);

  const tweenParameter = {
    targets: target,
    alpha: { from: 1, to: 0 },
    ease: 'Power2',
    duration: 300,
    delay: 100,
  };

  scene.sound.play('vanish');
  await Util.waitForTween(scene, tweenParameter);
}
export function getAttackTweens(scene, effects, target) {
  const element = effects.effect_element;
  const rank = effects.rank;

  const duration = 500;

  const x = target.x;
  const y = target.y;

  const tweens = [];

  switch (element) {
    case EFFECT_ELEMENT.FIRE:
      scene.sound.play('fire_magic');

      tweens.push(Util.waitForParticles(scene,
        {
          emitZone: { source: new Phaser.Geom.Circle(x, y, 25 + 10 * rank), quantity: 150 },
          color: [0xfacc22, 0xf89800, 0xf83600, 0x9f0404],
          colorEase: 'quad.out',
          duration: duration,
          lifespan: duration,
          scale: { start: 0.70 * rank, end: 0, ease: 'sine.out' },
          accelerationY: { min: -150, max: -350 },
          speed: { min: 30 * rank, max: 60 * rank },
          blendMode: 'ADD',
          quantity: 350 * rank,
        }));
      break;
    case EFFECT_ELEMENT.ICE:
      Util.playSoundWithDuration(scene, 'ice_magic', { volume: 1, duration: 1 });

      tweens.push(
        Util.waitForParticles(scene, {
          emitZone: { source: new Phaser.Geom.Circle(x, y, 150), quantity: 32 },
          duration: duration,
          lifespan: duration,
          speed: { min: 10, max: 20 },
          scale: { start: 0.05, end: 0 },
          quantity: 1000,
          blendMode: 'ADD',
        }));
      tweens.push(
        Util.waitForParticles(scene, {
          emitZone: { source: new Phaser.Geom.Circle(x, y, 150), quantity: 6 },
          duration: duration,
          lifespan: duration,
          alpha: { start: 1, end: 0 },
          scale: { start: 0.5, end: 0.8 },
          quantity: 6 * rank,
          frequency: 100,
          blendMode: 'ADD',
          emitCallback: (particle) => {
            particle.angle = Phaser.Math.Between(0, 360);
          },
        },
          { particle: 'effect_ice' }))
      break;
    case EFFECT_ELEMENT.WIND:
      Util.playSoundWithDuration(scene, 'spark_magic', { volume: 0.8, duration: 0.8 });

      tweens.push(
        Util.waitForParticles(scene,
          {
            emitZone: { source: new Phaser.Geom.Circle(x, y, 90 + 15 * rank), quantity: 32 },
            frame: { frames: [0, 1, 2, 3], cycle: true },
            duration: duration,
            lifespan: duration,
            scale: { start: 0.55 + 0.10 * rank, end: 0 },
            alpha: { start: 1, end: 0 },
            blendMode: 'ADD',
            quantity: 3 * rank,
            frequency: 100 - 20 * rank,
            emitCallback: (particle) => {
              particle.angle = Phaser.Math.Between(0, 360);
            },
          },
          {
            particle: 'effect_spark_sheet',
            explode: false,
          }));
      break;
  } // switch終了

  return tweens;
}
export async function playAnalyzeEffect(scene, target, targetID) {
  await Util.waitForParticles(scene, {
    x: target.x,
    y: target.y,
    duration: 500,
    lifespan: 500,
    scale: { start: 0, end: 2, ease: 'POWER2' },
    alpha: { start: 1, end: 0, ease: 'POWER2' },
    quantity: 1,
    frequency: 120,
    blendMode: 'ADD'
  },
    {
      particle: targetID,
      explode: false,
    });
}
export async function playHealEffect(scene, target) {
  await Util.waitForParticles(scene, {
    emitZone: { source: new Phaser.Geom.Circle(target.x, target.y + target.height / 2 - 15, 30), quantity: 150 },
    color: [0xFFFB8B, 0xFFE49E, 0xEDC13A],
    colorEase: 'quad.out',
    duration: 500,
    lifespan: 500,
    scale: { start: 0, end: 1, ease: 'sine.out' },
    alpha: { start: 1, end: 0, ease: 'sine.out' },
    speed: { min: -90, max: 90 },
    accelerationY: { min: -600, max: -900 },
    quantity: 50,
    frequency: 60,
    blendMode: 'ADD',
    emitCallback: (particle) => {
      particle.angle = Phaser.Math.Between(0, 360);
    },
  },
    {
      particle: 'particle_p',
      explode: false,
    });
}