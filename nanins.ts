/*
    The MIT License (MIT)

    Copyright (c) 2022 Lancaster University

    Permission is hereby granted, free of charge, to any person obtaining a
    copy of this software and associated documentation files (the "Software"),
    to deal in the Software without restriction, including without limitation
    the rights to use, copy, modify, merge, publish, distribute, sublicense,
    and/or sell copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following conditions:
    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
    THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
    DEALINGS IN THE SOFTWARE.
*/

/**
 * Functions to operate the Nanins under-water robot.
 */
//% weight=5 color=#015f85 icon="\u26f4" block="Nanins" advanced=false
//% groups=['Senden', 'Empfangen', 'Beschleunigung', 'Feldstärke', 'Position', 'Orientierung']
namespace nanins {
    // 
    enum REG_NAMES {
        max_speed_syringe_nose,
        max_speed_syringe_tail,
        set_position_syringe_nose,
        set_position_syringe_tail,
        LED_RGB_nose,
        LED_RGB_tail,
        status,
        position_syringe_nose,
        position_syringe_tail,
        pressure_inside,
        pressure_outside,
        temperature_inside,
        temperature_outside,
        acceleration,
        magnetic_field,
        position_aquarium,
        orientation_rel_to_g,
        battery_level,
        picture_data,
    }

    export enum NOSE_TAIL {
        //%block="Bug"
        nose,
        //%block="Heck"
        tail
    }

    export enum INSIDE_OUTSIDE {
        //%block="innen"
        inside,
        //%block="aussen"
        outside
    }

    export enum ROBOT_STATUS {
        //%block="am Laden"
        charging,
        //%block="Motor Fehler"
        motor_error,
        //%block="Battery Leer"
        battery_empty,
    }


    const _stm_mcu_i2c_addr: number = 0x01;
    // How long to wait between sending a i2c write operation and consecutive read operation
    const _wait_time_i2c_us: number = 1;

    let _ax = 0;
    let _ay = 0;
    let _az = 0;
    let _accelFresh = false;

    let _hx = 0;
    let _hy = 0;
    let _hz = 0;
    let _magFieldFresh = false;

    let _pos_x = 0;
    let _pos_y = 0;
    let _pos_z = 0;
    let _positionFresh = false;

    let _orientation_x = 0;
    let _orientation_y = 0;
    let _orientation_z = 0;
    let _orientationFresh = false;

    // Q notation as defined by Texas Instruments (sign bit not counted in the integer part)
    function float_to_Q_notation(value: number, integer: number, fraction: number, is_signed = true): number {
        // Clamp values
        if (value < 0) {
            if (!is_signed) {
                value = 0;
            } else {
                value = (-1) * (2 ** integer);
            }
        }
        const max_value = 2 ** integer - 2 ** -fraction;
        if (value > max_value) value = max_value;

        // Convert to fixed-point
        return Math.round(value * 2 ** fraction)
    }

    // Q notation as defined by Texas Instruments (sign bit not counted in the integer part)
    function Q_notation_to_float(Q: number, fraction: number): number {
        return Q / (1 << fraction);
    }

    // helper functions for debugging
    function byteToHex(b: number): string {
        const hex = "0123456789ABCDEF"
        return hex.charAt((b >> 4) & 0xF) + hex.charAt(b & 0xF)
    }

    function logBufferHex(buf: Buffer) {
        let s = ""
        for (let i = 0; i < buf.length; i++) {
            s += byteToHex(buf.getUint8(i)) + " "
        }
        console.log("buf: " + s)
    }


    /**
     * Schreibe maximale Geschindigkeiten. 
     * Verwendet intern UQ6.10 Werte.
     * @param max_speed_syringe_nose maximale Geschwindigkeit am Bug in mm/sec
     * @param max_speed_syringe_tail maximale Geschwindigkeit am Heck in mm/sec
     */
    //% block="schreibe max. Geschwindigkeit (mm/sec) am $location|$max_speed_syringe"
    //% blockId="nanins_setmaxspeed"
    //% group='Senden'
    //% max_speed_syringe.min=0 max_speed_syringe.max=64
    //% weight=70
    export function write_v_max(location: NOSE_TAIL, max_speed_syringe: number): void {
        let bufr = pins.createBuffer(3);
        bufr.fill(0);
        if (location == NOSE_TAIL.nose) {
            bufr.setNumber(NumberFormat.UInt8LE, 0, REG_NAMES.max_speed_syringe_nose);
        } else {
            bufr.setNumber(NumberFormat.UInt8LE, 0, REG_NAMES.max_speed_syringe_tail);
        }
        const UQ6_10_val = float_to_Q_notation(max_speed_syringe, 6, 10, false)
        bufr.setNumber(NumberFormat.UInt16LE, 1, UQ6_10_val);
        pins.i2cWriteBuffer(_stm_mcu_i2c_addr, bufr, false)
    }

