export class CardDatabase {
  constructor(scene) {
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
    const data = JSON.parse(JSON.stringify(_data));

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