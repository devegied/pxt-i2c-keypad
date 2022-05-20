/**
 * Handles keypad connected through I2C
 */
//% weight=100 color=#c04c18 icon="\uf1ad" block="KeyPad"
namespace i2cKeypad {
    const I2CKP_ADDRESS = 0x5B;
    const KP_STATUS_PAUSE_BETWEEN_READ = 50;
    // List of keys on keypad
    export const enum Keys {
        K1 =  0b0000000000000001,
        K2 =  0b0000000000000010,
        K3 =  0b0000000000000100,
        K4 =  0b0000000000001000,
        K5 =  0b0000000000010000,
        K6 =  0b0000000000100000,
        K7 =  0b0000000001000000,
        K8 =  0b0000000010000000,
        K9 =  0b0000000100000000,
        K10 = 0b0000001000000000,
        K11 = 0b0000010000000000,
        K12 = 0b0000100000000000,
        K13 = 0b0001000000000000,
        K14 = 0b0010000000000000,
        K15 = 0b0100000000000000,
        K16 = 0b1000000000000000,
        //% block="any"
        Any = 1 << 16,
    }
    export const enum KeyAction {
        //% block="pressed"
        Pressed = 0,
        //% block="released"
        Released = 1,
    }
    class KeyHandler {
        key: Keys;
        handler: () => void;

        constructor(key: Keys, handler: () => void) {
            this.key = key;
            this.handler = handler;
        }

        onEvent(key: Keys) {
            if (key === this.key || Keys.Any === this.key) {
                this.handler();
            }
        }
    }
    interface KeyState {
        keyStatus: number;
        eventValue: number;
        hasNewKeyEvent: boolean;
        onPressed: KeyHandler[];
        onReleased: KeyHandler[];
    }

    let keyState: KeyState;
    let keyPadSymbols: string = "123A456B789C*0#D";
    let onTheKeyPressedHandler: (theKey: string, stringBeforeTheKey: string) => void;
    let collectedKeyPresses: string = "";

    /**
     * Optionaly initialize the keypad controller by defining key symbols.
     * @param symbols symbols on keypad keys from left to right and from top to bottom expressed as a string, eg: "123A456B789C*0#D"
     */
    //% blockId="i2cKeypad_init" block="init keypad with | %symbols"
    //% weight=70 symbols.defl="123A456B789C*0#D"
    export function initKeypadController(symbols: string = null) {
        if (!!keyState) {
            return;
        }

        keyState = {
            keyStatus: 0,
            eventValue: 0,
            hasNewKeyEvent: false,
            onPressed: [],
            onReleased: [],
        };
        if(symbols != null)
            keyPadSymbols = symbols;
        keypad.start(I2CKP_ADDRESS);
        control.setInterval(detectAndNotifyKeyEvents, KP_STATUS_PAUSE_BETWEEN_READ,control.IntervalMode.Interval);
    }
    function detectAndNotifyKeyEvents() {
        const keyStatus = keypad.readKeyStatus(I2CKP_ADDRESS);

        if (keyStatus != keyState.keyStatus) {
            const previousState = keyState.keyStatus;
            keyState.keyStatus = keyStatus;

            for (let keyBit = Keys.K1; keyBit <= Keys.K16;keyBit <<= 1) {
                if ((keyBit & keyStatus) === 0) {// Raise event when key is released
                    if (!((keyBit & previousState) === 0)) {
                        keyState.eventValue = keyBit;
                        keyState.onReleased.forEach((th) => { th.onEvent(keyBit) });
                    }
                }
                if ((keyBit & keyStatus) !== 0) {// Raise event when key is pressed
                    if (!((keyBit & previousState) !== 0)) {
                        keyState.eventValue = keyBit;
                        keyState.hasNewKeyEvent = true;
                        keyState.onPressed.forEach((th) => { th.onEvent(keyBit) });
                    }
                }
            }
        }
    }
    /**
     * Do something when a key is pressed or released.
     * @param key the key to be checked, eg: Keys.K1
     * @param action the trigger action, eg: KeyAction.Pressed
     * @param handler code to run when the event is raised
     */
    //% blockId=i2cKeypad_on_key
    //% block="on | %key | %action"
    //% key.fieldEditor="gridpicker" key.fieldOptions.columns=4
    //% key.fieldOptions.tooltips="false"
    //% weight=65
    export function onKey(key: Keys, action: KeyAction, handler: () => void) {
        initKeypadController();
        if (action === KeyAction.Pressed) {
            keyState.onPressed.push(new KeyHandler(key, handler));
        } else {
            keyState.onReleased.push(new KeyHandler(key, handler));
        }
    }
    /**
     * Do something when any of the symbols are entered
     * @param keys any of the symbols in this string will initiate execution
     * @param cb code executed when one of indicated symbols is entered, it will have access to symbol of the key that initiated this execution and the symbols as a string entered earlier
     */
    //% blockId=i2cKeypad_on_keys_drag block="on any of the keys %keys pressed" blockGap=16
    //% draggableParameters=reporter blockAllowMultiple=false
    //% keys.defl="#"
    export function onKeysPressed(keys: string, cb: (theKey: string, stringBeforeTheKey: string) => void) {
        i2cKeypad.onKey(i2cKeypad.Keys.Any, i2cKeypad.KeyAction.Pressed, function () {
            let receivedSymbol = i2cKeypad.currentSymbol();
            if (keys.indexOf(receivedSymbol)>=0){
                onTheKeyPressedHandler(receivedSymbol, collectedKeyPresses);
                collectedKeyPresses = "";
            }else{
                collectedKeyPresses += receivedSymbol;
            }
        })
        onTheKeyPressedHandler = cb;
    }
    
