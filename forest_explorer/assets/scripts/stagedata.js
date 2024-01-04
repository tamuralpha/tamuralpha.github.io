export class StageDatabase {
  constructor(scene) {
    this.data = scene.cache.json.get('stage_data');
  }
  getData(id) {
    const data = this.data[`stage${id}`];
    if (!data) { return null; }
    const copiedData = JSON.parse(JSON.stringify(data));
    return new StageData(copiedData);
  }
}
export class StageData {
  constructor(data) {
    this.enemyIDs = data.enemyIDs;
    this.bossID = data.bossID;
    this.toGoalLength = data.length;
    this.dropRank = data.dropRank;
    this.rareDropRate = data.rareDropRate;
    this.remainingRestCards = data.remainingRestCards;
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