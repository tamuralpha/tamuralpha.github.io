import * as Util from './util.js'

export async function handleSpecialAttack(scene, effects) {
  const effectFunctions = {
    'heal': handleHeal,
    'analyze': handleAnalyze,
    'charge': handleCharge,
    'dual': handleDual,
    'curse': handleCurse,
    'sleep': handleSleep
  };

  if (effectFunctions[effects.effect]) {
    return await effectFunctions[effects.effect](scene, effects);
  }
  return false;
}

async function handleHeal(scene, effects) {
  scene.playerdata.effect(effects);
  return false;
}

async function handleAnalyze(scene, effects) {
  scene.enemydata.effect(effects);
  return false;
}

async function handleCharge(scene, effects) {
  // デッキの上から二枚を削除（つまりランダムドロー＊２、削除＊２）
  if (scene.playerdata.deck.getNotDrawedAndNotUsedIndexs().length < 2) {
    // 必要枚数なければ発動失敗
    scene.sound.play('denied');
    return true;
  }

  let power = 0;
  const cards = [];

  // ドローしたカードのデータからチャージするパワーを取得、カードの生成と出現演出
  for (let i = 0; i < 2; i++) {
    const drawedIndex = scene.playerdata.deck.draw();
    const drawedCarddata = scene.playerdata.deck.cards[drawedIndex];
    power += drawedCarddata.effects.value ? drawedCarddata.effects.value : 0;
    scene.playerdata.deck.use(drawedCarddata);

    scene.sound.play('pick_card');

    const position = { x: 438 + 180 * i, y: 256 }
    const card = Util.craeteCard(scene, position, 'name', drawedCarddata, 0.5, false, true);

    await Promise.all(card.imageLayer.slideIn(scene, 0, 512, 200, 70 * i));
    cards.push(card);
  }

  effects.value = power;
  await scene.playSpecialTweens(effects);

  // 出現したカードを消滅させる
  let tweens = [];
  tweens.push(cards[0].imageLayer.fadeout(scene));
  tweens = tweens.concat(cards[1].imageLayer.fadeout(scene));
  await Promise.all(tweens);

  // プレイヤーデータにパワーを＋
  scene.playerdata.effect(effects);
  return true;
}
// 補助魔法、このカード＋攻撃魔法＋他の補助魔法の最大3枚を同時に使用できる
async function handleDual(scene, effects) {
  await scene.playSpecialTweens(effects);

  // 他のカードが全てdualなら失敗
  const dualCards = scene.handCardHolder.cards.filter(card => card.data.effects.effect === 'dual');
  if (dualCards.length === scene.handCardHolder.cards.length) { scene.sound.play('denied'); return true;; }

  const usingCards = [];

  // 選択処理を関数にまとめる
  const selectCard = async (isFirstSelection, firstCardIsAttack) => {
    let selectedCard = null;
    let isSelected = false;

    while (!isSelected) {
      scene.isSpecialInputActive = true;
      selectedCard = await scene.specialInputVariable.waitForChange();
      const selectedCardEffect = selectedCard.data.effects.effect;
      scene.isSpecialInputActive = false;

      if (isFirstSelection) {
        isSelected = selectedCardEffect !== 'dual'; // 1度目の選択時は制限なし
      } else {
        isSelected = selectedCardEffect !== 'dual' && (selectedCardEffect.includes('attack') !== firstCardIsAttack);
      }
    }

    selectedCard.removeInteractive(); // 選択不可に
    scene.handCardHolder.pickUpEffectToHandCard(selectedCard);
    usingCards.push(selectedCard);
    await scene.playSpecialTweens(effects);
  };

  // 1度目の選択（制限なし）
  await selectCard(true, false);

  // 1枚目の対となる属性を求める
  const firstCardIsAttack = usingCards[0].data.effects.effect.includes('attack');
  const handCards = scene.handCardHolder.cards;

  // 逆の属性を持つカードがある場合、2度目の選択（1度目の逆の属性のみ）
  const isIncludeReverseCard = handCards.some(card =>
    card.data.effects.effect !== 'dual' && (card.data.effects.effect.includes('attack') === !firstCardIsAttack));

  if (isIncludeReverseCard) {
    await selectCard(false, firstCardIsAttack);
  }

  // 選ばれたカードを使え
  for (let index = 0; index < usingCards.length; index++) {
    await scene.playersAttack(usingCards[index].data.effects);
    scene.playerdata.deck.use(usingCards[index]);
  };
  return true;
}

async function handleCurse(scene, effects) {
  scene.enemydata.effect(effects);
  return false;
}

async function handleSleep(scene, effects) {
  const isSuccessed = scene.enemydata.effect(effects);
  return isSuccessed;
}