    /**
     * Schreibe Position der Spritze.
     * Verwendet intern Q7.8 Werte.
     * @param set_position_syringe position der Spritze in mm
     */
    //% block="schreibe Position (mm) der Spritze am $location |$set_position_syringe"
    //% blockId="nanins_setpossyringe"
    //% group='Senden'
    //% set_position_syringe.min=-128 set_position_syringe.max=128
    //% weight=69
    export function write_position(location: NOSE_TAIL, set_position_syringe: number): void {
        let bufr = pins.createBuffer(3);
        bufr.fill(0);
        if (location == NOSE_TAIL.nose) {
            bufr.setNumber(NumberFormat.UInt8LE, 0, REG_NAMES.set_position_syringe_nose);
        } else {
            bufr.setNumber(NumberFormat.UInt8LE, 0, REG_NAMES.set_position_syringe_tail);
        }
        const Q7_8_val = float_to_Q_notation(set_position_syringe, 7, 8)
        bufr.setNumber(NumberFormat.UInt16LE, 1, Q7_8_val);
        pins.i2cWriteBuffer(_stm_mcu_i2c_addr, bufr, false)
    }


    // NOTE: Since the current Nanins board is not equipped with LED's yet, we don't want to expose these blocks.
    // Only export the function when we have HW support.
    /**
    * Schreibe LED RGB- und Helligkeits-Werte.
    * @param location Ort der LED [Bug/Tail]
    * @param LED_RGB_level Helligkeit der LED
    * @param LED_RGB_B Blau-Kanal der LED
    * @param LED_RGB_G Grün-Kanal der LED
    * @param LED_RGB_R Rot-Kanal der LED
    */
    //% block="schreibe LED am $location|mit Helligkeitswert $LED_RGB_level|Blau-Wert $LED_RGB_B|Grün-Wert $LED_RGB_G|Rot-Wert $LED_RGB_R"
    //% blockId="nanins_setLEDValues"
    //% group='Senden'
    //% LED_RGB_level.min=0 LED_RGB_level.max=32
    //% LED_RGB_B.min=0 LED_RGB_B.max=255
    //% LED_RGB_G.min=0 LED_RGB_G.max=255
    //% LED_RGB_R.min=0 LED_RGB_R.max=255
    //% weight=68
    function write_LED(location: NOSE_TAIL, LED_RGB_level: number, LED_RGB_B: number, LED_RGB_G: number, LED_RGB_R: number): void {
        let bufr = pins.createBuffer(5);
        bufr.fill(0);
        if (location == NOSE_TAIL.nose) {
            bufr.setNumber(NumberFormat.UInt8LE, 0, REG_NAMES.LED_RGB_nose);
        } else {
            bufr.setNumber(NumberFormat.UInt8LE, 0, REG_NAMES.LED_RGB_tail);
        }
        bufr.setNumber(NumberFormat.UInt8LE, 1, LED_RGB_level);
        bufr.setNumber(NumberFormat.UInt8LE, 2, LED_RGB_B);
        bufr.setNumber(NumberFormat.UInt8LE, 3, LED_RGB_G);
        bufr.setNumber(NumberFormat.UInt8LE, 4, LED_RGB_R);
        pins.i2cWriteBuffer(_stm_mcu_i2c_addr, bufr, false)
    }

    /**
      * Lese Status des Roboters.
      * 0 = am Laden, 1 = Motor Fehler, 2 = Batterie leer
      */
    //% block="Status des Roboters"
    //% blockId="nanins_readStatus"
    //% group='Empfangen'
    //% weight=68
    export function read_status(): ROBOT_STATUS {
        pins.i2cWriteNumber(_stm_mcu_i2c_addr, REG_NAMES.status, NumberFormat.UInt8LE, true)
        control.waitMicros(_wait_time_i2c_us);
        return pins.i2cReadNumber(_stm_mcu_i2c_addr, NumberFormat.UInt8LE);
    }

    /**
      * Lese Akkustand des Roboters in %.
      * Verwendet intern UQ7.9 Werte.
      */
    //% block="Akkustand (\\%)"
    //% blockId="nanins_readBat"
    //% group='Empfangen'
    //% weight=67
    export function read_battery_level(): number {
        pins.i2cWriteNumber(_stm_mcu_i2c_addr, REG_NAMES.battery_level, NumberFormat.UInt8LE, true)
        control.waitMicros(_wait_time_i2c_us);
        let buf = pins.i2cReadBuffer(_stm_mcu_i2c_addr, 2, false);
        const q = buf.getNumber(NumberFormat.UInt16LE, 0);
        return Q_notation_to_float(q, 9);
    }

