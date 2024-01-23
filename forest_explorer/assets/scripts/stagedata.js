import * as Util from './util.js'

export class StageDatabase {
  constructor(scene) {
    this.data = scene.cache.json.get('stage_data');
  }
  getData(index) {
    const data = this.data[`stage${index}`];
    if (!data) { return null; }
    const copiedData = JSON.parse(JSON.stringify(data));
    copiedData.index = index;
    return new StageData(copiedData);
  }
}
export class EndlessStageDatabase extends StageDatabase {
  getData(index) {
    return this.createData(index);
  }
  // エンドレスモードでは一定のロジックに基づきデータを生成する
  createData(index) {
    const length = this.createLength(index);

    return new StageData({
      index: index,
      enemyIDs: this.createEnemyIDs(index),
      bossID: this.createBossID(index),
      dropRank: null,
      rareDropRate: null,
      length: length,
      remainingRestCards: Math.ceil(length / 5),
      bgmID: this.createBGMID(index),
    });
  }
  // 事実上グラフィックのみなので単純に弱そうな中から抽選
  createEnemyIDs(index) {
    const enemyIDs_weak = ['fire_0', 'ice_0', 'iron_0', 'iron_1', 'wind_0'];
    const enemyIDs_normal = ['fire_1', 'ice_1', 'wind_1', 'iron_2', 'other_5', 'other_6'];
    const enemyIDs_strong = ['fire_2', 'ice_2', 'wind_2', 'iron_4', 'other_2', 'other_5', 'other_6', 'other_7', 'other_8', 'other_10'];
    return this.selectRandomArrayByFloorType(index, enemyIDs_weak, enemyIDs_normal, enemyIDs_strong);
  }

  // ボスIDを生成、事実上グラフィックのみなので単純に強そうな中から抽選
  // ただはじめの方で強そうなのが出てもシュールなので三段階に分ける
  createBossID(index) {
    const bossIDs_weak = ['fire_2', 'ice_2', 'iron_2', 'wind_2', 'other_5', 'other_6'];
    const bossIDs_normal = ['fire_3', 'ice_3', 'wind_3', 'iron_3', 'other_2', 'other_7', 'other_8'];
    const bossIDs_strong = ['iron_5', 'other_3', 'other_4', 'other_9', 'boss_0'];
    const target = this.selectRandomArrayByFloorType(index, bossIDs_weak, bossIDs_normal, bossIDs_strong);
    return this.getRandomFromArray(target);
  }
  selectRandomArrayByFloorType(index, weakIDs, normalIDs, strongIDs) {
    const isWeakFloor = index < 3;
    const isNormalFloor = index >= 3 && index < 6;

    let target;
    if (isWeakFloor) target = weakIDs;
    else if (isNormalFloor) target = normalIDs;
    else target = strongIDs;

    return target;
  }
  getRandomFromArray(target) {
    const rnd = Phaser.Math.Between(0, target.length - 1);
    return target[rnd];
  }
  createLength(index) {
    const length = Util.biasedRandomInt(20, 40, Math.ceil(index/15));
    return length;
  }
  createBGMID(index) {
    return Phaser.Math.Between(1, 3);
  }
}
export class StageData {
  constructor(data) {
    this.index = data.index;
    this.enemyIDs = data.enemyIDs;
    this.bossID = data.bossID;
    this.toGoalLength = data.length;
    this.dropRank = data.dropRank;
    this.rareDropRate = data.rareDropRate;
    this.remainingRestCards = data.remainingRestCards;
    this.bgmID = data.bgmID;
  }
  moveCount(distance) {
    this.toGoalLength -= distance.x;
    this.toGoalLength = Math.max(this.toGoalLength, 0);
  }
  restCardCount(makedAmount) {
    this.remainingRestCards -= makedAmount;
    this.remainingRestCards = Math.max(this.remainingRestCards, 0);
  }
}