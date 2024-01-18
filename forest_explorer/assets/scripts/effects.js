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
  quakePower = damage <= 0 ? 0 : quakePower;

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

  console.log(damage);
  if (damage !== 0) scene.sound.play(damage_se);

  await Promise.all([dTween, fTween, sTween]);
  damageText.destroy();
  target.setTint(0xFFFFFF);
}
export async function flashCharacter(scene, target) {
  const flashImage = scene.add.image(target.x, target.y, target.texture.key);
  flashImage.setTintFill(0xFFFFFF);
  flashImage.scaleX = target.scaleX;
  flashImage.setAlpha(0);
  flashImage.setDepth(target.depth + 1);
  console.log(flashImage);

  const flashParameter = {
    targets: flashImage,
    alpha: { from: 0, to: 1 },
    ease: 'Linear',
    duration: 250,
    yoyo: true
  };

  await Util.waitForTween(scene, flashParameter);
  flashImage.destroy();
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
export function createAnalyzeEffect(scene, target, tint) {
  scene.add.particles(0, 0, 'particle_p', {
    emitZone: {
      type: 'edge',
      source: new Phaser.Geom.Ellipse(target.x, target.y, target.width + 25, target.height + 25),
      quantity: 64,
      total: 1
    },
    scale: { start: 0.3, end: 0.1 },
    blendMode: 'ADD',
    lifespan: 600,
    quantity: 1,
    alpha: { start: 1, end: 0.5 },
    frequency: 30,
    tint: tint
  }).setDepth(DEPTH.UI_PLUS);
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
export async function playChargeEffect(scene, target) {
  const tweens = [];
  const colors = [0xFFB6C1, 0xADD8E6, 0x90EE90];

  tweens.push(Util.waitForParticles(scene, {
    emitZone: { type: 'edge', source: new Phaser.Geom.Circle(target.x, target.y, 120), quantity: 36 },
    duration: 500,
    lifespan: 500,
    scale: { start: 0.8, end: 0.25, ease: 'sine.out' },
    moveToX: target.x,
    moveToY: target.y,
    moveTo: true,
    frequency: 125,
    quantity: 36,
    tint: colors,
    emitCallback: (particle) => {
      particle.x += Phaser.Math.Between(-3, 3);
      particle.y += Phaser.Math.Between(-3, 3);
    },
  },
    {
      particle: 'particle',
      explode: false,
    }));
  tweens.push(Util.waitForParticles(scene, {
    emitZone: { source: new Phaser.Geom.Circle(target.x, target.y, 5), quantity: 5 },
    duration: 500,
    lifespan: 500,
    scale: { start: 0, end: 0.6, ease: 'sine.out' },
    alpha: { start: 0.2, end: 0.5, ease: 'sine.out' },
    frequency: 125,
    quantity: 15,
    tint: colors,
  },
    {
      particle: 'particle',
      explode: false,
    }));
  await Promise.all(tweens);
}
export async function playSleepEffect(scene, target) {
  await Util.waitForParticles(scene, {
    emitZone: { source: new Phaser.Geom.Circle(target.x, target.y, 80), quantity: 150 },
    color: [0xEEF8F5, 0xD9F3FA],
    colorEase: 'quad.out',
    duration: 1000,
    lifespan: 1000,
    scale: { start: 1, end: 1.2, ease: 'sine.out' },
    alpha: { start: 0.5, end: 0, ease: 'sine.out' },
    speed: { min: -20, max: 20 },
    quantity: 120,
    blendMode: 'ADD',
  },
    {
      particle: 'particle_fog',
      explode: true,
    });
}
export async function playCurseEffect(scene, target) {
  const tweens = [];
  tweens.push(Util.waitForParticles(scene, {
    emitZone: { source: new Phaser.Geom.Circle(target.x, target.y + target.height / 2 - 15, 30), quantity: 150 },
    color: [0x4B0082, 0x006400, 0x8B0000, 0x00008B],
    colorEase: 'quad.out',
    duration: 500,
    lifespan: 500,
    scale: { start: 0, end: 1, ease: 'sine.out' },
    alpha: { start: 1, end: 0, ease: 'sine.out' },
    speed: { min: -20, max: 20 },
    accelerationX: { min: -500, max: 500 },
    accelerationY: { min: -100, max: -300 },
    quantity: 150,
    frequency: 60,
    blendMode: 'NORMAL',
    emitCallback: (particle) => {
      particle.angle = Phaser.Math.Between(0, 360);
    },
  },
    {
      particle: 'particle_fog',
      explode: false,
    }));
  tweens.push(Util.waitForParticles(scene, {
    emitZone: { source: new Phaser.Geom.Circle(target.x, target.y, 80), quantity: 150 },
    color: [0x4B0082, 0x006400, 0x8B0000, 0x00008B],
    colorEase: 'quad.out',
    duration: 500,
    lifespan: 250,
    scale: { start: 0.5, end: 1, ease: 'sine.out' },
    alpha: { start: 1, end: 0, ease: 'sine.out' },
    accelerationX: { min: -60, max: 50 },
    accelerationY: { min: -60, max: -90 },
    speed: { min: -20, max: 20 },
    quantity: 16,
    frequency: 170,
    blendMode: 'NORMAL',
    emitCallback: (particle) => {
      // particle.angle = Phaser.Math.Between(0, 360);
    },
  },
    {
      particle: 'particle_nazo_no_moji',
      explode: false,
    }));
  await Promise.all(tweens);
}
export async function handleSpecialAttackEffect(scene, effects) {
  const effectFunctions = {
    'heal': handleHealEffect,
    'analyze': handleAnalyzeEffect,
    'charge': handleChargeEffect,
    'dual': handleDualEffect,
    'curse': handleCurseEffect,
    'sleep': handleSleepEffect
  };

  if (effectFunctions[effects.effect]) {
    return await effectFunctions[effects.effect](scene, effects);
  }
}
async function handleHealEffect(scene, effects) {
  scene.sound.play('heal_magic');
  await playHealEffect(scene, scene.playersImage);
  await showDamageEffect(scene, scene.playersImage, effects.value * -1, false);

}
async function handleAnalyzeEffect(scene, effects) {
  scene.sound.play('analyze');
  await playAnalyzeEffect(scene, scene.enemysImage, `enemy_${scene.enemydata.id}`);
  scene.showAnalyzeParticle(scene.enemysImage, scene.enemydata);
}
async function handleChargeEffect(scene, effects) {
  scene.sound.play('charge');
  await playChargeEffect(scene, scene.playersImage);
  await showDamageEffect(scene, scene.playersImage, effects.value * -1, false);
}
async function handleDualEffect(scene, effects) {
  scene.sound.play('dual');
  await flashCharacter(scene, scene.playersImage);
}
async function handleCurseEffect(scene, effects) {
  scene.sound.play('curse');
  await playCurseEffect(scene, scene.enemysImage);
}
async function handleSleepEffect(scene, effects) {
  scene.sound.play('sleep');
  await playSleepEffect(scene, scene.enemysImage);
}