    /**
      * Lese Position der Spritze in mm.
      * Verwendet intern Q7.8 Wert.
      */
    //% block="Position (mm) der Spritze %position"
    //% blockId="nanins_readPos"
    //% group='Empfangen'
    //% weight=60
    export function read_position(location: NOSE_TAIL): number {
        if (location == NOSE_TAIL.nose) {
            pins.i2cWriteNumber(_stm_mcu_i2c_addr, REG_NAMES.position_syringe_nose, NumberFormat.UInt8LE, true)
        } else {
            pins.i2cWriteNumber(_stm_mcu_i2c_addr, REG_NAMES.position_syringe_tail, NumberFormat.UInt8LE, true)
        }
        control.waitMicros(_wait_time_i2c_us);
        let buf = pins.i2cReadBuffer(_stm_mcu_i2c_addr, 2, false);
        const q = buf.getNumber(NumberFormat.Int16LE, 0)
        return Q_notation_to_float(q, 8);
    }

    /**
      * Lese Druck in Bar.
      * Verwendet intern Q2.13 Werte
      */
    //% block="Druck (Bar) %position"
    //% blockId="nanins_readPres"
    //% group='Empfangen'
    //% weight=59
    export function read_pressure(location: INSIDE_OUTSIDE): number {
        if (location == INSIDE_OUTSIDE.inside) {
            pins.i2cWriteNumber(_stm_mcu_i2c_addr, REG_NAMES.pressure_inside, NumberFormat.UInt8LE, true)
        } else {
            pins.i2cWriteNumber(_stm_mcu_i2c_addr, REG_NAMES.pressure_outside, NumberFormat.UInt8LE, true)
        }
        control.waitMicros(_wait_time_i2c_us);
        let buf = pins.i2cReadBuffer(_stm_mcu_i2c_addr, 2, false);
        const q = buf.getNumber(NumberFormat.Int16LE, 0)
        return Q_notation_to_float(q, 13);
    }

    /**
      * Lese Temperatur in ˚C.
      * Verwendet intern Q6.9 Werte
      */
    //% block="Temperatur (˚C) %position "
    //% blockId="nanins_readTemp"
    //% group='Empfangen'
    //% weight=58
    export function read_temp(location: INSIDE_OUTSIDE): number {
        if (location == INSIDE_OUTSIDE.inside) {
            pins.i2cWriteNumber(_stm_mcu_i2c_addr, REG_NAMES.temperature_inside, NumberFormat.UInt8LE, true)
        } else {
            pins.i2cWriteNumber(_stm_mcu_i2c_addr, REG_NAMES.temperature_outside, NumberFormat.UInt8LE, true)
        }
        control.waitMicros(_wait_time_i2c_us);
        let buf = pins.i2cReadBuffer(_stm_mcu_i2c_addr, 2, false);
        const q = buf.getNumber(NumberFormat.Int16LE, 0)
        return Q_notation_to_float(q, 9);
    }

    /**
      * Update Beschleunigung .
      * Verwendet intern Q2.13 Werte
      */
    //% block="update Beschleunigsdaten"
    //% blockId="nanins_fetchAccel"
    //% group='Beschleunigung'
    //% weight=57
    export function update_accel(): void {
        pins.i2cWriteNumber(_stm_mcu_i2c_addr, REG_NAMES.acceleration, NumberFormat.UInt8LE, true)
        control.waitMicros(_wait_time_i2c_us);
        let buf = pins.i2cReadBuffer(_stm_mcu_i2c_addr, 6, false);
        const q_x = buf.getNumber(NumberFormat.Int16LE, 0)
        const q_y = buf.getNumber(NumberFormat.Int16LE, 2)
        const q_z = buf.getNumber(NumberFormat.Int16LE, 4)
        _ax = Q_notation_to_float(q_x, 13);
        _ay = Q_notation_to_float(q_y, 13);
        _az = Q_notation_to_float(q_z, 13);
        _accelFresh = true;
    }

    /**
     * Hole (zuvor mit update geladene) Beschleunigungsdaten. 
     */
    //% block="Beschleunig (g) %axis"
    //% blockId="nanins_getAccel"
    //% group='Beschleunigung'
    //% weight=56
    export function acceleration(axis: Dimension): number {
        // Ensure we have at least once fetched sensor data
        if (!_accelFresh) {
            update_accel();
        }
        return axis == Dimension.X ? _ax :
            axis == Dimension.Y ? _ay : _az
    }

