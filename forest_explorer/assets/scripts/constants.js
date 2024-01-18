// Map上のDepthは存在する行番号を+する（+0 ~ +2）
// 行数が増えることがあれば手直しがいるかも
export const DEPTH = {
  SCAFFOLD: 10,
  ENTITY_0: 11,
  ENTITY_1: 14,
  ENTITY_2: 17,
  ENEMY_0: 12,
  ENEMY_1: 15,
  ENEMY_2: 18,
  PLAYER_0: 13,
  PLAYER_1: 16,
  PLAYER_2: 19,
  CARD_BASE: 20,
  CARD_ILLUST: 21,
  CARD_FRAME: 22,
  CARD_TEXT: 23,
  PARTICLE: 80,
  DRAG_CARD_ILLUST: 91,
  DRAG_CARD_ILLUST_EFFECT: 92,
  DRAG_CARD_FRAME: 93,
  DRAG_CARD_TEXT: 94,
  UI_BASE: 100,
  UI_TEXT: 101,
  UI_PLUS: 102,
}
export const EFFECT_ELEMENT = {
  FIRE: "fire",
  ICE: "ice",
  WIND: "wind"
}
export const CONDITION = {
  SLEEPED: "sleeped",
  CURSED: "cursed",
  ANALYZED: "analyzed",
  CHARGED: "charged"
}
export const MAP_OBJECT_TYPE = {
  NONE: 0,
  PLAYER: 1,
  ENEMY: 2,
  TREASURE: 3,
  DECK_EDIT: 4
}
export const VECTOR = {
  NONE: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3,
  DOWN: 4
}
export const BOARD_ID = {
  NONE: 0,
  EDIT: "EDIT_",
  INVENTORY: "INVENTORY_"
}
export const MOVE_SPEED = 135;