    /**
     * Returns the key index of the last key event that was received.
     * It could be either a key pressed or released event.
     */
    //% blockId=i2cKeypad_current_key
    //% block="key"
    //% weight=50
    export function currentKey(): number {
        initKeypadController();
        if (keyState.eventValue !== 0) {
            return getKeyIndexFromBitField(keyState.eventValue);
        } else {
            return 0;
        }
    }
    /**
     * Returns the key symbol of the last key event that was received.
     * It could be either a key pressed or released event.
     */
    //% blockId=i2cKeypad_current_symbol
    //% block="symbol"
    //% weight=45
    export function currentSymbol(): string {
        initKeypadController();
        if (keyState.eventValue !== 0) {
            return keyPadSymbols.charAt(getKeyIndexFromBitField(keyState.eventValue)-1);
        } else {
            return "";
        }
    }
    function getKeyIndexFromBitField(keyBit: Keys) {
        if (keyBit === Keys.Any) {
            return Keys.Any;
        }
        let bit = Keys.K1;
        for (let kI = 1; kI <= 16; kI++) {
            if ((bit & keyBit) !== 0) {
                return kI; // return first hit
            }
            bit <<= 1;
        }
        return 0;
    }

    function getKeyFromIndex(index: number): Keys {
        if (1 <= index && index <= 16) {
            return Keys.K1 << (index - 1);
        } else if (index === Keys.Any) {
            return Keys.Any;
        } else {
            return 0;
        }
    }
    /**
     * Returns true if a specific key is currently pressed. False otherwise.
     * @param key the key to be checked, eg: Keys.K1
     */
    //% blockId=i2cKeypad_is_key_pressed
    //% block="key | %key | is pressed"
    //% key.fieldEditor="gridpicker" key.fieldOptions.columns=4
    //% key.fieldOptions.tooltips="false"
    //% weight=40
    //% blockHidden=true
    export function isKeyPressed(key: Keys): boolean {
        initKeypadController();
        if (key === Keys.Any) {
            return keyState.keyStatus !== 0;
        } else {
            return (keyState.keyStatus & key) !== 0;
        }
    }
    /**
     * Turns a Key into its index value.
     * @param key the key, eg: Keys.K1
     */
    //% blockId=i2cKeypad_key_index
    //% block="%keyIndex"
    //% key.fieldEditor="gridpicker" key.fieldOptions.columns=4
    //% key.fieldOptions.tooltips="false"
    //% blockHidden=true
    export function keyIndex(key: Keys): number {
        return getKeyIndexFromBitField(key);
    }
    /**
     * Returns true if a specific key is currently pressed. False otherwise.
     * @param keyIndex the key index to be checked
     */
    //% blockId="i2cKeypad_is_key_index_pressed"
    //% block="key | %keyIndex=i2cKeypad_key_index | is pressed"
    //% weight=42
    export function isPressed(keyIndex: number): boolean {
        return isKeyPressed(getKeyFromIndex(keyIndex));
    }

    /**
     * Returns true if any key was pressed since the last call of this function. False otherwise.
     */
    //% blockId=i2cKeypad_was_any_key_pressed
    //% block="any key was pressed"
    //% weight=41
    export function wasPressed(): boolean {
        initKeypadController();
        if (keyState.hasNewKeyEvent) {
            keyState.hasNewKeyEvent = false;
            return true;
        } else {
            return false;
        }
    }
    // Communication module for i2c keypad controller
    // https://github.com/devegied/keypad_4x4_i2c_stm8_spl
    export namespace keypad {
        function writeCommandData(address: number,command: number,data: number): void {
            const commandDataBuffer = pins.createBuffer(pins.sizeOf(NumberFormat.UInt16BE));
            commandDataBuffer.setNumber(NumberFormat.UInt16BE,0,(command << 8) | data);
            pins.i2cWriteBuffer(address, commandDataBuffer);
        }

        function writeCommand(address: number, command: number): void {
            const commandBuffer = pins.createBuffer(pins.sizeOf(NumberFormat.UInt8BE));
            commandBuffer.setNumber(NumberFormat.UInt8BE, 0, command);
            pins.i2cWriteBuffer(address, commandBuffer);
        }

        export function start(address: number): void {
            //writeCommandData(address,ConfigureRegister,ConfigureValues); for the future
        }

        export function readKeyStatus(address: number): number {
            return pins.i2cReadNumber(address, NumberFormat.UInt16LE);
        }
    }
}