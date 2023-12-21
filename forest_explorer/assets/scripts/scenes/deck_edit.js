import { CardDatabase } from "../cards/carddatabase.js";
import { ImageLayer } from "../cards/imagelayer.js";
import { Card } from "../cards/card.js";
import { DEPTH, VECTOR, BOARD_ID } from "../constants.js";
import { Deck } from "../cards/deck.js";

export class DeckEdit_Scene extends Phaser.Scene {
    constructor() {
        super({ key: 'DeckEdit_Scene' });
        this.SWIPE_THRESHOLD = 50; // スワイプと見なす最小距離
        this.editBoard = new EditBoard(this);
    }
    // マップシーンから渡されたデータを受け取る
    init(data) {
        this.preEditDeck = data.playersDeck.copy();
        this.cardInventory = new Map([...data.cardInventory]);
        this.isReadOnly = data.isReadOnly;
        this.inventoryBoard = new InventoryBoard(this, this.cardInventory, this.preEditDeck);
    }
    panCamera(x, y, duration = 0, easing = "Power2") {
        return new Promise(resolve => {
            this.cameras.main.on(Phaser.Cameras.Scene2D.Events.PAN_COMPLETE, () => { resolve() });
            this.cameras.main.pan(x, y, duration, easing);
        });
    }
    async create() {
        this.carddatabase = new CardDatabase(this);
        const beforeCenterY = this.cameras.main.centerY;
        await this.panCamera(this.cameras.main.centerX, beforeCenterY * -4);

        // カード画像を置くボードを生成
        this.add.image(254, 272, 'deck_board')
        this.add.image(703, 272, 'deck_board_r')

        // デッキ内カードの一覧 / 手持ちカードの一覧を生成
        this.editBoard.create(this.preEditDeck);
        this.inventoryBoard.create();

        // 編集終了/リセットのボタンを生成
        this.createListners();

        // 画面下からボードが現れる演出、シーンそのものをパン
        await this.panCamera(this.cameras.main.centerX, beforeCenterY, 500, 'Cubic.easeOut');

        // リスナーの設定、デッキ編集時にHUDを更新したりする
        this.game.events.emit('DeckEdited', this.editBoard.getDeck());
    }
    // インプット登録
    createListners() {
        this.setListnerToAllCards();
        this.addButtons();

        this.swipeStart = null;
        this.input.on('pointerdown', this.scenePointerDownHandler.bind(this));
        this.input.on('pointermove', this.scenePointerMoveHandler.bind(this));
        this.input.on('pointerup', this.scenePointerUpHandler.bind(this));
    }
    addButtons() {
        const commit_button = this.add.image(782, 32, 'commit').setDepth(DEPTH.UI_BASE)
        commit_button.setInteractive();
        commit_button.on('pointerdown', async () => {
            await this.endEdit();
        })

        if (this.isReadOnly) return;
        const reset_button = this.add.image(852, 32, 'reset').setDepth(DEPTH.UI_BASE)
        reset_button.setInteractive();
        reset_button.on('pointerdown', () => {
            this.resetEdit();
            this.whenEdit();
        })
    }
    // 押下した位置のオブジェクト（clickedObject）取得について補足
    // 取得はここでなく、create時にセットされたそれぞれのオブジェクト内のハンドラで行う
    // ハンドラはclickedObjectの代入のみ
    // 少しややこしいがそれが一番効率的だと考えられたため
    scenePointerDownHandler(pointer) {
        this.swipeStart = { x: pointer.x, y: pointer.y };
    }
    // 手持ちインベントリ内をスワイプ時にスライド移動させる
    scenePointerMoveHandler(pointer) {
        if (!pointer.isDown || !this.isMovingVertical(pointer)) { return }

        const isInInventoryBoard = Phaser.Geom.Rectangle.Contains(this.inventoryBoard.viewRect, pointer.x, pointer.y)
        if (!isInInventoryBoard) { return }

        this.inventoryBoard.container.y += pointer.velocity.y;
        this.inventoryBoard.container.y = Phaser.Math.Clamp(this.inventoryBoard.container.y, -72 * this.inventoryBoard.cards.size + 360, 0);
    }
    // クリック終了時のハンドラ
    scenePointerUpHandler(pointer) {
        const vector = this.checkIsSwipeAndGetHorizontalVector(pointer);
        this.swipeAction(vector);
        this.clickedObject = null;
    }
    swipeAction(vector) {
        if (vector === VECTOR.NONE) return;

        // nameはxx_yy形式で2つのデータを格納
        // xxは属性、yyはインデックス。
        const name = this.clickedObject.name;
        const splited = name.split('_');
        const index = parseInt(splited[1])

        // カードリストからカードを追加
        const isAddAction = vector === VECTOR.LEFT && name.includes(BOARD_ID.INVENTORY);
        const isRemoveAction = vector === VECTOR.RIGHT && name.includes(BOARD_ID.EDIT);

        if (isAddAction) {
            this.addCardFromInventory(index);
        }
        else if (isRemoveAction) {
            this.removeCardFromEditBoard(index);
        }
    }
    addCardFromInventory(index) {
        if (!this.inventoryBoard.checkCanAddIndex(this.carddatabase.get_battle(index).id)) return;

        const addedCardGameObject = this.editBoard.addNewCard(this.carddatabase.get_battle(index))
        if (addedCardGameObject === null) return;

        this.inventoryBoard.calcDeckOutCardAmount(this.carddatabase.get_battle(index).id, -1);
        this.setListnerToCard(addedCardGameObject);
        this.whenEdit();
    }
    removeCardFromEditBoard(index) {
        const cardID = this.editBoard.deckdata.cards[index].data.id;

        this.editBoard.removeCard(index);
        this.inventoryBoard.calcDeckOutCardAmount(cardID, 1);
        this.whenEdit();
    }
    // 編集のリセット
    // ボード上の全てのオブジェクトを破棄し、編集前デッキのデータに基づき再生成します
    resetEdit() {
        this.editBoard.recreate(this.preEditDeck);
        this.inventoryBoard.recreate();
        this.setListnerToAllCards();
        this.game.events.emit('DeckEdited', this.editBoard.getDeck());
    }
    // デッキ内のカードが変更された時、メインに通知する
    whenEdit() {
        this.game.events.emit('DeckEdited', this.editBoard.getDeck());
    }
    // 編集終了、ボードを画面外に下げてから全内容を消去
    async endEdit() {
        if (this.editBoard.deckdata.cards.length !== 20) { return; } // カードの枚数は20枚でなければならない

        await this.panCamera(this.cameras.main.centerX, this.cameras.main.centerY * -4, 500, 'Cubic.easeOut');
        this.game.events.emit('DeckEditCompleted', this.editBoard.getDeck());
        this.editBoard.clear();
        this.inventoryBoard.clear();
    }
    isSwipe(start, end) {
        if (start === null || end === null) return false;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        return Math.max(Math.abs(dx), Math.abs(dy)) > this.SWIPE_THRESHOLD;
    }
    getSwipeVector(start, end) {
        if (start === null || end === null) return false;
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        if (Math.abs(dx) > Math.abs(dy))
            return (dx > 0) ? VECTOR.RIGHT : VECTOR.LEFT;
        else
            return (dy > 0) ? VECTOR.DOWN : VECTOR.UP;
    }
    checkIsSwipeAndGetHorizontalVector(pointer) {
        const swipeEnd = { x: pointer.x, y: pointer.y };
        const isSwiped = this.isSwipe(this.swipeStart, swipeEnd);

        if (!isSwiped) return VECTOR.NONE;

        const swipeVector = this.getSwipeVector(this.swipeStart, swipeEnd);
        const isVerticalSwipe = swipeVector === VECTOR.UP || swipeVector === VECTOR.DOWN;
        const isNotObject = this.clickedObject === null || this.clickedObject === undefined;

        if (isVerticalSwipe || isNotObject) return VECTOR.NONE;

        return swipeVector;
    }
    isMovingVertical(pointer) {
        const vector = this.getSwipeVector(this.swipeStart, { x: pointer.x, y: pointer.y });
        return vector === VECTOR.UP || vector === VECTOR.DOWN;
    }
    setListnerToAllCards() {
        if (this.isReadOnly) return;
        const editBoardCards = this.editBoard.getCardGameObjectsWithoutUsed();
        const inventoryBoardCards = this.inventoryBoard.getCardFrameGameObjects();
        const allCards = editBoardCards.concat(inventoryBoardCards);

        allCards.forEach(gameObject => {
            this.setupInteractive(gameObject);
        });
    }
    setListnerToEditBoardCards() {
        if (this.isReadOnly) return;
        const editBoardCards = this.editBoard.getCardGameObjectsWithoutUsed();

        editBoardCards.forEach(gameObject => {
            this.setupInteractive(gameObject);
        });
    }
    setListnerToCard(gameObject) {
        if (this.isReadOnly) return;
        this.setupInteractive(gameObject);
    }
    setupInteractive(gameObject) {
        if (this.isReadOnly) return;
        gameObject.setInteractive();
        gameObject.on('pointerdown', (pointer) => {
            this.clickedObject = gameObject;
        });
    }
}
// 編集画面における左側、現在のデッキの状態を表示するパネル
class EditBoard {
    constructor(scene) {
        this.GRID_OFFSET = 4;
        this.CARD_SCALE = 0.675;
        this.deckdata = { // Deck型はimageLayerを含めないので専用
            cards: [],
            statuses: []
        }
        this.scene = scene;
    }
    getCardGameObjects() {
        return this.deckdata.cards.map(card => card.imageLayer.items[0]);
    }
    // cardsからusedでないもののgameObjectを抽出して返します
    getCardGameObjectsWithoutUsed() {
        return this.deckdata.cards.filter((card, index) =>
            this.deckdata.statuses[index].used !== undefined && !this.deckdata.statuses[index].used
        ).map(card => card.imageLayer.getFrame());
    }
    getDeckDataByIDs() {
        return this.deckdata.cards.map(card => card.id);
    }
    getDeck() {
        const deck = new Deck(this.scene);
        deck.cards = this.deckdata.cards.map(card => card.data);
        deck.statuses = this.deckdata.statuses;
        return deck;
    }
    clear() {
        // cardsはGameObjectを持つので破棄
        for (let index = 0; index < this.deckdata.cards.length; index++) {
            this.deckdata.cards[index].imageLayer.destroyMyself();
        }
        this.deckdata = {
            cards: [],
            statuses: []
        };
    }
    // 既に存在するものを全削除
    recreate(deckdata) {
        this.clear();
        this.create(deckdata);
    }
    create(deckdata) {
        this.calcGridOffset(128 * this.CARD_SCALE, 5, 4);
        this.createCards(deckdata);
    }
    createCards(deckdata) {
        for (let index = 0; index < deckdata.cards.length; index++) {
            this.addCard(index, deckdata);
        }
    }
    createCard(index, cardData) {
        const imageLayer = new ImageLayer();
        const card = new Card(imageLayer, cardData.id, cardData);

        const position = this.calcCardPositon(128 * this.CARD_SCALE, index)
        const frame = this.createFrame(card, position, index);
        const image = this.createImage(card, position, index);
        const text = this.createText(card, position);

        // 加工処理
        imageLayer.addItems([frame, image, text], false);
        imageLayer.saveInitialPositions();

        return card;
    }
    createImage(card, position, index) {
        const image = this.scene.add.image(position.x, position.y + 30, `card_battle_${card.id}`);
        image.setScale(this.CARD_SCALE / 1.5);
        image.setCrop(
            image.width / 2 - 90,
            image.height / 2 - 156,
            120 * 1.5,
            120 * 1.5
        ).setDepth(DEPTH.CARD_ILLUST);

        this.applyEffectZeroInventoryCard(image, index);
        return image;
    }
    createFrame(card, position, index) {
        const cardValue = card.data.effects.value;
        const isValuableCard = cardValue !== null && cardValue !== undefined;
        const frame_type = isValuableCard ? 'frame_s' : 'n_frame_s';

        const frame = this.scene.add.image(position.x, position.y, frame_type).setDepth(DEPTH.CARD_FRAME);
        frame.name = BOARD_ID.EDIT + index;
        console.log(frame);
        frame.setScale(this.CARD_SCALE);
        return frame;
    }
    createText(card, position) {
        const cardValue = card.data.effects.value;
        const isValuableCard = cardValue !== null && cardValue !== undefined;
        const writeValue = card.data.effects.rnd_value ? card.data.effects.rnd_value : cardValue;

        if (!isValuableCard) return null;

        const text = this.scene.add.text(
            position.x - 64 * this.CARD_SCALE, position.y - 65 * this.CARD_SCALE, writeValue, {
            fontSize: 22 * this.CARD_SCALE,
            fontFamily: "Pixelify Sans",
            color: "#FFF",
            stroke: '#000',
            strokeThickness: 3,
            align: 'center'
        }).setDepth(DEPTH.CARD_TEXT);
        const offset = (28 - text.width) / 2;
        text.x += offset;

        return text;
    }
    // インベントリ内にないカード（所持している分が全部デッキに入っている）を灰色で表示
    applyEffectZeroInventoryCard(image, index) {
        if (this.deckdata.statuses[index].used)
            image.setTint(0x808080);
        return image;
    }
    addCard(index, deckdata) {
        this.deckdata.statuses.push(deckdata.statuses[index]);
        this.deckdata.cards.push(this.createCard(index, deckdata.cards[index]));
    }
    addNewCard(carddata) {
        const newCardIndex = this.deckdata.cards.length;
        if (newCardIndex >= 20) { return null; }

        this.deckdata.statuses.push({ used: false, drawed: false });
        this.deckdata.cards.push(this.createCard(this.deckdata.cards.length, carddata));
        return this.deckdata.cards[newCardIndex].imageLayer.getFrame();
    }
    removeCard(index) {
        this.deckdata.cards[index].imageLayer.destroyMyself();
        this.deckdata.cards.splice(index, 1);
        this.deckdata.statuses.splice(index, 1);
        this.alignToRemoved(index);
    }
    alignToRemoved(removedIndex) {
        for (let index = removedIndex; index < this.deckdata.cards.length; index++) {
            const card = this.deckdata.cards[index];
            const position = this.calcCardPositon(128 * this.CARD_SCALE, index)

            const frame = card.imageLayer.getFrame();
            frame.x = position.x;
            frame.y = position.y;
            frame.name = BOARD_ID.EDIT + index;

            const illust = card.imageLayer.getIllust();
            illust.x = position.x;
            illust.y = position.y + 30;

            const text = card.imageLayer.getText();

            if (!text) { continue; }

            text.x = position.x - 64 * this.CARD_SCALE;
            text.y = position.y - 65 * this.CARD_SCALE;
            const offset = (28 - text.width) / 2;
            text.x += offset;
        }
    }
    // 要素の数からグリッドの大きさを求めます
    calcGridOffset(size, column, row) {
        const base = size;
        let x = base * column;
        let y = base * row;
        x += this.GRID_OFFSET * (column - 1);
        y += this.GRID_OFFSET * (row - 1);

        this.gridOffset = {
            x: (this.scene.cameras.main.width - x) / 2 - 194,
            y: (this.scene.cameras.main.height - y) / 2 - 48 + 64
        }
    }
    // カードをグリッド内に並べるため、指定indexの場合の位置を求める
    calcCardPositon(size, index) {
        const column = index % 5; // 現在のアイテムがある列
        const row = Math.floor(index / 5); // 現在のアイテムがある行

        const base = size;

        let x = base / 2 + base * column; // base / 2は画像の中央を指定位置に配置するための補正（デフォルトでは左上が基点になる）
        x += column === 0 ? 0 : this.GRID_OFFSET * column; // オブジェクト間のスペース

        let y = base / 2 + base * row; // 同上
        y += row === 0 ? 0 : this.GRID_OFFSET * row;

        x = this.gridOffset.x + x;
        y = this.gridOffset.y + y;

        return { x, y };
    }
}
// 所持カードを横長で、縦並びで表示するボードです
class InventoryBoard {
    constructor(scene, cardInventory, preEditDeck) {
        this.scene = scene;
        this.carddatabase = new CardDatabase(this.scene);
        this.INVENTORY_CARD_OFFSET = 72;
        this.viewRect = new Phaser.Geom.Rectangle(535, 93, 336, 358);
        this.cards = new Map();
        this.amounts = new Map();

        this.cardInventory = cardInventory; // ※変更されません：プレイヤーのカードインベントリです
        this.preEditDeck = preEditDeck;     // ※変更されません：プレイヤーの編集前デッキです
    }
    getCardFrameGameObjects() {
        return [...this.cards.values()].map(card => card.imageLayer.getFrame());
    }
    clear() {
        this.cards = new Map();
        this.amounts = new Map();
        this.container.each(child => {
            child.destroy();
        });
        this.container.destroy();
    }
    // リセットボタン押下時などに、現在の内容を破棄し、シーン開始時の内容に基づき再生成します
    recreate() {
        this.clear();
        this.create();
    }
    create() {
        this.createContainer();

        // デッキ・インベントリの内容に基づき操作用パネルを生成します
        const inventoryKeys = Array.from(this.cardInventory.keys());

        for (let index = 0; index < inventoryKeys.length; index++) {
            const key = inventoryKeys[index];
            const allAmount = this.cardInventory.get(key);
            const deckInAmount = this.preEditDeck.getCountInDeck(key);
            const deckOutAmount = allAmount - deckInAmount;
            const result = this.createInventoryCard(index, key, deckOutAmount);

            if (result === null)
                return;
            else {
                this.cards.set(key, result);
                this.amounts.set(key, deckOutAmount);
            }
        }
        this.container.sort('depth');
    }
    createContainer() {
        // メニューアイテムを格納するコンテナを作成
        this.container = this.scene.add.container(0, 0);

        // メニューアイテムを作成（例としてテキストアイテムを使用）
        let mask = this.scene.make.graphics().fillRectShape(this.viewRect);
        this.container.setMask(mask.createGeometryMask());
    }
    createInventoryCard(index, cardID, amount) {
        const imageLayer = new ImageLayer();
        const card = new Card(imageLayer, cardID, this.carddatabase.get_battle(cardID));
        if (card.data === undefined) { return null; }

        const position = { x: 703, y: 128 + (72 * index) }

        const image = this.createImage(position, cardID);
        const frame = this.createFrame(position, cardID);
        const valueText = this.createValueText(card.data, position);
        const amountText = this.createAmountText(position, amount);
        this.setIconToInventoryCard(position, card);

        // 加工処理
        this.container.add(frame);
        this.container.add(image);
        if (valueText) this.container.add(valueText);
        this.container.add(amountText);

        imageLayer.addItems([frame, image, valueText, amountText], false);
        imageLayer.saveInitialPositions();

        this.setTintFromAmount(card, amount);

        return card
    }
    checkCanAddIndex(id) {
        return this.amounts.get(id) > 0;
    }
    calcDeckOutCardAmount(id, value) {
        const nowAmount = this.amounts.get(id) || 0;
        const calcedAmount = nowAmount + value;
        this.amounts.set(id, calcedAmount);
        this.setTextFromAmount(id, calcedAmount);
        this.setTintFromID(id);
    }
    // カードの枚数に基づき、色を決めます
    setTintFromAmount(card, amount) {
        const image = card.imageLayer.items[1];
        if (amount === 0)
            image.setTint(0x808080);
        else
            image.setTint(0xFFFFFF);
    }
    // カードの枚数に基づき、色を決めます
    setTintFromID(id) {
        this.setTintFromAmount(this.cards.get(id), this.amounts.get(id));
    }
    // カードの枚数に基づき、色を決めます
    setTextFromAmount(id, amount) {
        this.setTextDeckoutCardAmount(this.cards.get(id), amount);
    }
    setTextDeckoutCardAmount(card, amount) {
        const text = card.imageLayer.items[3] ? card.imageLayer.items[3] : card.imageLayer.items[2]; // カード生成時、値なしカードなら2、でなければ3番目に対象テキストが格納
        text.setText(amount);
    }
    createImage(position, cardID) {
        const image = this.scene.add.image(position.x - 36, position.y + 80, `card_battle_${cardID}`);
        image.setCrop(
            image.width / 2 - 168,
            image.height / 2 - 114,
            336,
            68
        ).setDepth(DEPTH.CARD_ILLUST);
        return image;
    }
    createFrame(position, id) {
        const frame = this.scene.add.image(position.x, position.y, 'r_frame').setDepth(DEPTH.CARD_FRAME);
        frame.name = BOARD_ID.INVENTORY + id;
        return frame;
    }
    createValueText(carddata, position) {
        const cardValue = carddata.effects.value;
        const isValuableCard = cardValue !== null && cardValue !== undefined;
        let valueText;

        if (isValuableCard) {
            const writeValue = carddata.effects.rnd_value ? carddata.effects.rnd_value : cardValue;
            valueText = this.scene.add.text(
                position.x + 92, position.y - 32, writeValue, {
                fontSize: 22,
                fontFamily: "Pixelify Sans",
                color: "#FFF",
                align: 'center'
            }).setDepth(DEPTH.CARD_TEXT);
        }
        return valueText;
    }
    createAmountText(position, amount) {
        const amountText = this.scene.add.text(
            position.x + 62, position.y - 2, amount, {
            fontSize: 32,
            fontFamily: "Pixelify Sans",
            color: "#FFF",
            stroke: '#000',  // 縁取りの色
            strokeThickness: 6,  // 縁取りの太さ
            align: 'center'
        }).setDepth(DEPTH.CARD_TEXT);

        return amountText;
    }
    // アイコンはイメージレイヤーに入らない（不都合があるかも）
    setIconToInventoryCard(position, card) {
        const element = card.data.effects.effect_element;
        const effect = card.data.effects.effect;

        const isElementValid = element !== undefined && element !== "";
        const isEffectValid = effect !== undefined && effect !== "";

        // Effectが有効ならEffect、Elementが有効ならElement（優先）、両方無効なら""となる
        let validIcon = isEffectValid ? effect : "";
        validIcon = isElementValid ? element : validIcon;

        if (validIcon === "") { return; }

        const icon = this.scene.add.image(position.x + 126, position.y + 8, validIcon).setScale(0.65).setDepth(DEPTH.CARD_TEXT);
        this.container.add(icon);
        return icon;
    }
}