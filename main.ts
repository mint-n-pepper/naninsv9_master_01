input.onLogoEvent(TouchButtonEvent.Pressed, function () {
    Funknummer += 1
})
radio.onReceivedValue(function (name, value) {
    if (name.includes("motor")) {
        if (value == 1) {
            nanins.write_v_max(nanins.NOSE_TAIL.nose, 64)
            basic.pause(500)
            nanins.write_v_max(nanins.NOSE_TAIL.tail, 33)
        } else if (value == 2) {
            nanins.write_v_max(nanins.NOSE_TAIL.tail, 64)
            nanins.write_v_max(nanins.NOSE_TAIL.tail, 64)
        } else if (value == 3) {
            nanins.write_v_max(nanins.NOSE_TAIL.tail, 0)
            basic.pause(500)
            nanins.write_v_max(nanins.NOSE_TAIL.tail, 0)
        } else if (value == 4) {
            nanins.write_v_max(nanins.NOSE_TAIL.tail, 33)
            nanins.write_v_max(nanins.NOSE_TAIL.tail, 33)
        }
    } else if (name.includes("p1")) {
        radio.sendValue("p1", nanins.read_pressure(nanins.INSIDE_OUTSIDE.inside))
        radio.sendValue("p1", nanins.read_temp(nanins.INSIDE_OUTSIDE.inside))
    } else if (name.includes("p2")) {
        radio.sendValue("p2", nanins.read_pressure(nanins.INSIDE_OUTSIDE.outside))
        radio.sendValue("p2", nanins.read_temp(nanins.INSIDE_OUTSIDE.outside))
    } else {
        basic.clearScreen()
    }
})
let colors = 0
let Funknummer = 1
radio.setGroup(Funknummer)
radio.sendValue("led", Funknummer)
// motor bedeutet das Verhalten/Steuerung der N20 Motoren um die Plunger zu bewegen.
// 
// 1 Abtauchen: P(Plunger) vorne einfahren, Pause= x, P hinten einfahren.
// 
// 2 Sinken: Beide P nach oben
// 
// 3 Auftauchen: P vorne nach unten, Pause =x, P hinten nach unten
// 
// 4 Mittelposition: beide P dauer=y
basic.forever(function () {
    basic.showNumber(Funknummer)
})