    /**
      * Update magnetische Feldstärke.
      * Verwendet intern Q6.9 Werte.
      */
    //% block="update magnetische Feldstärke"
    //% blockId="nanins_fetchMagField"
    //% group='Feldstärke'
    //% weight=55
    export function update_mag_field(): void {
        pins.i2cWriteNumber(_stm_mcu_i2c_addr, REG_NAMES.magnetic_field, NumberFormat.UInt8LE, true)
        control.waitMicros(_wait_time_i2c_us);
        let buf = pins.i2cReadBuffer(_stm_mcu_i2c_addr, 6, false);
        const q_x = buf.getNumber(NumberFormat.Int16LE, 0)
        const q_y = buf.getNumber(NumberFormat.Int16LE, 2)
        const q_z = buf.getNumber(NumberFormat.Int16LE, 4)
        _hx = Q_notation_to_float(q_x, 9);
        _hy = Q_notation_to_float(q_y, 9);
        _hz = Q_notation_to_float(q_z, 9);
        _magFieldFresh = true;
    }

    /**
     * Hole (zuvor mit update geladene) magnetische Feldstärke. 
     */
    //% block="Magnetische Feldstärke (Gauss) %axis"
    //% blockId="nanins_getMagField"
    //% group='Feldstärke'
    //% weight=54
    export function mag_field(axis: Dimension): number {
        // Ensure we have at least once fetched data
        if (!_magFieldFresh) {
            update_mag_field();
        }
        return axis == Dimension.X ? _hx :
            axis == Dimension.Y ? _hy : _hz
    }

    /**
     * Update Position im Aquarium.
     * Verwendet intern UQ11.5 Werte.
     */
    //% block="update Position im Aqurium"
    //% blockId="nanins_fetchPosAquarium"
    //% group='Position'
    //% weight=53
    export function update_pos_aquarium(): void {
        pins.i2cWriteNumber(_stm_mcu_i2c_addr, REG_NAMES.position_aquarium, NumberFormat.UInt8LE, true)
        control.waitMicros(_wait_time_i2c_us);
        let buf = pins.i2cReadBuffer(_stm_mcu_i2c_addr, 6, false);
        const q_x = buf.getNumber(NumberFormat.UInt16LE, 0)
        const q_y = buf.getNumber(NumberFormat.UInt16LE, 2)
        const q_z = buf.getNumber(NumberFormat.UInt16LE, 4)
        _pos_x = Q_notation_to_float(q_x, 5);
        _pos_y = Q_notation_to_float(q_y, 5);
        _pos_z = Q_notation_to_float(q_z, 5);
        _positionFresh = true;
    }

    /**
     * Hole (zuvor mit update geladene) Position im Aqurium. 
     */
    //% block="Position (mm) im Aqurium %axis"
    //% blockId="nanins_getPosAquarium"
    //% group='Position'
    //% weight=52
    export function position_aquarium(axis: Dimension): number {
        // Ensure we have at least once fetched data
        if (!_positionFresh) {
            update_pos_aquarium();
        }
        return axis == Dimension.X ? _pos_x :
            axis == Dimension.Y ? _pos_y : _pos_z
    }

    /**
     * Update Orientierung relativ zur Erdanziehungskraft.
     * Verwendet intern Q8.7 Werte.
     */
    //% block="update Orientierung rel. zur Erdanziehungskraft"
    //% blockId="nanins_fetchOrientation"
    //% group='Orientierung'
    //% weight=51
    export function update_orientation(): void {
        pins.i2cWriteNumber(_stm_mcu_i2c_addr, REG_NAMES.orientation_rel_to_g, NumberFormat.UInt8LE, true)
        control.waitMicros(_wait_time_i2c_us);
        let buf = pins.i2cReadBuffer(_stm_mcu_i2c_addr, 6, false);
        const q_x = buf.getNumber(NumberFormat.Int16LE, 0)
        const q_y = buf.getNumber(NumberFormat.Int16LE, 2)
        const q_z = buf.getNumber(NumberFormat.Int16LE, 4)
        _orientation_x = Q_notation_to_float(q_x, 7);
        _orientation_y = Q_notation_to_float(q_y, 7);
        _orientation_z = Q_notation_to_float(q_z, 7);
        _orientationFresh = true;
    }

    /**
     * Hole (zuvor mit update geladene) Orientierung relativ zur Erdanziehungskraft. 
     */
    //% block="Orientierung (˚Grad) %axis"
    //% blockId="nanins_getOrientation"
    //% group='Orientierung'
    //% weight=50
    export function orientation_relative(axis: Dimension): number {
        // Ensure we have at least once fetched data
        if (!_orientationFresh) {
            update_orientation();
        }
        return axis == Dimension.X ? _orientation_x :
            axis == Dimension.Y ? _orientation_y : _orientation_z
    }
}
