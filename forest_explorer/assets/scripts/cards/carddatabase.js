// BattleとMapで分割を検討
export class CardDatabase {
  constructor(scene, stageCount = -1) {
    this.map_datas = scene.cache.json.get('map_card_datas').datas;
    this.battle_datas = scene.cache.json.get('battle_card_datas').datas;
  }
  // 適切な処理を行い、カードデータのコピーを返す
  get(id) {
    const _data = this.map_datas[id];
    const data = JSON.parse(JSON.stringify(_data));

    // ランダムvalueがある場合、valueはとなる
    if (data.effects.rnd_value !== undefined && data.effects.rnd_value) {
      const splited = data.effects.rnd_value.split('-');
      data.effects.value = Phaser.Math.Between(parseInt(splited[0]), parseInt(splited[1]));
    }
    return data;
  }
  // 分岐方法は考える？
  get_battle(id) {
    const _data = {
      id: this.battle_datas[id].id,
      name: this.battle_datas[id].name,
      detail: this.battle_datas[id].details,
      effects: this.battle_datas[id].effects
    };
    const copiedData = JSON.parse(JSON.stringify(_data));
    const data = new Carddata(copiedData.id, copiedData.name, copiedData.detail, copiedData.effects);

    // ランダムvalueがある場合、valueはその範囲内となる
    if (data.effects === undefined) {
      return;
    }

    if (data.effects.rnd_value !== undefined && data.effects.rnd_value) {
      const splited = data.effects.rnd_value.split('-');
      data.effects.value = Phaser.Math.Between(parseInt(splited[0]), parseInt(splited[1]));
    }
    return data;
  }
}
export class EndressCardDatabase extends CardDatabase {
  constructor(scene, stageCount = -1) {
    super(scene, stageCount);
    this.cache = {};
    this.value = stageCount;
  }
  get_battle(id) {
    const _data = {
      id: this.battle_datas[id].id,
      name: this.battle_datas[id].name,
      detail: this.battle_datas[id].details,
      effects: this.battle_datas[id].effects
    };
    const copiedData = JSON.parse(JSON.stringify(_data));
    const data = new Carddata(copiedData.id, copiedData.name, copiedData.detail, copiedData.effects);

    // ランダムvalueがある場合、valueはその範囲内となる
    if (data.effects === undefined) {
      return;
    }

    // ここまで共通だが、superすると余計な処理まで走ってしまう？

    // エンドレスモードではランダムバリューは独自計算の範囲になる
    if (data.effects.rnd_value === undefined || !data.effects.rnd_value) {
      return data;
    }

    // 上位魔法ほど最大値が高く、最低値も高い
    const rank = data.effects.rank ? data.effects.rank : 0; // 補助魔法などランクがないものもある
    let min = rank + Math.ceil(rank/2) + this.value * 3;
    let max = min + (4 - rank) + rank; // 上位魔法は振れ幅が少ない

    // (特殊処理)一部魔法は強すぎるとバランス崩壊するので調整
    // 　　　　　回復魔法は効果量を減らす
    const isSpecialSpell = data.effects.effect.includes('heal');

    min = isSpecialSpell ? Math.ceil(min / 3 * 2) : min;
    max = isSpecialSpell ? Math.ceil(max / 3 * 2) : max;

    data.effects.rnd_value = `${min}-${max}`;
    data.effects.value = Phaser.Math.Between(min, max);
  
    return data;
  }
}
export class Carddata {
  constructor(id, name, detail, effects) {
    this.id = id;
    this.name = name;
    this.detail = detail;
    this.effects = effects;
  }
  getKey() {
    return `${this.id}-${this.effects.rnd_value}`;
  }
}