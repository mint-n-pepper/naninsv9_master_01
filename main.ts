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
    } else if (name.includes("messung")) {
        radio.sendValue("messung", nanins.read_pressure(nanins.INSIDE_OUTSIDE.inside))
        radio.sendValue("messung", nanins.read_temp(nanins.INSIDE_OUTSIDE.inside))
    } else {
    	
    }
})
let Funknummer = 1
let colors = 0
radio.setGroup(Funknummer)
radio.sendValue("led", 1)
/**
 * motor bedeutet die Steuerung der N20 Motoren.
 * 
 * 1 Abtauchen= P (Plunger) vorne einfahren, Pause, P hinten einfahren.
 * 
 * 2 Unten P ganz oben
 * 
 * 3 Auftauchen P vorne zuerst dann hinten
 * 
 * 4 Mittelposition beide P
 */
basic.forever(function () {
    basic.showNumber(Funknummer)
})
