// 状態変化を扱うクラス
export class Condition {
  constructor() {
    this.list = {};
  }
  add(conditionName, expiration) {
    this.list[conditionName] = expiration;
  }
  updateTurn() {
    Object.keys(this.list).forEach(conditionName => {
      this.list[conditionName]--;

      if (this.list[conditionName] <= 0) {
        delete this.list[conditionName];
      }
    });
  }
  get(conditionName) {
    return this.list[conditionName];
  }
  delete(conditionName) {
    delete this.list[conditionName];
  }
  getActiveConditions() {
    return Object.keys(this.list).filter(conditionName => this.list[conditionName] > 0);
  }
  checkHasActiveCondition(conditionName) {
    return Object.keys(this.list).filter(_conditionName => conditionName === _conditionName && this.list[_conditionName] > 0).length > 0;
  }
}